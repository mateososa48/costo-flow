import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({});

  // Look back 90 days for baseline prices
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const dateStr = cutoff.toISOString().slice(0, 10);

  let priceQuery = supabase
    .from("line_items")
    .select("description, unit_price")
    .not("unit_price", "is", null)
    .gt("unit_price", 0)
    .gte("invoice_date", dateStr)
    .eq("cost_type", "food")
    .is("deleted_at", null)
    .limit(5000);
  if (session.tenantId) priceQuery = priceQuery.eq("tenant_id", session.tenantId);
  const { data } = await priceQuery;

  // Group by normalised description key
  const groups = new Map<string, number[]>();
  for (const row of data ?? []) {
    const key = (row.description as string).trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(Number(row.unit_price));
  }

  // Return median + count; only include descriptions with ≥2 data points
  const result: Record<string, { median: number; count: number }> = {};
  for (const [key, prices] of groups) {
    if (prices.length >= 2) {
      result[key] = { median: median(prices), count: prices.length };
    }
  }

  return NextResponse.json(result);
}
