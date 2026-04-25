import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

export async function GET() {
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

  const { data: members, error } = await supabase
    .from("tenant_users")
    .select("id, user_id, email, role, created_at")
    .eq("tenant_id", session.tenantId!)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Error al obtener el equipo" }, { status: 500 });
  }

  // Fetch display names from auth.users via admin API
  const enriched = await Promise.all(
    (members ?? []).map(async (m) => {
      try {
        const { data } = await supabase.auth.admin.getUserById(m.user_id);
        const name =
          (data?.user?.user_metadata?.full_name as string | undefined) ??
          data?.user?.email ??
          m.email;
        const avatar = data?.user?.user_metadata?.avatar_url as string | undefined;
        return { ...m, name, avatar };
      } catch {
        return { ...m, name: m.email, avatar: undefined };
      }
    })
  );

  // Also return pending invites so admin can see who's been invited
  const { data: invites } = await supabase
    .from("tenant_invites")
    .select("id, email, role, invited_by, created_at, expires_at")
    .eq("tenant_id", session.tenantId!)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return NextResponse.json({ members: enriched, invites: invites ?? [] });
}
