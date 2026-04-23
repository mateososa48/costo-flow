import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedPaths = ["/upload", "/review", "/success", "/history", "/settings", "/compras", "/gastos"];

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Build a mutable response so refreshed auth cookies can be written back
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT and refreshes the session token if needed
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirectToLogin(request);
  }

  return response;
}

export const config = {
  matcher: [
    "/upload/:path*",
    "/review/:path*",
    "/success/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/compras/:path*",
    "/gastos/:path*",
  ],
};
