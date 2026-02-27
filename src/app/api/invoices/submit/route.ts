import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { config } from "@/config";
import { appendToSheet, checkDuplicates, appendAuditLog } from "@/lib/sheets";
import type { ExtractedInvoice, SubmitApiResponse, SubmitResult } from "@/types";

const invoiceSchema = z.object({
  id: z.string(),
  restaurant: z.enum(["motin_juarez", "motin_roma", "queseria"]),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supplier: z.string().min(1),
  invoiceNumber: z.string().optional(),
  importe: z.number(),
  iva: z.number(),
  total: z.number(),
  concepto: z.string().min(1, "Concepto is required"),
  cuentaPnl: z.string().min(1, "Cuenta P&L is required"),
  comments: z.string().optional(),
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
  const results: SubmitResult[] = [];
  let appended = 0;

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

      // Duplicate check
      if (!bypassDuplicates) {
        const duplicates = await checkDuplicates(spreadsheetId, invoice);
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
    } catch (err) {
      console.error(`[submit] Error for invoice ${invoice.id}:`, err);
      results.push({
        invoiceId: invoice.id,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const response: SubmitApiResponse = { results, appended };
  return NextResponse.json(response);
}
