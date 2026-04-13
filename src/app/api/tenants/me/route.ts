import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getTenantRestaurants } from "@/lib/tenant";

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurants = await getTenantRestaurants(session.tenantId);

  return NextResponse.json({
    tenantId: session.tenantId,
    restaurants,
  });
}
