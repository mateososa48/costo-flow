import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { config } from "@/config";

const loginSchema = z.object({
  name: z.string().min(1),
  password: z.string().min(1),
});

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

  const { name, password } = parsed.data;
  const { adminNames, sharedPassword } = config.auth;

  if (!adminNames.includes(name)) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
  }

  if (password !== sharedPassword) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const session = await getSession();
  session.user = name;
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ ok: true, user: name });
}
