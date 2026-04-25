import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("id, slug, label")
    .eq("tenant_id", session.tenantId!)
    .order("label", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Error al obtener sucursales" }, { status: 500 });
  }

  return NextResponse.json({ restaurants: restaurants ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { label, slug } = body as { label?: string; slug?: string };

  if (!label?.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  if (!slug?.trim() || !SLUG_RE.test(slug.trim())) {
    return NextResponse.json(
      { error: "El slug solo puede contener letras minúsculas, números y guiones" },
      { status: 400 }
    );
  }

  // Check slug uniqueness within tenant
  const { data: existing } = await supabase
    .from("restaurants")
    .select("id")
    .eq("tenant_id", session.tenantId!)
    .eq("slug", slug.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Ya existe una sucursal con ese slug" }, { status: 409 });
  }

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .insert({ tenant_id: session.tenantId!, label: label.trim(), slug: slug.trim() })
    .select()
    .single();

  if (error || !restaurant) {
    return NextResponse.json({ error: "Error al crear la sucursal" }, { status: 500 });
  }

  return NextResponse.json({ restaurant });
}
