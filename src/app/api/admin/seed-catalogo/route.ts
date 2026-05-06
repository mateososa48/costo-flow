import { NextRequest, NextResponse } from "next/server";
import { seedTenantCatalogo } from "@/lib/catalogo";

// One-time admin endpoint: POST /api/admin/seed-catalogo
// Body: { tenantId: string, template: "universal" | "aventura", secret: string }
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const { tenantId, template, secret } = body as Record<string, string>;

  if (!process.env.ADMIN_SEED_SECRET || secret !== process.env.ADMIN_SEED_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId || !template) {
    return NextResponse.json({ error: "tenantId and template required" }, { status: 400 });
  }
  if (template !== "universal" && template !== "aventura") {
    return NextResponse.json({ error: "template must be universal or aventura" }, { status: 400 });
  }

  try {
    await seedTenantCatalogo(tenantId, template as "universal" | "aventura");
    console.log("[admin-seed] Seeded catálogo", { tenantId, template });
    return NextResponse.json({ ok: true, tenantId, template });
  } catch (err) {
    console.error("[admin-seed] Seed failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 }
    );
  }
}
