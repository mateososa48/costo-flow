import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";
import { buildFoodCostAnalytics } from "@/lib/analytics/food-cost";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const searchParams = request.nextUrl.searchParams;
  const filters = {
    restaurant: searchParams.get("restaurant") ?? undefined,
    supplier: searchParams.get("supplier") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  };

  try {
    const analytics = await buildFoodCostAnalytics(supabase, session.tenantId, filters);

    return NextResponse.json({
      kpis: {
        totalSpend: analytics.kpis.totalSpend,
        uniqueInvoices: analytics.kpis.invoiceCount,
        uniqueSuppliers: analytics.kpis.supplierCount,
        avgPerInvoice: analytics.kpis.avgPerInvoice,
      },
      monthlySpend: [],
      categories: analytics.categories.map((category) => category.name),
      weeklyTrend: analytics.trend,
      categoryBreakdown: analytics.categories.map((category) => ({ name: category.name, value: category.total })),
      spendBySupplier: analytics.suppliers.map((supplier) => ({ supplier: supplier.supplier, total: supplier.total })),
      topItems: analytics.topItems.map((item) => ({ description: item.label, totalSpend: item.total, count: item.count })),
      spendByRestaurant: analytics.restaurants.map((restaurant) => ({ restaurant: restaurant.restaurant, total: restaurant.total })),
    }, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al cargar análisis de compras" },
      { status: 500 }
    );
  }
}
