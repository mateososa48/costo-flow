import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { ExtractedInvoice } from "@/types";

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
    const { error: itemsError } = await supabase.from("line_items").insert(
      invoice.lineItems.map((item) => ({
        invoice_id: invoice.id,
        restaurant: invoice.restaurant,
        supplier: invoice.supplier,
        invoice_date: invoice.invoiceDate,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unitPrice,
        total: item.total,
      }))
    );

    if (itemsError) {
      throw new Error(`Supabase line_items insert failed: ${itemsError.message}`);
    }
  }
}
