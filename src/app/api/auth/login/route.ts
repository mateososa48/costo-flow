import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { config } from "@/config";
import { readOverride } from "@/lib/settings-override";
import { verifyPassword } from "@/lib/auth";
import getSupabase from "@/lib/supabase";

const loginSchema = z.object({
  name: z.string().min(1),
  password: z.string().min(1),
  tenantSlug: z.string().min(1).optional(),
});

const FALLBACK_TENANT_SLUG = "aventura_gourmet";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing name or password" }, { status: 400 });
  }

  const { name, password, tenantSlug = FALLBACK_TENANT_SLUG } = parsed.data;

  // ── Try tenant-based auth first (multi-tenant path) ───────────────────────
  const supabase = getSupabase();
  if (supabase) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, settings")
      .eq("slug", tenantSlug)
      .single();

    if (tenant) {
      const settings = (tenant.settings as Record<string, unknown>) ?? {};
      const adminNames = settings.adminNames as string[] | undefined;
      const sharedPasswordHash = settings.sharedPasswordHash as string | undefined;

      // If tenant has configured admin names + password, use them
      if (adminNames && sharedPasswordHash) {
        if (!adminNames.includes(name)) {
          return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
        }
        const passwordValid = await verifyPassword(password, sharedPasswordHash);
        if (!passwordValid) {
          return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
        }
        const session = await getSession();
        session.user = name;
        session.tenantId = tenant.id as string;
        session.isLoggedIn = true;
        await session.save();
        return NextResponse.json({ ok: true, user: name, tenantId: tenant.id });
      }

      // Tenant exists but settings not yet migrated — fall through to legacy path
      // and save tenantId to session after legacy validation passes
      const override = await readOverride();
      const legacyAdminNames = override.adminNames ?? config.auth.adminNames;
      const legacyPassword = override.sharedPassword ?? config.auth.sharedPassword;

      if (!legacyAdminNames.includes(name)) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
      }
      const passwordValid = await verifyPassword(password, legacyPassword);
      if (!passwordValid) {
        return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
      }

      const session = await getSession();
      session.user = name;
      session.tenantId = tenant.id as string;
      session.isLoggedIn = true;
      await session.save();
      return NextResponse.json({ ok: true, user: name, tenantId: tenant.id });
    }
  }

  // ── Legacy single-tenant fallback (no Supabase or tenant not found) ────────
  const override = await readOverride();
  const adminNames = override.adminNames ?? config.auth.adminNames;
  const sharedPassword = override.sharedPassword ?? config.auth.sharedPassword;

  if (!adminNames.includes(name)) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
  }
  const passwordValid = await verifyPassword(password, sharedPassword);
  if (!passwordValid) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const session = await getSession();
  session.user = name;
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ ok: true, user: name });
}
