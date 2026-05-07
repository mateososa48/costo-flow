import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";
import { normalizeUnit } from "@/lib/unit-normalizer";
import { isReadonly, readonlyForbidden } from "@/lib/authorization";

// POST /api/compras/line-items/backfill-units
// Re-normalizes unit_normalized for all line_items using the server-side normalizer.
// Safe to call multiple times (idempotent).
export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isReadonly(session)) return readonlyForbidden();

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  // Fetch all line items with their raw unit (scoped to tenant)
  let itemsQuery = supabase.from("line_items").select("id, unit");
  if (session.tenantId) itemsQuery = itemsQuery.eq("tenant_id", session.tenantId);
  const { data: items, error } = await itemsQuery;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let updated = 0;
  for (const item of items ?? []) {
    const normalized = normalizeUnit(item.unit as string | null);
    let updateQuery = supabase.from("line_items").update({ unit_normalized: normalized }).eq("id", item.id);
    if (session.tenantId) updateQuery = updateQuery.eq("tenant_id", session.tenantId);
    await updateQuery;
    updated++;
  }

  return NextResponse.json({ ok: true, itemsProcessed: updated });
}
