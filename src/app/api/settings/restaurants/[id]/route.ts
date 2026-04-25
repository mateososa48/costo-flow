import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { label } = body as { label?: string };
  if (!label?.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  // Verify restaurant belongs to this tenant
  const { data: existing } = await supabase
    .from("restaurants")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", session.tenantId!)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  const { error } = await supabase
    .from("restaurants")
    .update({ label: label.trim() })
    .eq("id", id)
    .eq("tenant_id", session.tenantId!);

  if (error) {
    return NextResponse.json({ error: "Error al actualizar la sucursal" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
