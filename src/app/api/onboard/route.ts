import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import getSupabase from "@/lib/supabase";
import { seedTenantCatalogo } from "@/lib/catalogo";

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Prevent double-onboarding
  const { data: existing } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Ya tienes una cuenta activa" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, slug, restaurants } = body as {
    name?: string;
    slug?: string;
    restaurants?: Array<{ label: string; slug: string }>;
  };

  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "Nombre y slug son requeridos" }, { status: 400 });
  }
  if (!SLUG_RE.test(slug.trim())) {
    return NextResponse.json(
      { error: "El slug solo puede contener letras minúsculas, números y guiones" },
      { status: 400 }
    );
  }
  if (!Array.isArray(restaurants) || restaurants.length === 0) {
    return NextResponse.json({ error: "Se requiere al menos una sucursal" }, { status: 400 });
  }
  for (const r of restaurants) {
    if (!r.label?.trim() || !r.slug?.trim()) {
      return NextResponse.json({ error: "Cada sucursal requiere nombre y slug" }, { status: 400 });
    }
  }

  // Slug uniqueness
  const { data: taken } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug.trim())
    .maybeSingle();
  if (taken) {
    return NextResponse.json({ error: "Este slug ya está en uso" }, { status: 409 });
  }

  // Create tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .insert({ name: name.trim(), slug: slug.trim(), settings: { sheetRegistry: {} } })
    .select()
    .single();
  if (tenantErr || !tenant) {
    return NextResponse.json({ error: "Error al crear el grupo" }, { status: 500 });
  }

  // Seed catálogo for new tenant (non-blocking — failure logged, not surfaced)
  try {
    await seedTenantCatalogo(tenant.id, "universal", supabase);
  } catch (err) {
    console.error("[onboard] Failed to seed tenant catálogo:", err);
  }

  // Create restaurants
  const { error: restErr } = await supabase.from("restaurants").insert(
    restaurants.map((r) => ({
      tenant_id: tenant.id,
      slug: r.slug.trim(),
      label: r.label.trim(),
    }))
  );
  if (restErr) {
    await supabase.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json({ error: "Error al crear las sucursales" }, { status: 500 });
  }

  // Create tenant_users
  const { error: userErr } = await supabase.from("tenant_users").insert({
    user_id: user.id,
    tenant_id: tenant.id,
    role: "admin",
    email: user.email ?? "",
  });
  if (userErr) {
    await supabase.from("restaurants").delete().eq("tenant_id", tenant.id);
    await supabase.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json({ error: "Error al vincular el usuario" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
