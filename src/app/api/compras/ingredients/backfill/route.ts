import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

// POST /api/compras/ingredients/backfill
// Propagates each tenant ingredient's category to all linked line_items.
export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: ingredients, error } = await supabase
    .from("ingredients")
    .select("id, category")
    .eq("tenant_id", session.tenantId!)
    .not("category", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let updated = 0;
  for (const ing of ingredients ?? []) {
    await supabase
      .from("line_items")
      .update({ category: ing.category })
      .eq("tenant_id", session.tenantId!)
      .eq("ingredient_id", ing.id);
    updated++;
  }

  return NextResponse.json({ ok: true, updatedLineItems: updated });
}
