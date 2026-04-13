import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

const SETTINGS_KEY = "supplier_tags";

const bodySchema = z.object({
  from: z.string().min(1),
  into: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 422 });

  const { from, into } = parsed.data;
  if (from === into) return NextResponse.json({ error: "Cannot merge a supplier into itself" }, { status: 422 });

  const tenantId = session.tenantId;

  // Update invoices table (scoped to tenant)
  let invQ = supabase.from("invoices").update({ supplier: into }).eq("supplier", from);
  if (tenantId) invQ = invQ.eq("tenant_id", tenantId);
  await invQ;

  // Update line_items table (scoped to tenant)
  let liQ = supabase.from("line_items").update({ supplier: into }).eq("supplier", from);
  if (tenantId) liQ = liQ.eq("tenant_id", tenantId);
  await liQ;

  // Transfer supplier tag if applicable
  let tagsQ = supabase.from("app_settings").select("value").eq("key", SETTINGS_KEY);
  if (tenantId) tagsQ = tagsQ.eq("tenant_id", tenantId);
  const { data: existing } = await tagsQ.limit(1).single();

  const tags = (existing?.value as Record<string, string>) ?? {};
  if (tags[from] && !tags[into]) {
    tags[into] = tags[from];
  }
  delete tags[from];

  await supabase
    .from("app_settings")
    .upsert(
      {
        key: SETTINGS_KEY,
        value: tags,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      },
      { onConflict: "tenant_id,key" }
    );

  return NextResponse.json({ ok: true });
}
