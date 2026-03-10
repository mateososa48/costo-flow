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

  // Fetch all line items in range (only the fields we need)
  let query = supabase
    .from("line_items")
    .select("invoice_date, category, total, description, ingredient_id, restaurant");

  if (restaurant) query = query.eq("restaurant", restaurant);
  if (dateFrom) query = query.gte("invoice_date", dateFrom);
  if (dateTo) query = query.lte("invoice_date", dateTo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = data ?? [];

  // ── Monthly spend by category ────────────────────────────────────
  // Returns last 12 months worth of data grouped by month + category
  const monthlyMap: Record<string, Record<string, number>> = {};
  const categorySet = new Set<string>();

  for (const item of items) {
    if (!item.invoice_date) continue;
    const month = (item.invoice_date as string).slice(0, 7); // yyyy-mm
    const cat = (item.category as string | null) ?? "Sin categoría";
    categorySet.add(cat);
    if (!monthlyMap[month]) monthlyMap[month] = {};
    monthlyMap[month][cat] = (monthlyMap[month][cat] ?? 0) + Number(item.total ?? 0);
  }

  const sortedMonths = Object.keys(monthlyMap).sort();
  const categories = Array.from(categorySet).sort();

  const monthlySpend = sortedMonths.map((month) => {
    const entry: Record<string, string | number> = { month };
    for (const cat of categories) {
      entry[cat] = monthlyMap[month][cat] ?? 0;
    }
    return entry;
  });

  // ── Top 10 items by spend ────────────────────────────────────────
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

  // ── Spend by restaurant ──────────────────────────────────────────
  const restaurantMap: Record<string, number> = {};
  for (const item of items) {
    const r = item.restaurant as string;
    restaurantMap[r] = (restaurantMap[r] ?? 0) + Number(item.total ?? 0);
  }
  const spendByRestaurant = Object.entries(restaurantMap).map(([restaurant, total]) => ({ restaurant, total }));

  return NextResponse.json({ monthlySpend, categories, topItems, spendByRestaurant });
}
