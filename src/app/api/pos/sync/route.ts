export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { syncAll } from "@/lib/parrot";

/**
 * POST /api/pos/sync
 * Body: { startDate: string, endDate: string }  (ISO date strings, e.g. "2026-03-01")
 *
 * Syncs Parrot POS data for the given date window into Supabase.
 * Keep each request ≤7 days to stay within Vercel's 60s timeout.
 * The UI batches multiple 7-day windows sequentially.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { startDate, endDate } = body as { startDate?: string; endDate?: string };
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  // Normalize to full ISO timestamps
  const startTs = new Date(startDate).toISOString();
  const endTs = new Date(endDate + "T23:59:59.999Z").toISOString();

  try {
    const result = await syncAll(tenantId, startTs, endTs);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
