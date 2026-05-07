import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";
import { SUPPLIER_ALIASES_KEY } from "@/lib/supplier-aliases";
import { isReadonly, readonlyForbidden } from "@/lib/authorization";

const putSchema = z.object({
  displayName: z.string().min(1),
  canonicalNames: z.array(z.string().min(1)).min(1),
  oldDisplayName: z.string().optional(),
});

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isReadonly(session)) return readonlyForbidden();

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const tenantId = session.tenantId;
  let query = supabase.from("app_settings").select("value").eq("key", SUPPLIER_ALIASES_KEY);
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

  const { displayName, canonicalNames, oldDisplayName } = parsed.data;
  const tenantId = session.tenantId;

  let readQuery = supabase.from("app_settings").select("value").eq("key", SUPPLIER_ALIASES_KEY);
  if (tenantId) readQuery = readQuery.eq("tenant_id", tenantId);
  const { data: existing } = await readQuery.limit(1).single();

  const aliases = (existing?.value as Record<string, string>) ?? {};

  // Remove any raw names that were in the old group but are no longer in the new list
  if (oldDisplayName) {
    for (const [rawName, dn] of Object.entries(aliases)) {
      if (dn === oldDisplayName && !canonicalNames.includes(rawName)) {
        delete aliases[rawName];
      }
    }
    if (aliases[oldDisplayName] === oldDisplayName) delete aliases[oldDisplayName];
  }

  // Set the new mapping
  for (const rawName of canonicalNames) {
    if (rawName === displayName) {
      delete aliases[rawName];
    } else {
      aliases[rawName] = displayName;
    }
  }

  await supabase
    .from("app_settings")
    .upsert(
      {
        key: SUPPLIER_ALIASES_KEY,
        value: aliases,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      },
      { onConflict: "tenant_id,key" }
    );

  return NextResponse.json({ ok: true });
}
