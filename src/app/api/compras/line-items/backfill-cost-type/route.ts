import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";
import { getCostType } from "@/lib/cost-classification";
import { isReadonly, readonlyForbidden } from "@/lib/authorization";

// POST /api/compras/line-items/backfill-cost-type
// For each invoice, derives cost_type from cuenta_pnl and stamps all its line_items.
// Safe to call multiple times (idempotent).
export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isReadonly(session)) return readonlyForbidden();

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  // Fetch all invoices with their cuenta_pnl (scoped to tenant)
  let invQuery = supabase.from("invoices").select("id, cuenta_pnl");
  if (session.tenantId) invQuery = invQuery.eq("tenant_id", session.tenantId);
  const { data: invoices, error: invError } = await invQuery;

  if (invError) return NextResponse.json({ error: invError.message }, { status: 500 });

  let updated = 0;
  for (const inv of invoices ?? []) {
    const costType = getCostType((inv.cuenta_pnl as string) ?? "");
    let updateQuery = supabase.from("line_items").update({ cost_type: costType }).eq("invoice_id", inv.id);
    if (session.tenantId) updateQuery = updateQuery.eq("tenant_id", session.tenantId);
    await updateQuery;
    updated++;
  }

  return NextResponse.json({ ok: true, invoicesProcessed: updated });
}
