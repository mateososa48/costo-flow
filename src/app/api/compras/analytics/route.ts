import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const searchParams = request.nextUrl.searchParams;
  const restaurant = searchParams.get("restaurant");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  // Get food/bev invoice IDs — primary filter, avoids relying on cost_type default
  const { data: foodInvoices } = await supabase
    .from("invoices")
    .select("id")
    .in("cuenta_pnl", ["Costo de Alimentos", "Costo de Bebidas sin Alcohol"]);
  const foodInvoiceIds = (foodInvoices ?? []).map((i) => i.id as string);
  const foodFilter = foodInvoiceIds.length > 0
    ? `invoice_id.in.(${foodInvoiceIds.join(",")}),and(invoice_id.is.null,cost_type.in.(food,beverage))`
    : `cost_type.in.(food,beverage)`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("line_items")
    .select("invoice_date, category, total, description, ingredient_id, restaurant, supplier, invoice_id");
  query = query.or(foodFilter);

  if (restaurant) query = query.eq("restaurant", restaurant);
  if (dateFrom) query = query.gte("invoice_date", dateFrom);
  if (dateTo) query = query.lte("invoice_date", dateTo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = data ?? [];

  // ── KPIs ─────────────────────────────────────────────────────────────
  const totalSpend = items.reduce((s: number, i: { total?: unknown }) => s + Number(i.total ?? 0), 0);
  const uniqueInvoices = new Set(items.map((i: { invoice_id?: unknown }) => i.invoice_id).filter(Boolean)).size;
  const uniqueSuppliers = new Set(items.map((i: { supplier?: unknown }) => i.supplier)).size;
  const avgPerInvoice = uniqueInvoices > 0 ? totalSpend / uniqueInvoices : 0;
  const kpis = { totalSpend, uniqueInvoices, uniqueSuppliers, avgPerInvoice };

  // ── Monthly spend by category ─────────────────────────────────────────
  const monthlyMap: Record<string, Record<string, number>> = {};
  const categorySet = new Set<string>();

  for (const item of items) {
    if (!item.invoice_date) continue;
    const month = (item.invoice_date as string).slice(0, 7);
    const cat = (item.category as string | null) ?? "Sin categoría";
    categorySet.add(cat);
    if (!monthlyMap[month]) monthlyMap[month] = {};
    monthlyMap[month][cat] = (monthlyMap[month][cat] ?? 0) + Number(item.total ?? 0);
  }

  const sortedMonths = Object.keys(monthlyMap).sort();
  const categories = Array.from(categorySet).sort();

  const monthlySpend = sortedMonths.map((month) => {
    const entry: Record<string, string | number> = { month };
    for (const cat of categories) entry[cat] = monthlyMap[month][cat] ?? 0;
    return entry;
  });

  // ── Weekly trend ──────────────────────────────────────────────────────
  const weekMap: Record<string, number> = {};
  for (const item of items) {
    if (!item.invoice_date) continue;
    const d = new Date((item.invoice_date as string) + "T00:00:00");
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    weekMap[key] = (weekMap[key] ?? 0) + Number(item.total ?? 0);
  }
  const weeklyTrend = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, total]) => ({ week, total }));

  // ── Category totals for donut ─────────────────────────────────────────
  const categoryTotals: Record<string, number> = {};
  for (const item of items) {
    const cat = (item.category as string | null) ?? "Sin categoría";
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + Number(item.total ?? 0);
  }
  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ── Top suppliers ─────────────────────────────────────────────────────
  const supplierMap: Record<string, number> = {};
  for (const item of items) {
    const s = item.supplier as string;
    supplierMap[s] = (supplierMap[s] ?? 0) + Number(item.total ?? 0);
  }
  const spendBySupplier = Object.entries(supplierMap)
    .map(([supplier, total]) => ({ supplier, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  // ── Top 10 items ──────────────────────────────────────────────────────
  const itemMap: Record<string, { label: string; total: number; count: number }> = {};
  for (const item of items) {
    const key = (item.ingredient_id as string | null) ?? (item.description as string);
    const label = item.description as string;
    if (!itemMap[key]) itemMap[key] = { label, total: 0, count: 0 };
    itemMap[key].total += Number(item.total ?? 0);
    itemMap[key].count++;
  }
  const topItems = Object.values(itemMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((i) => ({ description: i.label, totalSpend: i.total, count: i.count }));

  // ── Spend by restaurant ───────────────────────────────────────────────
  const restaurantMap: Record<string, number> = {};
  for (const item of items) {
    const r = item.restaurant as string;
    restaurantMap[r] = (restaurantMap[r] ?? 0) + Number(item.total ?? 0);
  }
  const spendByRestaurant = Object.entries(restaurantMap).map(([restaurant, total]) => ({ restaurant, total }));

  return NextResponse.json({
    kpis,
    monthlySpend,
    categories,
    weeklyTrend,
    categoryBreakdown,
    spendBySupplier,
    topItems,
    spendByRestaurant,
  }, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
  });
}
