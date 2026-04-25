import { NextResponse } from "next/server";
import getSupabase from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim();

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  return NextResponse.json({ available: data === null });
}
