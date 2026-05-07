import { NextResponse } from "next/server";
import type { SessionData } from "@/types";

export function isReadonly(session: SessionData): boolean {
  return session.role === "readonly";
}

export function readonlyForbidden() {
  return NextResponse.json({ error: "Readonly users cannot modify data" }, { status: 403 });
}
