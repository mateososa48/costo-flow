import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";
import { readAuditEntries } from "@/lib/audit-log";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ entries: [], total: 0 });

  const url = request.nextUrl;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  try {
    const entries = await readAuditEntries(supabase, { limit, offset });
    return NextResponse.json({ entries, limit, offset });
  } catch {
    return NextResponse.json({ entries: [], total: 0 });
  }
}
