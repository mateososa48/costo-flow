import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { config } from "@/config";
import { readOverride, writeOverride } from "@/lib/settings-override";

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
  const override = readOverride();
  const effectivePassword = override.sharedPassword ?? config.auth.sharedPassword;

  if (currentPassword !== effectivePassword) {
    return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 401 });
  }

  try {
    writeOverride({ sharedPassword: newPassword });
  } catch (err) {
    console.error("[settings/password] writeOverride failed:", err);
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
