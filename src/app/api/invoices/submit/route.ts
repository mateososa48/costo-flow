import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { config } from "@/config";
import { appendToSheet, checkDuplicates, appendAuditLog } from "@/lib/sheets";
import dropdownOptions from "../../../../../data/dropdown_options.json";
import type { ExtractedInvoice, SubmitApiResponse, SubmitResult } from "@/types";
import getSupabase, { saveInvoiceWithItems, checkDuplicatesViaSupabase } from "@/lib/supabase";
import { appendAuditEntries } from "@/lib/audit-log";
import { getTenantRestaurantSlugs } from "@/lib/tenant";
import log from "@/lib/logger";

const validConceptos = new Set<string>(dropdownOptions.concepto as string[]);
const validCuentasPnl = new Set<string>(dropdownOptions.cuentaPnl as string[]);

function friendlySheetError(raw: string): string {
  if (!raw) return "Error desconocido al enviar a Google Sheets.";
  const msg = raw.toLowerCase();
  if (msg.includes("protected cell") || msg.includes("protected range")) {
    return "La hoja tiene celdas protegidas. Para solucionarlo: abre la hoja → menú Datos → Hojas y rangos protegidos → elimina la protección del rango o pestaña correspondiente.";
  }
  if (msg.includes("caller does not have permission") || msg.includes("403")) {
    return "El sistema no tiene permiso para escribir en esta hoja. Verifica que la hoja esté compartida con la cuenta de servicio como Editor.";
  }
  if (msg.includes("unable to parse range") || msg.includes("invalid range") || msg.includes("no sheet")) {
    return "No se encontró la pestaña 'Informe de Gastos' en la hoja. Verifica que exista con ese nombre exacto.";
  }
  if (msg.includes("spreadsheet not found") || msg.includes("404") || msg.includes("no spreadsheet registered")) {
    return "No hay hoja registrada para este restaurante y mes. Agrega el ID en la variable SHEET_REGISTRY en Vercel.";
  }
  if (msg.includes("quota") || msg.includes("rate limit") || msg.includes("429")) {
    return "Se alcanzó el límite de solicitudes de Google Sheets. Espera unos segundos e intenta de nuevo.";
  }
  return raw;
}

// Restaurant is validated dynamically per tenant below; using string here.
const invoiceSchema = z.object({
  id: z.string(),
  restaurant: z.string().min(1),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((val) => {
    const d = new Date(val);
    return !isNaN(d.getTime()) && d.toISOString().startsWith(val);
  }, "Fecha inválida"),
  supplier: z.string().min(1),
  invoiceNumber: z.string().optional(),
  importe: z.number(),
  iva: z.number(),
  total: z.number(),
  concepto: z.string().min(1, "Concepto is required").refine((v) => validConceptos.has(v), "Concepto inválido"),
  cuentaPnl: z.string().min(1, "Cuenta P&L is required").refine((v) => validCuentasPnl.has(v), "Cuenta P&L inválida"),
  comments: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().nullable(),
    unit: z.string().nullable(),
    unitPrice: z.number().nullable(),
    total: z.number(),
  })).optional().default([]),
  extractionConfidence: z.number().optional(),
  extractionMethod: z.enum(["llm_vision", "llm_text"]),
});

const submitSchema = z.object({
  invoices: z.array(invoiceSchema).min(1),
  bypassDuplicates: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { invoices, bypassDuplicates } = parsed.data;
  const user = session.user;
  const tenantId = session.tenantId;
  const results: SubmitResult[] = [];
  let appended = 0;

  // Validate restaurant slugs against the tenant's registered locations
  if (tenantId) {
    const validSlugs = await getTenantRestaurantSlugs(tenantId);
    if (validSlugs.length > 0) {
      for (const invoice of invoices) {
        if (!validSlugs.includes(invoice.restaurant)) {
          return NextResponse.json(
            { error: `Restaurante inválido: "${invoice.restaurant}"` },
            { status: 422 }
          );
        }
      }
    }
  }

  for (const invoice of invoices as ExtractedInvoice[]) {
    try {
      const [yearStr, monthStr] = invoice.invoiceDate.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      let spreadsheetId: string;
      try {
        spreadsheetId = config.sheets.getSpreadsheetId(invoice.restaurant, year, month);
      } catch (err) {
        results.push({
          invoiceId: invoice.id,
          status: "error",
          error: err instanceof Error ? err.message : "Sheet not registered",
        });
        continue;
      }

      // Duplicate check — try Supabase first (fast, indexed), fall back to Sheets
      if (!bypassDuplicates) {
        let duplicates = await checkDuplicatesViaSupabase(invoice);
        if (duplicates === null) {
          // Supabase unavailable or empty — fall back to reading full sheet
          duplicates = await checkDuplicates(spreadsheetId, invoice);
        }
        if (duplicates.length > 0) {
          results.push({
            invoiceId: invoice.id,
            status: "duplicate_warning",
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
            duplicateMatches: duplicates,
          });
          continue;
        }
      }

      // Append to sheet
      const spreadsheetUrl = await appendToSheet(spreadsheetId, invoice);
      appended++;

      // Audit log (non-blocking)
      await appendAuditLog({
        user,
        restaurant: invoice.restaurant,
        invoiceDate: invoice.invoiceDate,
        supplier: invoice.supplier,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        status: bypassDuplicates ? "duplicate_bypassed" : "submitted",
      });

      results.push({
        invoiceId: invoice.id,
        status: "appended",
        spreadsheetUrl,
      });

      // Save invoice + line items to Supabase (awaited for data integrity)
      try {
        await saveInvoiceWithItems(invoice, spreadsheetUrl, user, tenantId);
      } catch (sbErr) {
        log.error({ ctx: "submit", msg: "Supabase save failed", data: { invoiceId: invoice.id }, err: sbErr });
        // Don't fail the request — Sheets write already succeeded
      }

      // Durable audit log to Supabase (awaited)
      try {
        const supabase = getSupabase();
        if (supabase) {
          await appendAuditEntries(supabase, [{
            action: bypassDuplicates ? "duplicate_bypassed" : "submitted",
            user,
            tenantId,
            restaurant: invoice.restaurant,
            supplier: invoice.supplier,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            total: invoice.total,
            spreadsheetUrl,
          }]);
        }
      } catch (auditErr) {
        log.error({ ctx: "submit", msg: "Audit log write failed", err: auditErr });
      }
    } catch (err) {
      log.error({ ctx: "submit", msg: "Invoice submit failed", data: { invoiceId: invoice.id }, err });
      results.push({
        invoiceId: invoice.id,
        status: "error",
        error: friendlySheetError(err instanceof Error ? err.message : ""),
      });
    }
  }

  const response: SubmitApiResponse = { results, appended };
  return NextResponse.json(response);
}
