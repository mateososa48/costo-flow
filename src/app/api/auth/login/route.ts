// Login via name/password has been replaced by Supabase Auth (Google OAuth).
// The OAuth flow starts client-side via supabase.auth.signInWithOAuth() on the login page.
// This endpoint returns 410 Gone so any stale callers get a clear error.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Password login is no longer supported. Use Google OAuth on the login page." },
    { status: 410 }
  );
}
