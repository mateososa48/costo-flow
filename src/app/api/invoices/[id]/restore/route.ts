import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await params;
  const tenantId = session.tenantId;

  // Verify it's actually deleted and belongs to this tenant
  let checkQ = supabase.from("invoices").select("id").eq("id", id).not("deleted_at", "is", null);
  if (tenantId) checkQ = checkQ.eq("tenant_id", tenantId);
  const { data: check } = await checkQ.single();
  if (!check) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let restoreQ = supabase.from("invoices").update({ deleted_at: null, deleted_by: null }).eq("id", id);
  if (tenantId) restoreQ = restoreQ.eq("tenant_id", tenantId);
  const { error } = await restoreQ;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let restoreItemsQ = supabase.from("line_items").update({ deleted_at: null }).eq("invoice_id", id);
  if (tenantId) restoreItemsQ = restoreItemsQ.eq("tenant_id", tenantId);
  await restoreItemsQ;

  return NextResponse.json({ success: true });
}
