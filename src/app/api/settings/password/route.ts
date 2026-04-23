// Password management is no longer applicable — auth is handled by Supabase Auth (Google OAuth).
// TODO: Will be replaced by a team management flow when tenant onboarding is built.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Password management has been replaced by Google OAuth. No shared password exists." },
    { status: 410 }
  );
}
