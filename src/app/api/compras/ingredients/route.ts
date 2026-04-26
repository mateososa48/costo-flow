import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

const createSchema = z.object({
  canonicalName: z.string().min(1),
  aliases: z.array(z.string()).optional().default([]),
  category: z.string().nullable().optional().default(null),
});

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("tenant_id", session.tenantId!)
    .order("canonical_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });

  const { canonicalName, aliases, category } = parsed.data;

  const { data, error } = await supabase
    .from("ingredients")
    .insert({ tenant_id: session.tenantId, canonical_name: canonicalName, aliases, category })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-assign to unmatched line items scoped to this tenant
  const allDescriptions = [canonicalName, ...aliases];
  for (const desc of allDescriptions) {
    await supabase
      .from("line_items")
      .update({ ingredient_id: data.id, ...(category ? { category } : {}) })
      .eq("tenant_id", session.tenantId!)
      .is("ingredient_id", null)
      .ilike("description", desc);
  }

  return NextResponse.json(data, { status: 201 });
}
