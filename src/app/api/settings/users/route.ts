import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { config } from "@/config";
import { readOverride, writeOverride } from "@/lib/settings-override";
import log from "@/lib/logger";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const override = await readOverride();
  const names = override.adminNames ?? config.auth.adminNames;
  return NextResponse.json({ names });
}

const schema = z.object({
  names: z.array(z.string().trim().min(1)).min(1),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Debe haber al menos un usuario" }, { status: 400 });
  }

  try {
    await writeOverride({ adminNames: parsed.data.names }, session.tenantId);
  } catch (err) {
    log.error({ ctx: "settings", msg: "writeOverride failed (users)", err });
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
