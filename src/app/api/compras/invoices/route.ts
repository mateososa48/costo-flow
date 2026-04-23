import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";
import { appendAuditEntries } from "@/lib/audit-log";
import log from "@/lib/logger";

const createInvoiceSchema = z.object({
  restaurant: z.string().min(1),
  supplier: z.string().min(1),
  invoiceNumber: z.string().optional().default(""),
  invoiceDate: z.string().min(1),
  importe: z.number().default(0),
  iva: z.number().default(0),
  total: z.number(),
  concepto: z.string().optional().default(""),
  cuentaPnl: z.string().optional().default(""),
  comments: z.string().optional().default(""),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });

  const { restaurant, supplier, invoiceNumber, invoiceDate, importe, iva, total, concepto, cuentaPnl, comments } = parsed.data;
  const tenantId = session.tenantId;

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      ...(tenantId ? { tenant_id: tenantId } : {}),
      restaurant,
      supplier,
      invoice_number: invoiceNumber || null,
      invoice_date: invoiceDate,
      importe,
      iva,
      total,
      concepto: concepto || null,
      cuenta_pnl: cuentaPnl || null,
      comments: comments || null,
      submitted_by: session.email ?? "Sistema",
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  appendAuditEntries(supabase, [{
    action: "invoice_added_manually",
    user: session.email ?? "Sistema",
    tenantId,
    restaurant,
    supplier,
    invoiceId: data.id as string,
    invoiceNumber: invoiceNumber || undefined,
    invoiceDate,
    total,
  }]).catch((err) => log.error({ ctx: "audit-log", msg: "Manual invoice audit write failed", err }));

  return NextResponse.json(data, { status: 201 });
}
