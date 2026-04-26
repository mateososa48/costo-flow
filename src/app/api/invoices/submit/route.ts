import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { appendToSheet } from "@/lib/sheets";
import { appendAuditEntries } from "@/lib/audit-log";
import dropdownOptions from "../../../../../data/dropdown_options.json";
import type { ExtractedInvoice, SubmitApiResponse, SubmitResult, SheetSyncStatus } from "@/types";
import getSupabase, { saveInvoiceWithItems, checkDuplicatesViaSupabase, type SheetSyncParams } from "@/lib/supabase";
import { getTenantRestaurantSlugs, getTenantSettings } from "@/lib/tenant";
import log from "@/lib/logger";

const validConceptos = new Set<string>(dropdownOptions.concepto as string[]);
const validCuentasPnl = new Set<string>(dropdownOptions.cuentaPnl as string[]);

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
    category: z.string().nullable().optional(),
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
  if (!session.isLoggedIn) {
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
  const user = session.email ?? "";
  const tenantId = session.tenantId;
  const results: SubmitResult[] = [];

  // Load sheet registry (optional — no sheet = skip sync, not an error)
  const tenantSettings = tenantId ? await getTenantSettings(tenantId) : null;
  const tenantRegistry = (tenantSettings?.sheetRegistry as Record<string, string>) ?? {};

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

  // ── Pass 1: duplicate checks (no writes) ───────────────────────────
  // All checks must pass before any invoice is committed. This prevents
  // partial saves: if invoice[0] is saved and invoice[1] is a duplicate,
  // re-submitting [0] would incorrectly flag it as a duplicate of itself.
  if (!bypassDuplicates) {
    const warnings: SubmitResult[] = [];
    for (const invoice of invoices as ExtractedInvoice[]) {
      const duplicates = await checkDuplicatesViaSupabase(invoice, tenantId);
      if (duplicates && duplicates.length > 0) {
        warnings.push({
          invoiceId: invoice.id,
          status: "duplicate_warning",
          duplicateMatches: duplicates,
        });
      }
    }
    if (warnings.length > 0) {
      return NextResponse.json({ results: warnings, saved: 0 });
    }
  }

  // ── Pass 2: save all (only reached when no duplicates / bypass=true) ─
  for (const invoice of invoices as ExtractedInvoice[]) {
    try {
      // ── Sheet sync (non-blocking — never fails the submission) ──
      const [yearStr, monthStr] = invoice.invoiceDate.split("-");
      const sheetKey = `${invoice.restaurant}_${yearStr}_${monthStr.padStart(2, "0")}`;
      const spreadsheetId = tenantRegistry[sheetKey];

      let sheetSync: SheetSyncParams = { status: "skipped" };

      if (spreadsheetId) {
        try {
          const sheetUrl = await appendToSheet(spreadsheetId, invoice);
          sheetSync = { status: "synced", sheetUrl };
        } catch (sheetErr) {
          const errMsg = sheetErr instanceof Error ? sheetErr.message : "Error desconocido";
          sheetSync = { status: "failed", error: errMsg };
          log.error({ ctx: "submit", msg: "Sheet sync failed (non-blocking)", data: { invoiceId: invoice.id, sheetKey }, err: sheetErr });
        }
      }

      // ── Save to Supabase (primary write) ──
      await saveInvoiceWithItems(invoice, user, tenantId, sheetSync);

      // ── Audit log (non-blocking) ──
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
            spreadsheetUrl: sheetSync.sheetUrl,
          }]);
        }
      } catch (auditErr) {
        log.error({ ctx: "submit", msg: "Audit log write failed", err: auditErr });
      }

      results.push({
        invoiceId: invoice.id,
        status: "saved",
        sheetSyncStatus: sheetSync.status as SheetSyncStatus,
        sheetUrl: sheetSync.sheetUrl,
      });

    } catch (err) {
      log.error({ ctx: "submit", msg: "Invoice submit failed", data: { invoiceId: invoice.id }, err });
      results.push({
        invoiceId: invoice.id,
        status: "error",
        error: err instanceof Error ? err.message : "Error al guardar la factura",
      });
    }
  }

  const saved = results.filter((r) => r.status === "saved").length;
  const response: SubmitApiResponse = { results, saved };
  return NextResponse.json(response);
}
