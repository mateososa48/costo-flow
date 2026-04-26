import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

const updateSchema = z.object({
  canonicalName: z.string().min(1).optional(),
  aliases: z.array(z.string()).optional(),
  category: z.string().nullable().optional(),
  defaultUnit: z.string().nullable().optional(),
  addAlias: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await params;
  const tenantId = session.tenantId!;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });

  const { canonicalName, aliases, category, defaultUnit, addAlias } = parsed.data;

  // Verify ownership before mutating
  const { data: existing, error: fetchError } = await supabase
    .from("ingredients")
    .select("aliases, category")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (fetchError || !existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (addAlias) {
    const currentAliases = (existing.aliases as string[]) ?? [];
    if (!currentAliases.includes(addAlias)) currentAliases.push(addAlias);

    const { data, error } = await supabase
      .from("ingredients")
      .update({ aliases: currentAliases })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const ingCategory = existing.category as string | null;
    await supabase
      .from("line_items")
      .update({ ingredient_id: id, ...(ingCategory ? { category: ingCategory } : {}) })
      .eq("tenant_id", tenantId)
      .is("ingredient_id", null)
      .ilike("description", addAlias);

    return NextResponse.json(data);
  }

  const updates: Record<string, unknown> = {};
  if (canonicalName !== undefined) updates.canonical_name = canonicalName;
  if (aliases !== undefined) updates.aliases = aliases;
  if (category !== undefined) updates.category = category;
  if (defaultUnit !== undefined) updates.default_unit = defaultUnit;

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

  const { data, error } = await supabase
    .from("ingredients")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (category !== undefined) {
    await supabase
      .from("line_items")
      .update({ category: category ?? null })
      .eq("tenant_id", tenantId)
      .eq("ingredient_id", id);
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await params;
  const tenantId = session.tenantId!;

  // Verify ownership
  const { data: existing } = await supabase
    .from("ingredients")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Unlink tenant's line items before deleting
  await supabase
    .from("line_items")
    .update({ ingredient_id: null })
    .eq("tenant_id", tenantId)
    .eq("ingredient_id", id);

  const { error } = await supabase
    .from("ingredients")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
