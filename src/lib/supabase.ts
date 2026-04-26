import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { ExtractedInvoice, DuplicateMatch } from "@/types";
import { getCostType } from "@/lib/cost-classification";
import { normalizeUnit } from "@/lib/unit-normalizer";

let _client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  if (!_client) {
    _client = createClient(url, key);
  }
  return _client;
}

export default getSupabase;

export type SheetSyncParams = {
  status: "synced" | "failed" | "skipped";
  sheetUrl?: string;
  error?: string;
};

/**
 * Save invoice header + line items to Supabase (primary write).
 * sheetSync describes the outcome of the optional Sheets export that
 * already happened (or was skipped) before this call.
 */
export async function saveInvoiceWithItems(
  invoice: ExtractedInvoice,
  submittedBy: string,
  tenantId?: string,
  sheetSync: SheetSyncParams = { status: "skipped" }
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const now = new Date().toISOString();

  // Upsert invoice header (idempotent on id)
  const { error: invoiceError } = await supabase.from("invoices").upsert(
    {
      id: invoice.id,
      ...(tenantId ? { tenant_id: tenantId } : {}),
      restaurant: invoice.restaurant,
      supplier: invoice.supplier,
      invoice_number: invoice.invoiceNumber || null,
      invoice_date: invoice.invoiceDate,
      importe: invoice.importe,
      iva: invoice.iva,
      total: invoice.total,
      concepto: invoice.concepto,
      cuenta_pnl: invoice.cuentaPnl,
      submitted_by: submittedBy,
      // Sheet sync state (written once; updated later by re-sync endpoint)
      sheet_sync_status: sheetSync.status,
      sheet_sync_error: sheetSync.error ?? null,
      sheet_synced_at: sheetSync.status === "synced" ? now : null,
      // Keep spreadsheet_url for backwards compat with existing rows
      ...(sheetSync.sheetUrl ? { spreadsheet_url: sheetSync.sheetUrl } : {}),
    },
    { onConflict: "id" }
  );

  if (invoiceError) {
    throw new Error(`Supabase invoice upsert failed: ${invoiceError.message}`);
  }

  if (!invoice.lineItems || invoice.lineItems.length === 0) return;

  // Fetch existing ingredients for auto-matching
  const { data: ingredients } = await supabase
    .from("ingredients")
    .select("id, canonical_name, aliases");

  function matchIngredient(description: string): string | null {
    if (!ingredients) return null;
    const lower = description.toLowerCase().trim();
    for (const ing of ingredients) {
      if ((ing.canonical_name as string).toLowerCase().trim() === lower) return ing.id as string;
      const aliases = (ing.aliases as string[]) ?? [];
      if (aliases.some((a) => a.toLowerCase().trim() === lower)) return ing.id as string;
    }
    return null;
  }

  const costType = getCostType(invoice.cuentaPnl);

  // Upsert line items with line_index for idempotency
  const { error: itemsError } = await supabase.from("line_items").upsert(
    invoice.lineItems.map((item, idx) => ({
      invoice_id: invoice.id,
      line_index: idx,
      ...(tenantId ? { tenant_id: tenantId } : {}),
      restaurant: invoice.restaurant,
      supplier: invoice.supplier,
      invoice_date: invoice.invoiceDate,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_normalized: normalizeUnit(item.unit),
      unit_price: item.unitPrice,
      total: item.total,
      category: item.category ?? null,
      ingredient_id: matchIngredient(item.description),
      cost_type: costType,
    })),
    { onConflict: "tenant_id,invoice_id,line_index" }
  );

  if (itemsError) {
    throw new Error(`Supabase line_items upsert failed: ${itemsError.message}`);
  }
}

/**
 * Check for duplicate invoices via Supabase (fast, indexed).
 * Matches same supplier + same month + (same invoice_number OR same total).
 * Returns null if Supabase is unavailable or has no data (caller should fall back to Sheets).
 */
export async function checkDuplicatesViaSupabase(
  invoice: ExtractedInvoice
): Promise<DuplicateMatch[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [yearStr, monthStr] = invoice.invoiceDate.split("-");
  const monthStart = `${yearStr}-${monthStr}-01`;
  const nextMonth = Number(monthStr) === 12
    ? `${Number(yearStr) + 1}-01-01`
    : `${yearStr}-${String(Number(monthStr) + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("invoices")
    .select("supplier, invoice_number, total, invoice_date")
    .ilike("supplier", invoice.supplier.trim())
    .gte("invoice_date", monthStart)
    .lt("invoice_date", nextMonth);

  // If table doesn't exist or query fails, signal caller to use Sheets fallback
  if (error) return null;
  if (!data || data.length === 0) return null;

  const matches: DuplicateMatch[] = [];
  for (const row of data) {
    const invoiceNumberMatch =
      invoice.invoiceNumber &&
      row.invoice_number &&
      row.invoice_number.trim() === invoice.invoiceNumber.trim();
    const totalMatch = Math.abs(Number(row.total) - invoice.total) < 0.01;

    if (invoiceNumberMatch || totalMatch) {
      matches.push({
        supplier: row.supplier,
        invoiceNumber: row.invoice_number || undefined,
        total: Number(row.total),
        invoiceDate: row.invoice_date,
      });
    }
  }

  return matches;
}
