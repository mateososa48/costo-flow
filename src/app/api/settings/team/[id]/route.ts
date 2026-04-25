import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

const VALID_ROLES = ["admin", "member", "readonly"] as const;
type Role = (typeof VALID_ROLES)[number];

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

  const { role } = body as { role?: string };
  if (!role || !VALID_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  // Fetch the row being changed
  const { data: target } = await supabase
    .from("tenant_users")
    .select("id, user_id, role")
    .eq("id", id)
    .eq("tenant_id", session.tenantId!)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Prevent demoting yourself if you're the only admin
  if (target.user_id === session.userId && role !== "admin") {
    const { count } = await supabase
      .from("tenant_users")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", session.tenantId!)
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "No puedes degradarte si eres el único administrador" },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from("tenant_users")
    .update({ role })
    .eq("id", id)
    .eq("tenant_id", session.tenantId!);

  if (error) {
    return NextResponse.json({ error: "Error al actualizar el rol" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
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

  // Fetch the row being deleted
  const { data: target } = await supabase
    .from("tenant_users")
    .select("id, user_id, role")
    .eq("id", id)
    .eq("tenant_id", session.tenantId!)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Prevent removing yourself if you're the only admin
  if (target.user_id === session.userId) {
    const { count } = await supabase
      .from("tenant_users")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", session.tenantId!)
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "No puedes eliminarte si eres el único administrador" },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from("tenant_users")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenantId!);

  if (error) {
    return NextResponse.json({ error: "Error al eliminar el usuario" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
