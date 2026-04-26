import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { appendToSheet } from "@/lib/sheets";
import getSupabase from "@/lib/supabase";
import { getTenantSettings } from "@/lib/tenant";
import log from "@/lib/logger";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  // Fetch the invoice
  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, tenant_id, restaurant, invoice_date, supplier, invoice_number, importe, iva, total, concepto, cuenta_pnl, comments")
    .eq("id", id)
    .eq("tenant_id", session.tenantId!)
    .single();

  if (fetchErr || !invoice) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  // Look up the sheet registry for this invoice's restaurant + month
  const tenantSettings = await getTenantSettings(session.tenantId!);
  const registry = (tenantSettings?.sheetRegistry as Record<string, string>) ?? {};

  const [yearStr, monthStr] = (invoice.invoice_date as string).split("-");
  const sheetKey = `${invoice.restaurant}_${yearStr}_${monthStr.padStart(2, "0")}`;
  const spreadsheetId = registry[sheetKey];

  if (!spreadsheetId) {
    return NextResponse.json({
      sheetSyncStatus: "skipped",
      error: `No hay hoja registrada para "${sheetKey}"`,
    });
  }

  // Attempt sync
  try {
    const sheetUrl = await appendToSheet(spreadsheetId, {
      id: invoice.id as string,
      restaurant: invoice.restaurant as string,
      invoiceDate: invoice.invoice_date as string,
      supplier: invoice.supplier as string,
      invoiceNumber: invoice.invoice_number as string | undefined,
      importe: Number(invoice.importe),
      iva: Number(invoice.iva),
      total: Number(invoice.total),
      concepto: invoice.concepto as string,
      cuentaPnl: invoice.cuenta_pnl as string,
      comments: invoice.comments as string | undefined,
      extractionMethod: "llm_vision",
    });

    await supabase
      .from("invoices")
      .update({
        sheet_sync_status: "synced",
        sheet_sync_error: null,
        sheet_synced_at: new Date().toISOString(),
        spreadsheet_url: sheetUrl,
      })
      .eq("id", id);

    return NextResponse.json({ sheetSyncStatus: "synced", sheetUrl });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Error desconocido";
    log.error({ ctx: "sync-sheet", msg: "Re-sync failed", data: { invoiceId: id }, err });

    await supabase
      .from("invoices")
      .update({
        sheet_sync_status: "failed",
        sheet_sync_error: errMsg,
      })
      .eq("id", id);

    return NextResponse.json({ sheetSyncStatus: "failed", error: errMsg });
  }
}
