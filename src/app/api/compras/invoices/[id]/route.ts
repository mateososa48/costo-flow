import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";
import { getCostType } from "@/lib/cost-classification";
import { appendAuditEntries } from "@/lib/audit-log";

const updateSchema = z.object({
  cuentaPnl: z.string().min(1),
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

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });

  const { cuentaPnl } = parsed.data;
  const costType = getCostType(cuentaPnl);

  // Fetch existing invoice for audit record
  const { data: existing } = await supabase
    .from("invoices")
    .select("id, restaurant, supplier, invoice_number, invoice_date, total, cuenta_pnl")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("invoices")
    .update({ cuenta_pnl: cuentaPnl })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cascade cost_type to all linked line items
  await supabase.from("line_items").update({ cost_type: costType }).eq("invoice_id", id);

  // Fire-and-forget audit log
  if (existing) {
    appendAuditEntries(supabase, [{
      action: "invoice_reclassified",
      user: session.user ?? "Sistema",
      restaurant: existing.restaurant as string,
      supplier: existing.supplier as string,
      invoiceId: existing.id as string,
      invoiceNumber: (existing.invoice_number as string | null) ?? undefined,
      invoiceDate: (existing.invoice_date as string | null) ?? undefined,
      total: Number(existing.total ?? 0),
      details: { from: (existing.cuenta_pnl as string | null) ?? "Sin categoría", to: cuentaPnl },
    }]).catch((err) => console.error("[audit-log] reclassify write failed:", err));
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

  // Fetch existing invoice for audit record
  const { data: existing } = await supabase
    .from("invoices")
    .select("id, restaurant, supplier, invoice_number, invoice_date, total")
    .eq("id", id)
    .single();

  // Delete line items first (in case there's no cascade)
  await supabase.from("line_items").delete().eq("invoice_id", id);

  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget audit log
  if (existing) {
    appendAuditEntries(supabase, [{
      action: "invoice_deleted",
      user: session.user ?? "Sistema",
      restaurant: existing.restaurant as string,
      supplier: existing.supplier as string,
      invoiceId: existing.id as string,
      invoiceNumber: (existing.invoice_number as string | null) ?? undefined,
      invoiceDate: (existing.invoice_date as string | null) ?? undefined,
      total: Number(existing.total ?? 0),
    }]).catch((err) => console.error("[audit-log] delete write failed:", err));
  }

  return NextResponse.json({ success: true });
}
