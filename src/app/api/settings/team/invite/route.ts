import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

const VALID_ROLES = ["admin", "member", "readonly"] as const;
type Role = (typeof VALID_ROLES)[number];

export async function POST(request: NextRequest) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, role } = body as { email?: string; role?: string };

  if (!email?.trim()) {
    return NextResponse.json({ error: "El email es requerido" }, { status: 400 });
  }
  if (!role || !VALID_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", session.tenantId!)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingMember) {
    return NextResponse.json({ error: "Este usuario ya es miembro del equipo" }, { status: 409 });
  }

  // Upsert invite (replace if already pending)
  const { error: inviteErr } = await supabase.from("tenant_invites").upsert(
    {
      tenant_id: session.tenantId!,
      email: normalizedEmail,
      role,
      invited_by: session.email!,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "tenant_id,email" }
  );

  if (inviteErr) {
    return NextResponse.json({ error: "Error al crear la invitación" }, { status: 500 });
  }

  // Send invite email via Supabase auth admin
  const origin = new URL(request.url).origin;
  const { error: emailErr } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: `${origin}/api/auth/callback`,
  });

  if (emailErr) {
    // Don't block if email fails — invite record is saved, admin can resend
    console.error("Invite email error:", emailErr.message);
    return NextResponse.json({
      success: true,
      warning: "Invitación guardada pero no se pudo enviar el correo. Intenta de nuevo.",
    });
  }

  return NextResponse.json({ success: true });
}
