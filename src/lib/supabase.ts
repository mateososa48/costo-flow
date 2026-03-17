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

/**
 * Save invoice header + line items to Supabase.
 * Fire-and-forget — caller should .catch() errors.
 */
export async function saveInvoiceWithItems(
  invoice: ExtractedInvoice,
  spreadsheetUrl: string,
  submittedBy: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  // Upsert invoice header (dedup on id)
  const { error: invoiceError } = await supabase.from("invoices").upsert(
    {
      id: invoice.id,
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
      spreadsheet_url: spreadsheetUrl,
    },
    { onConflict: "id" }
  );

  if (invoiceError) {
    throw new Error(`Supabase invoice upsert failed: ${invoiceError.message}`);
  }

  // Insert line items
  if (invoice.lineItems && invoice.lineItems.length > 0) {
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

    const { error: itemsError } = await supabase.from("line_items").insert(
      invoice.lineItems.map((item) => ({
        invoice_id: invoice.id,
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
      }))
    );

    if (itemsError) {
      throw new Error(`Supabase line_items insert failed: ${itemsError.message}`);
    }
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
