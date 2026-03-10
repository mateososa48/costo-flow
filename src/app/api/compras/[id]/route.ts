import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  unitNormalized: z.string().nullable().optional(),
  unitPrice: z.number().nullable().optional(),
  total: z.number().optional(),
  category: z.string().nullable().optional(),
  supplier: z.string().min(1).optional(),
  restaurant: z.string().min(1).optional(),
  invoiceDate: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.description !== undefined) updates.description = d.description;
  if (d.quantity !== undefined) updates.quantity = d.quantity;
  if (d.unit !== undefined) updates.unit = d.unit;
  if (d.unitNormalized !== undefined) updates.unit_normalized = d.unitNormalized;
  if (d.unitPrice !== undefined) updates.unit_price = d.unitPrice;
  if (d.total !== undefined) updates.total = d.total;
  if (d.category !== undefined) updates.category = d.category;
  if (d.supplier !== undefined) updates.supplier = d.supplier;
  if (d.restaurant !== undefined) updates.restaurant = d.restaurant;
  if (d.invoiceDate !== undefined) updates.invoice_date = d.invoiceDate;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("line_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from("line_items")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
