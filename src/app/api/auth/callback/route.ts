import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import getSupabase from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  // Collect cookies written during session exchange — apply to whichever
  // redirect we return so the browser always gets the auth cookies.
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => pendingCookies.push(c));
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Decide where to send the user
  let dest = `${origin}/upload`;
  const dataClient = getSupabase();
  if (dataClient) {
    const { data: tenantUser } = await dataClient
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", data.user.id)
      .single();

    if (!tenantUser) {
      // Check for a pending invite for this email
      const userEmail = data.user.email?.toLowerCase();
      const { data: invite } = userEmail
        ? await dataClient
            .from("tenant_invites")
            .select("id, tenant_id, role")
            .eq("email", userEmail)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle()
        : { data: null };

      if (invite) {
        // Redeem invite: create tenant_users row and delete invite
        await dataClient.from("tenant_users").insert({
          user_id: data.user.id,
          tenant_id: invite.tenant_id,
          role: invite.role,
          email: userEmail,
        });
        await dataClient.from("tenant_invites").delete().eq("id", invite.id);
        // dest stays /upload
      } else {
        dest = `${origin}/onboard`;
      }
    }
  }

  // Build the final redirect and stamp all auth cookies onto it
  const response = NextResponse.redirect(dest);
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  return response;
}
