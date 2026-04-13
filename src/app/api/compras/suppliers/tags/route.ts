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

  const tenantId = session.tenantId;
  let query = supabase.from("app_settings").select("value").eq("key", SETTINGS_KEY);
  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data } = await query.limit(1).single();
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
  const tenantId = session.tenantId;

  // Read current tags, merge, upsert
  let readQuery = supabase.from("app_settings").select("value").eq("key", SETTINGS_KEY);
  if (tenantId) readQuery = readQuery.eq("tenant_id", tenantId);
  const { data: existing } = await readQuery.limit(1).single();

  const current = (existing?.value as Record<string, string>) ?? {};
  if (supplyType) {
    current[supplier] = supplyType;
  } else {
    delete current[supplier];
  }

  await supabase
    .from("app_settings")
    .upsert(
      {
        key: SETTINGS_KEY,
        value: current,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      },
      { onConflict: "tenant_id,key" }
    );

  return NextResponse.json(current);
}
