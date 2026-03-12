import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

const filtersSchema = z.object({
  view: z.enum(["invoices", "suppliers", "analytics"]).default("invoices"),
  restaurant: z.string().optional(),
  supplier: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

// Non-food cuentaPnl values (operational expenses)
const OPERATIONAL_CUENTAPNL = [
  "Mantenimiento", "Mobiliario", "Renta", "Gas", "Varios de Administración",
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = filtersSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid parameters" }, { status: 422 });

  const { view, restaurant, supplier, dateFrom, dateTo, sortDir, page, pageSize } = parsed.data;

  if (view === "invoices") {
    let query = supabase.from("invoices").select("*", { count: "exact" })
      .not("cuenta_pnl", "in", `(Costo de Alimentos,Costo de Bebidas sin Alcohol)`);

    if (restaurant) query = query.eq("restaurant", restaurant);
    if (supplier) query = query.ilike("supplier", `%${supplier}%`);
    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);
    query = query.order("invoice_date", { ascending: sortDir === "asc" });
    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data: invoices, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch line items for each invoice
    const invoiceIds = (invoices ?? []).map((inv) => inv.id);
    const itemsByInvoice: Record<string, unknown[]> = {};
    if (invoiceIds.length > 0) {
      const { data: lineItems } = await supabase
        .from("line_items")
        .select("*")
        .in("invoice_id", invoiceIds)
        .order("created_at", { ascending: true });
      for (const item of lineItems ?? []) {
        const key = item.invoice_id as string;
        if (!itemsByInvoice[key]) itemsByInvoice[key] = [];
        itemsByInvoice[key].push(item);
      }
    }

    const invoicesWithItems = (invoices ?? []).map((inv) => ({
      ...inv,
      lineItems: itemsByInvoice[inv.id] ?? [],
    }));

    return NextResponse.json({
      invoices: invoicesWithItems,
      pagination: { page, pageSize, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / pageSize) },
    });
  }

  if (view === "suppliers") {
    let query = supabase.from("invoices").select("id, supplier, total, invoice_date, restaurant, cuenta_pnl, concepto, invoice_number")
      .not("cuenta_pnl", "in", `(Costo de Alimentos,Costo de Bebidas sin Alcohol)`);

    if (restaurant) query = query.eq("restaurant", restaurant);
    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);
    query = query.order("invoice_date", { ascending: false });

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type InvRow = { id: string; supplier: string; total: number; invoice_date: string; restaurant: string; cuenta_pnl: string | null; concepto: string | null; invoice_number: string | null };
    const grouped: Record<string, { supplier: string; totalSpend: number; invoiceCount: number; invoices: InvRow[] }> = {};
    for (const inv of (data ?? []) as InvRow[]) {
      const s = inv.supplier;
      if (!grouped[s]) grouped[s] = { supplier: s, totalSpend: 0, invoiceCount: 0, invoices: [] };
      grouped[s].totalSpend += Number(inv.total) || 0;
      grouped[s].invoiceCount++;
      grouped[s].invoices.push(inv);
    }
    const suppliers = Object.values(grouped).sort((a, b) =>
      sortDir === "desc" ? b.totalSpend - a.totalSpend : a.totalSpend - b.totalSpend
    );
    const total = suppliers.length;
    return NextResponse.json({
      suppliers: suppliers.slice((page - 1) * pageSize, page * pageSize),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }

  if (view === "analytics") {
    let query = supabase.from("invoices").select("invoice_date, total, cuenta_pnl, concepto, supplier, restaurant")
      .not("cuenta_pnl", "in", `(Costo de Alimentos,Costo de Bebidas sin Alcohol)`);

    if (restaurant) query = query.eq("restaurant", restaurant);
    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = data ?? [];
    const totalSpend = items.reduce((s, i) => s + Number(i.total ?? 0), 0);
    const uniqueSuppliers = new Set(items.map((i) => i.supplier)).size;
    const kpis = { totalSpend, invoiceCount: items.length, uniqueSuppliers };

    // Monthly by cuentaPnl
    const monthlyMap: Record<string, Record<string, number>> = {};
    const cuentaSet = new Set<string>();
    for (const item of items) {
      if (!item.invoice_date) continue;
      const month = (item.invoice_date as string).slice(0, 7);
      const cuenta = (item.cuenta_pnl as string) ?? "Otros";
      cuentaSet.add(cuenta);
      if (!monthlyMap[month]) monthlyMap[month] = {};
      monthlyMap[month][cuenta] = (monthlyMap[month][cuenta] ?? 0) + Number(item.total ?? 0);
    }
    const sortedMonths = Object.keys(monthlyMap).sort();
    const cuentas = Array.from(cuentaSet).sort();
    const monthlySpend = sortedMonths.map((month) => {
      const entry: Record<string, string | number> = { month };
      for (const c of cuentas) entry[c] = monthlyMap[month][c] ?? 0;
      return entry;
    });

    // Breakdown by cuentaPnl
    const cuentaTotals: Record<string, number> = {};
    for (const item of items) {
      const c = (item.cuenta_pnl as string) ?? "Otros";
      cuentaTotals[c] = (cuentaTotals[c] ?? 0) + Number(item.total ?? 0);
    }
    const breakdown = Object.entries(cuentaTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Top suppliers
    const supplierMap: Record<string, number> = {};
    for (const item of items) {
      const s = item.supplier as string;
      supplierMap[s] = (supplierMap[s] ?? 0) + Number(item.total ?? 0);
    }
    const topSuppliers = Object.entries(supplierMap)
      .map(([supplier, total]) => ({ supplier, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return NextResponse.json({ kpis, monthlySpend, cuentas, breakdown, topSuppliers });
  }

  return NextResponse.json({ error: "Invalid view" }, { status: 400 });
}
