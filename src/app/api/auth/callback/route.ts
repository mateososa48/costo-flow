import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import getSupabase from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  // Auth cookies will be written onto this response
  const response = NextResponse.redirect(`${origin}/upload`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Check whether this user belongs to any tenant
  const dataClient = getSupabase();
  if (dataClient) {
    const { data: tenantUser } = await dataClient
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", data.user.id)
      .single();

    if (!tenantUser) {
      // Authenticated but no tenant → send to onboarding
      return NextResponse.redirect(`${origin}/onboard`);
    }
  }

  return response; // → /upload with auth cookies set
}
