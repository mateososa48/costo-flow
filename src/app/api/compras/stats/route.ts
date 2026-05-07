import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";
import { loadFoodData, summarizeFoodData } from "@/lib/analytics/food-cost";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const restaurant = searchParams.get("restaurant");
  const supplier = searchParams.get("supplier");
  const search = searchParams.get("search");
  const category = searchParams.get("category");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const data = await loadFoodData(supabase, session.tenantId, {
    restaurant: restaurant ?? undefined,
    supplier: supplier ?? undefined,
    search: search ?? undefined,
    category: category ?? undefined,
    dateFrom: dateFrom ?? undefined,
    dateTo: dateTo ?? undefined,
  });
  const summary = summarizeFoodData(data.items, data.invoices);
  const supplierSet = new Set<string>();
  for (const item of data.items) supplierSet.add(item.supplier);

  return NextResponse.json({
    totalItems: summary.itemCount,
    totalSpend: summary.totalSpend,
    uniqueSuppliers: summary.supplierCount,
    supplierList: Array.from(supplierSet).sort(),
  }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
