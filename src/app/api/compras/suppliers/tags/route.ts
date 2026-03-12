import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

const SETTINGS_KEY = "supplier_tags";

const putSchema = z.object({
  supplier: z.string().min(1),
  supplyType: z.string(),
});

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .single();

  return NextResponse.json((data?.value as Record<string, string>) ?? {});
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 422 });

  const { supplier, supplyType } = parsed.data;

  // Read current tags, merge, upsert
  const { data: existing } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .single();

  const current = (existing?.value as Record<string, string>) ?? {};
  if (supplyType) {
    current[supplier] = supplyType;
  } else {
    delete current[supplier];
  }

  await supabase
    .from("app_settings")
    .upsert({ key: SETTINGS_KEY, value: current }, { onConflict: "key" });

  return NextResponse.json(current);
}
