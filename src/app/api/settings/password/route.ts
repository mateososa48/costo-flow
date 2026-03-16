import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { config } from "@/config";
import { readOverride, writeOverride } from "@/lib/settings-override";
import { verifyPassword, hashPassword } from "@/lib/auth";
import log from "@/lib/logger";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4),
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
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;
  const override = await readOverride();
  const effectivePassword = override.sharedPassword ?? config.auth.sharedPassword;

  const passwordValid = await verifyPassword(currentPassword, effectivePassword);
  if (!passwordValid) {
    return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 401 });
  }

  try {
    const hashedNew = await hashPassword(newPassword);
    await writeOverride({ sharedPassword: hashedNew });
  } catch (err) {
    log.error({ ctx: "settings", msg: "writeOverride failed (password)", err });
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
