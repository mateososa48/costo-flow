// User management via adminNames list is no longer applicable.
// Users are managed via Supabase Auth (Google OAuth) + the tenant_users table.
// TODO: Will be replaced by a team management flow when tenant onboarding is built.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "User management has moved to the Supabase auth system (tenant_users table)." },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "User management has moved to the Supabase auth system (tenant_users table)." },
    { status: 410 }
  );
}
