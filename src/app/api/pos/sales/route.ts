export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import getSupabase from "@/lib/supabase";

export type DailyRevenue = { date: string; total: number; orders: number };
export type ProviderBreakdown = { provider: string; total: number; orders: number };
export type TopItem = { item_name: string; quantity: number; revenue: number };
export type CashierSessionRow = {
  uuid: string;
  session_number: string | null;
  state: string | null;
  started_at: string | null;
  finished_at: string | null;
  total_sales: number | null;
};

export type SalesData = {
  totalRevenue: number;
  totalOrders: number;
  avgTicket: number;
  dailyRevenue: DailyRevenue[];
  providerBreakdown: ProviderBreakdown[];
  topItems: TopItem[];
  cashierSessions: CashierSessionRow[];
  lastSyncedAt: string | null;
};

/**
 * GET /api/pos/sales?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 *
 * Returns aggregated POS sales data from Supabase for the given date range.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: "dateFrom and dateTo required" }, { status: 400 });
  }

  const fromTs = new Date(dateFrom).toISOString();
  const toTs = new Date(dateTo + "T23:59:59.999Z").toISOString();

  // ── Orders ─────────────────────────────────────────────────────────────────
  const { data: orders, error: ordersError } = await supabase
    .from("pos_orders")
    .select("uuid, created_at, total, provider, status")
    .eq("tenant_id", tenantId)
    .gte("created_at", fromTs)
    .lte("created_at", toTs)
    .neq("status", "CANCELLED");

  // If the POS tables don't exist yet (migration not applied), return empty data
  if (ordersError) {
    const isTableMissing = ordersError.message.includes("does not exist") || ordersError.message.includes("schema cache");
    if (isTableMissing) return NextResponse.json({
      totalRevenue: 0, totalOrders: 0, avgTicket: 0,
      dailyRevenue: [], providerBreakdown: [], topItems: [], cashierSessions: [], lastSyncedAt: null,
    } satisfies SalesData);
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  // ── Order Items ─────────────────────────────────────────────────────────────
  const { data: items, error: itemsError } = await supabase
    .from("pos_order_items")
    .select("item_name, quantity, total, provider")
    .eq("tenant_id", tenantId)
    .gte("created_at", fromTs)
    .lte("created_at", toTs)
    .neq("item_status", "CANCELLED");

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  // ── Cashier Sessions ────────────────────────────────────────────────────────
  const { data: sessions, error: sessionsError } = await supabase
    .from("pos_cashier_sessions")
    .select("uuid, session_number, state, started_at, finished_at, total_sales")
    .eq("tenant_id", tenantId)
    .gte("started_at", fromTs)
    .lte("started_at", toTs)
    .order("started_at", { ascending: false })
    .limit(50);

  if (sessionsError) return NextResponse.json({ error: sessionsError.message }, { status: 500 });

  // ── Last sync timestamp ─────────────────────────────────────────────────────
  const { data: lastSync } = await supabase
    .from("pos_sync_log")
    .select("synced_at")
    .eq("tenant_id", tenantId)
    .is("error", null)
    .order("synced_at", { ascending: false })
    .limit(1)
    .single();

  // ── Aggregations ─────────────────────────────────────────────────────────────

  // Daily revenue
  const dailyMap = new Map<string, { total: number; orders: number }>();
  for (const o of orders ?? []) {
    const day = (o.created_at as string).slice(0, 10);
    const cur = dailyMap.get(day) ?? { total: 0, orders: 0 };
    cur.total += (o.total as number) ?? 0;
    cur.orders += 1;
    dailyMap.set(day, cur);
  }
  const dailyRevenue: DailyRevenue[] = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Provider breakdown
  const providerMap = new Map<string, { total: number; orders: number }>();
  for (const o of orders ?? []) {
    const prov = (o.provider as string) ?? "UNKNOWN";
    const cur = providerMap.get(prov) ?? { total: 0, orders: 0 };
    cur.total += (o.total as number) ?? 0;
    cur.orders += 1;
    providerMap.set(prov, cur);
  }
  const providerBreakdown: ProviderBreakdown[] = Array.from(providerMap.entries())
    .map(([provider, v]) => ({ provider, ...v }))
    .sort((a, b) => b.total - a.total);

  // Top items by revenue
  const itemMap = new Map<string, { quantity: number; revenue: number }>();
  for (const i of items ?? []) {
    const name = (i.item_name as string) ?? "—";
    const cur = itemMap.get(name) ?? { quantity: 0, revenue: 0 };
    cur.quantity += (i.quantity as number) ?? 0;
    cur.revenue += (i.total as number) ?? 0;
    itemMap.set(name, cur);
  }
  const topItems: TopItem[] = Array.from(itemMap.entries())
    .map(([item_name, v]) => ({ item_name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  // Summary KPIs
  const totalRevenue = (orders ?? []).reduce((s, o) => s + ((o.total as number) ?? 0), 0);
  const totalOrders = orders?.length ?? 0;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const result: SalesData = {
    totalRevenue,
    totalOrders,
    avgTicket,
    dailyRevenue,
    providerBreakdown,
    topItems,
    cashierSessions: (sessions ?? []) as CashierSessionRow[],
    lastSyncedAt: (lastSync?.synced_at as string) ?? null,
  };

  return NextResponse.json(result);
}
