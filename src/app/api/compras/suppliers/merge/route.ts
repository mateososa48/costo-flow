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

  // Update invoices table
  await supabase
    .from("invoices")
    .update({ supplier: into })
    .eq("supplier", from);

  // Update line_items table
  await supabase
    .from("line_items")
    .update({ supplier: into })
    .eq("supplier", from);

  // Transfer supplier tag if applicable
  const { data: existing } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .single();

  const tags = (existing?.value as Record<string, string>) ?? {};
  if (tags[from] && !tags[into]) {
    tags[into] = tags[from];
  }
  delete tags[from];

  await supabase
    .from("app_settings")
    .upsert({ key: SETTINGS_KEY, value: tags }, { onConflict: "key" });

  return NextResponse.json({ ok: true });
}
