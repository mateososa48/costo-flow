import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";
import { getCostType } from "@/lib/cost-classification";

const patchSchema = z.object({
  concepto:  z.string().optional(),
  cuentaPnl: z.string().optional(),
  importe:   z.number().optional(),
  iva:       z.number().optional(),
  total:     z.number().optional(),
  comments:  z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await params;
  const tenantId = session.tenantId;

  let invQ = supabase.from("invoices").select("*").eq("id", id);
  if (tenantId) invQ = invQ.eq("tenant_id", tenantId);
  const { data: invoice, error } = await invQ.single();
  if (error || !invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let editsQ = supabase
    .from("invoice_edits")
    .select("id, edited_by, edited_at, changes")
    .eq("invoice_id", id)
    .order("edited_at", { ascending: false })
    .limit(5);
  if (tenantId) editsQ = editsQ.eq("tenant_id", tenantId);
  const { data: edits } = await editsQ;

  return NextResponse.json({ invoice, edits: edits ?? [] });
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await params;
  const tenantId = session.tenantId;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });

  // Fetch existing for ownership check + diff
  let existingQ = supabase.from("invoices").select("*").eq("id", id).is("deleted_at", null);
  if (tenantId) existingQ = existingQ.eq("tenant_id", tenantId);
  const { data: existing } = await existingQ.single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { concepto, cuentaPnl, importe, iva, total, comments } = parsed.data;

  // Build diff for audit log
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (concepto  !== undefined && concepto  !== existing.concepto)    changes.concepto   = { from: existing.concepto,    to: concepto  };
  if (cuentaPnl !== undefined && cuentaPnl !== existing.cuenta_pnl)  changes.cuenta_pnl = { from: existing.cuenta_pnl,  to: cuentaPnl };
  if (importe   !== undefined && importe   !== existing.importe)      changes.importe    = { from: existing.importe,     to: importe   };
  if (iva       !== undefined && iva       !== existing.iva)          changes.iva        = { from: existing.iva,         to: iva       };
  if (total     !== undefined && total     !== existing.total)        changes.total      = { from: existing.total,       to: total     };
  if (comments  !== undefined && comments  !== existing.comments)     changes.comments   = { from: existing.comments,    to: comments  };

  const updates: Record<string, unknown> = {};
  if (concepto  !== undefined) updates.concepto   = concepto  || null;
  if (cuentaPnl !== undefined) updates.cuenta_pnl = cuentaPnl || null;
  if (importe   !== undefined) updates.importe    = importe;
  if (iva       !== undefined) updates.iva        = iva;
  if (total     !== undefined) updates.total      = total;
  if (comments  !== undefined) updates.comments   = comments  || null;

  if (Object.keys(updates).length === 0) return NextResponse.json(existing);

  let updateQ = supabase.from("invoices").update(updates).eq("id", id).is("deleted_at", null);
  if (tenantId) updateQ = updateQ.eq("tenant_id", tenantId);
  const { data, error } = await updateQ.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cascade cost_type when cuenta_pnl changes
  if (cuentaPnl !== undefined && cuentaPnl !== existing.cuenta_pnl) {
    let cascadeQ = supabase.from("line_items").update({ cost_type: getCostType(cuentaPnl) }).eq("invoice_id", id);
    if (tenantId) cascadeQ = cascadeQ.eq("tenant_id", tenantId);
    await cascadeQ;
  }

  // Write audit entry when something actually changed
  if (Object.keys(changes).length > 0) {
    await supabase.from("invoice_edits").insert({
      invoice_id: id,
      ...(tenantId ? { tenant_id: tenantId } : {}),
      edited_by: session.email ?? "Sistema",
      changes,
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await params;
  const tenantId = session.tenantId;
  const now = new Date().toISOString();

  // Verify ownership
  let checkQ = supabase.from("invoices").select("id").eq("id", id).is("deleted_at", null);
  if (tenantId) checkQ = checkQ.eq("tenant_id", tenantId);
  const { data: check } = await checkQ.single();
  if (!check) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft-delete invoice
  let delQ = supabase.from("invoices").update({ deleted_at: now, deleted_by: session.email ?? "Sistema" }).eq("id", id);
  if (tenantId) delQ = delQ.eq("tenant_id", tenantId);
  const { error } = await delQ;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Soft-delete linked line items
  let delItemsQ = supabase.from("line_items").update({ deleted_at: now }).eq("invoice_id", id);
  if (tenantId) delItemsQ = delItemsQ.eq("tenant_id", tenantId);
  await delItemsQ;

  return NextResponse.json({ success: true });
}
