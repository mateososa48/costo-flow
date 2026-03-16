import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

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
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  // Get all line items matching filters for aggregation
  let query = supabase.from("line_items").select("total, supplier");
  if (restaurant) query = query.eq("restaurant", restaurant);
  if (dateFrom) query = query.gte("invoice_date", dateFrom);
  if (dateTo) query = query.lte("invoice_date", dateTo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = data ?? [];
  const totalItems = items.length;
  const totalSpend = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const supplierSet = new Set<string>();
  for (const item of items) {
    if (item.supplier) supplierSet.add(item.supplier);
  }

  return NextResponse.json({
    totalItems,
    totalSpend,
    uniqueSuppliers: supplierSet.size,
    supplierList: Array.from(supplierSet).sort(),
  }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
