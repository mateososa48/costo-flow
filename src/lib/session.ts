import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import getSupabase from "@/lib/supabase";
import type { SessionData } from "@/types";

/**
 * Returns the raw Supabase Auth user from the JWT cookie, without checking
 * tenant_users. Use this in routes that must work before a tenant is assigned
 * (e.g. /api/onboard). Returns null if unauthenticated.
 */
export async function getAuthUser() {
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * Returns the current user's application session by reading the Supabase Auth
 * session cookie and looking up their tenant membership in tenant_users.
 *
 * Returns { isLoggedIn: false } when the user is unauthenticated or has no
 * tenant assignment (they are redirected to /onboard at OAuth callback time).
 */
export async function getSession(): Promise<SessionData> {
  const cookieStore = await cookies();

  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Read-only cookie contexts (e.g. during rendering) cannot mutate cookies — safe to ignore
          }
        },
      },
    }
  );

  const { data: { user }, error } = await authClient.auth.getUser();

  if (error || !user) {
    return { isLoggedIn: false };
  }

  const supabase = getSupabase();
  if (!supabase) return { isLoggedIn: false };

  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) {
    return { isLoggedIn: false };
  }

  return {
    isLoggedIn: true,
    userId: user.id,
    tenantId: tenantUser.tenant_id as string,
    email: user.email ?? "",
    name: (user.user_metadata?.full_name as string) ?? user.email ?? "",
    role: tenantUser.role as "admin" | "member" | "readonly",
  };
}
