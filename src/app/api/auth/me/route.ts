import { NextResponse } from "next/server";
import { getSession, getAuthUser } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (session.isLoggedIn) {
    return NextResponse.json({
      user: session.name,
      email: session.email,
      tenantId: session.tenantId,
      role: session.role,
      userId: session.userId,
    });
  }

  // User is authenticated but has no tenant yet (mid-onboarding)
  const authUser = await getAuthUser();
  if (authUser) {
    return NextResponse.json({
      user: (authUser.user_metadata?.full_name as string) ?? authUser.email ?? "",
      email: authUser.email ?? "",
      tenantId: null,
      role: null,
    });
  }

  return NextResponse.json({ user: null }, { status: 401 });
}
