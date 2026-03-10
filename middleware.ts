import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/types";

const SESSION_PASSWORD = process.env.SESSION_PASSWORD ?? "";

const protectedPaths = ["/upload", "/review", "/success", "/history", "/settings", "/compras"];

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // If SESSION_PASSWORD is not configured (too short), block all access
  if (!SESSION_PASSWORD || SESSION_PASSWORD.length < 32) {
    return redirectToLogin(request);
  }

  try {
    const response = NextResponse.next();

    // iron-session v8: pass full request + response objects for middleware
    const session = await getIronSession<SessionData>(request, response, {
      password: SESSION_PASSWORD,
      cookieName: "aventura_session",
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
      },
    });

    if (!session.isLoggedIn) {
      return redirectToLogin(request);
    }

    return response;
  } catch {
    // If session parsing fails for any reason, deny access
    return redirectToLogin(request);
  }
}

export const config = {
  matcher: ["/upload/:path*", "/review/:path*", "/success/:path*", "/history/:path*", "/settings/:path*", "/compras/:path*"],
};
