import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";
import { toCSV } from "@/lib/csv";

const LINE_ITEM_COLUMNS = [
  { key: "invoice_date", label: "Fecha" },
  { key: "restaurant", label: "Restaurante" },
  { key: "supplier", label: "Proveedor" },
  { key: "description", label: "Artículo" },
  { key: "quantity", label: "Cantidad" },
  { key: "unit", label: "Unidad" },
  { key: "unit_price", label: "Precio Unitario" },
  { key: "total", label: "Total" },
  { key: "category", label: "Categoría" },
];

const INVOICE_COLUMNS = [
  { key: "invoice_date", label: "Fecha" },
  { key: "restaurant", label: "Restaurante" },
  { key: "supplier", label: "Proveedor" },
  { key: "invoice_number", label: "# Factura" },
  { key: "importe", label: "Importe" },
  { key: "iva", label: "IVA" },
  { key: "total", label: "Total" },
  { key: "concepto", label: "Concepto" },
  { key: "cuenta_pnl", label: "Cuenta P&L" },
  { key: "submitted_by", label: "Enviado por" },
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const params = request.nextUrl.searchParams;
  const type = params.get("type") ?? "items"; // "items" or "invoices"
  const restaurant = params.get("restaurant");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const supplier = params.get("supplier");

  if (type === "invoices") {
    let query = supabase.from("invoices").select("*").order("invoice_date", { ascending: false });
    if (restaurant) query = query.eq("restaurant", restaurant);
    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);
    if (supplier) query = query.ilike("supplier", `%${supplier}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const csv = toCSV((data ?? []) as Record<string, unknown>[], INVOICE_COLUMNS);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="facturas-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  // Default: line items
  let query = supabase.from("line_items")
    .select("invoice_date, restaurant, supplier, description, quantity, unit, unit_price, total, category")
    .order("invoice_date", { ascending: false });
  if (restaurant) query = query.eq("restaurant", restaurant);
  if (dateFrom) query = query.gte("invoice_date", dateFrom);
  if (dateTo) query = query.lte("invoice_date", dateTo);
  if (supplier) query = query.ilike("supplier", `%${supplier}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const csv = toCSV((data ?? []) as Record<string, unknown>[], LINE_ITEM_COLUMNS);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="articulos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
