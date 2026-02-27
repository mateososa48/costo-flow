import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/types";

const SESSION_PASSWORD = process.env.SESSION_PASSWORD ?? "";

const protectedPaths = ["/upload", "/review", "/success"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

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
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/upload/:path*", "/review/:path*", "/success/:path*"],
};
