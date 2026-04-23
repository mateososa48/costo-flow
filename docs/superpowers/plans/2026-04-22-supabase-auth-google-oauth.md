# Supabase Auth + Google OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace iron-session + shared bcrypt password with Supabase Auth + Google OAuth, making auth work for any user who signs up independently.

**Architecture:** `@supabase/ssr` handles cookie-based session management in Next.js 15. A new `tenant_users` table links Supabase Auth users to tenants. `getSession()` in `src/lib/session.ts` becomes the single source of truth — all ~30 calling routes continue to call the same function and get back the same-shaped `SessionData` object, now sourced from Supabase Auth + a `tenant_users` lookup instead of iron-session.

**Tech Stack:** `@supabase/ssr`, Supabase Auth (Google OAuth provider), Next.js 15 App Router, existing `@supabase/supabase-js` (service role client for data ops)

---

## Prerequisites (Manual — Do Before Running Tasks)

### P1: Enable Google OAuth in Supabase Dashboard

1. Go to: Supabase Dashboard → project `epvagtzgiobatzpqqfsn` → Authentication → Providers → Google
2. Enable Google OAuth (you'll need a Google Cloud Console project with OAuth credentials)
3. Add your Google Client ID and Client Secret
4. Under Authentication → URL Configuration → Redirect URLs, add:
   - `http://localhost:3000/api/auth/callback`
   - `https://<your-vercel-domain>/api/auth/callback`

### P2: Get Supabase Anon Key

Go to: Supabase Dashboard → Settings → API → `anon` `public` key. Copy it — you'll need it in Task 1.

---

## File Map

**New files:**
- `supabase/migrations/20260422_add_supabase_auth.sql` — `tenant_users` table
- `src/app/api/auth/callback/route.ts` — OAuth code-exchange handler
- `src/app/onboard/page.tsx` — stub page for users without a tenant

**Modified files:**
- `src/types.ts` — expand `SessionData`, remove `adminNames` from `DropdownsResponse`
- `src/config.ts` — remove `auth.adminNames`, `auth.sharedPassword`, `auth.sessionPassword`
- `middleware.ts` — replace iron-session check with Supabase Auth check
- `src/lib/session.ts` — replace iron-session with Supabase Auth + tenant_users lookup
- `src/lib/dropdowns.ts` — remove `adminNames` from response
- `src/app/login/page.tsx` — replace name/password form with Google OAuth button
- `src/components/Shell.tsx` — update logout + user display (use `name`/`email`)
- `src/app/api/auth/login/route.ts` — stub 410 Gone
- `src/app/api/auth/logout/route.ts` — call `supabase.auth.signOut()`
- `src/app/api/auth/me/route.ts` — return session data from Supabase Auth
- `src/app/api/settings/password/route.ts` — stub 410 Gone
- `src/app/api/settings/users/route.ts` — stub 410 Gone
- `src/app/settings/page.tsx` — remove `PasswordSection` and `UsersSection`
- `src/app/api/invoices/submit/route.ts` — use `session.email` for `submitted_by`
- `src/app/api/compras/invoices/route.ts` — use `session.email` for `submitted_by`/`user`
- `src/app/api/compras/invoices/[id]/route.ts` — use `session.email` for audit `user`
- `src/app/api/invoices/parse/route.ts` — use `session.email` for rate limit key
- `.env.local` — add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `package.json` — add `@supabase/ssr`

**Deleted files (after plan completes):**
- `src/lib/auth.ts` — bcrypt helpers no longer needed

---

## Task 1: Supabase Migration — tenant_users Table

**Files:**
- Create: `supabase/migrations/20260422_add_supabase_auth.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260422_add_supabase_auth.sql
-- Adds tenant_users table linking Supabase Auth users to tenants.
-- Auth is now managed by Supabase Auth (Google OAuth), not by adminNames/sharedPasswordHash in tenants.settings.

CREATE TABLE IF NOT EXISTS tenant_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,           -- matches auth.users.id from Supabase Auth
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'readonly')),
  email      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id   ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool (or run via Supabase CLI) with the SQL above.

- [ ] **Step 3: Verify the table exists**

Run `SELECT * FROM tenant_users LIMIT 1;` via Supabase SQL editor or MCP execute_sql. Expect empty result set (no error).

- [ ] **Step 4: Manually seed Aventura Gourmet users**

After Angela and Alan sign in with Google OAuth for the first time, their `auth.users` entries are created automatically. At that point, insert them into `tenant_users`:

```sql
-- Run this AFTER Angela and Alan have signed in once with Google:
-- INSERT INTO tenant_users (user_id, tenant_id, role, email)
-- VALUES
--   ('<angela-auth-user-id>', 'a0000000-0000-0000-0000-000000000001', 'admin', 'angela@aventuragourmet.com'),
--   ('<alan-auth-user-id>',   'a0000000-0000-0000-0000-000000000001', 'admin', 'alan@aventuragourmet.com');
-- 
-- Find the user IDs by running: SELECT id, email FROM auth.users;
```

This step is a comment/reminder — do not run it now. Commit the migration file only.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260422_add_supabase_auth.sql
git commit -m "feat: add tenant_users table for Supabase Auth integration"
```

---

## Task 2: Install @supabase/ssr + Add Env Vars

**Files:**
- Modify: `package.json`, `.env.local`

- [ ] **Step 1: Install @supabase/ssr**

```bash
npm install @supabase/ssr
```

Expected output: `added N packages`

- [ ] **Step 2: Add env vars to .env.local**

Open `.env.local` and add these two lines (use the anon key from Supabase dashboard — see Prerequisite P2):

```
NEXT_PUBLIC_SUPABASE_URL=https://epvagtzgiobatzpqqfsn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste-anon-key-from-supabase-dashboard>
```

Note: `NEXT_PUBLIC_SUPABASE_URL` duplicates `SUPABASE_URL` but is needed client-side (the `NEXT_PUBLIC_` prefix makes it available in the browser bundle).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @supabase/ssr"
```

---

## Task 3: Update src/types.ts — Expand SessionData

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Update SessionData and DropdownsResponse**

Replace the `SessionData` and `DropdownsResponse` types in `src/types.ts`:

```typescript
// OLD:
export type SessionData = {
  user?: string;
  tenantId?: string;
  isLoggedIn: boolean;
};

export type DropdownsResponse = {
  concepto: string[];
  cuentaPnl: string[];
  restaurants: Array<{ value: Restaurant; label: string }>;
  adminNames: string[];
  sheetRegistry: Record<string, string>;
};

// NEW (replace with):
export type SessionData = {
  isLoggedIn: boolean;
  userId?: string;
  tenantId?: string;
  email?: string;
  name?: string;     // display name from Google (user.user_metadata.full_name)
  role?: "admin" | "member" | "readonly";
};

export type DropdownsResponse = {
  concepto: string[];
  cuentaPnl: string[];
  restaurants: Array<{ value: Restaurant; label: string }>;
  sheetRegistry: Record<string, string>;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -50
```

There will be errors from callers using `session.user` and `adminNames` — these are fixed in later tasks. Just confirm `types.ts` itself is clean.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: expand SessionData for Supabase Auth, remove adminNames from DropdownsResponse"
```

---

## Task 4: Update src/config.ts — Remove Auth Getters

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Remove the auth getter from config**

In `src/config.ts`, remove the entire `get auth()` block. The `config` object becomes:

```typescript
/**
 * config.ts — Lazy environment variable getters.
 * Values are validated only when accessed, not at import time (Vercel-safe).
 *
 * Auth is now handled by Supabase Auth (Google OAuth). ADMIN_NAMES, SHARED_PASSWORD,
 * and SESSION_PASSWORD env vars are kept in .env files but no longer read by the app.
 */

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function parseSheetRegistry(raw: string): Record<string, string> {
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    throw new Error("SHEET_REGISTRY is not valid JSON. Expected format: {\"restaurant_YYYY_MM\": \"SPREADSHEET_ID\"}");
  }
}

export const config = {
  get openai() {
    return {
      apiKey: required("OPENAI_API_KEY"),
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    };
  },

  get google() {
    const rawKey = required("GOOGLE_PRIVATE_KEY");
    return {
      serviceAccountEmail: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      privateKey: rawKey.replace(/\\n/g, "\n"),
    };
  },

  get sheets() {
    const registry = parseSheetRegistry(required("SHEET_REGISTRY"));
    const auditLogId = required("AUDIT_LOG_SPREADSHEET_ID");

    return {
      registry,
      auditLogId,

      getSpreadsheetId(restaurant: string, year: number, month: number): string {
        const key = `${restaurant}_${year}_${String(month).padStart(2, "0")}`;
        const id = registry[key];
        if (!id) {
          throw new Error(
            `No Google Sheet registered for "${key}". ` +
            `Add an entry to SHEET_REGISTRY: {"${key}": "YOUR_SPREADSHEET_ID", ...}`
          );
        }
        return id;
      },
    };
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/config.ts
git commit -m "feat: remove legacy auth config (adminNames, sharedPassword, sessionPassword)"
```

---

## Task 5: Replace src/lib/session.ts

**Files:**
- Modify: `src/lib/session.ts`

This is the highest-impact change. `getSession()` switches from reading an iron-session cookie to reading a Supabase Auth session + a `tenant_users` lookup. All ~30 API routes call this function — they keep working unchanged because `SessionData` still has `isLoggedIn`, `tenantId`, and the shape they expect.

- [ ] **Step 1: Replace the entire file**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import getSupabase from "@/lib/supabase";
import type { SessionData } from "@/types";

/**
 * Returns the current user's application session by:
 * 1. Reading the Supabase Auth session from the request cookie
 * 2. Looking up their tenant membership in tenant_users
 *
 * Returns { isLoggedIn: false } when the user is unauthenticated or has
 * no tenant assignment yet (they will be redirected to /onboard at login time).
 */
export async function getSession(): Promise<SessionData> {
  const cookieStore = await cookies();

  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Route handlers in read-only contexts can't mutate cookies — safe to ignore
          }
        },
      },
    }
  );

  const { data: { user }, error } = await authClient.auth.getUser();

  if (error || !user) {
    return { isLoggedIn: false };
  }

  const supabase = getSupabase();
  if (!supabase) return { isLoggedIn: false };

  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) {
    return { isLoggedIn: false };
  }

  return {
    isLoggedIn: true,
    userId: user.id,
    tenantId: tenantUser.tenant_id as string,
    email: user.email ?? "",
    name: (user.user_metadata?.full_name as string) ?? user.email ?? "",
    role: tenantUser.role as "admin" | "member" | "readonly",
  };
}
```

- [ ] **Step 2: Update src/lib/tenant.ts — getTenantId()**

The `getTenantId()` function calls `getSession()` and reads `session.tenantId`. The new `SessionData` shape keeps `tenantId?: string`, so this keeps working. No change needed, but update the import to remove the now-unused iron-session import:

Open `src/lib/tenant.ts`. The import `import { getSession } from "@/lib/session";` stays the same. Verify the body of `getTenantId()` is:

```typescript
export async function getTenantId(): Promise<string | null> {
  const session = await getSession();
  return session.tenantId ?? null;
}
```

No code change required in `tenant.ts` — it already matches.

- [ ] **Step 3: Commit**

```bash
git add src/lib/session.ts
git commit -m "feat: replace iron-session with Supabase Auth in getSession()"
```

---

## Task 6: Replace middleware.ts

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedPaths = ["/upload", "/review", "/success", "/history", "/settings", "/compras", "/gastos"];

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Build a mutable response so we can write refreshed auth cookies back
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT and refreshes the session if needed
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirectToLogin(request);
  }

  return response;
}

export const config = {
  matcher: [
    "/upload/:path*",
    "/review/:path*",
    "/success/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/compras/:path*",
    "/gastos/:path*",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: replace iron-session middleware with Supabase Auth middleware"
```

---

## Task 7: Create OAuth Callback Route

**Files:**
- Create: `src/app/api/auth/callback/route.ts`

This route is where Supabase redirects after the user completes Google OAuth. It exchanges the one-time code for a session, writes auth cookies, checks `tenant_users`, and redirects to `/upload` (or `/onboard` if no tenant).

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import getSupabase from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  // We'll write auth cookies onto this response
  const response = NextResponse.redirect(`${origin}/upload`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Check whether this user belongs to any tenant
  const dataClient = getSupabase();
  if (dataClient) {
    const { data: tenantUser } = await dataClient
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", data.user.id)
      .single();

    if (!tenantUser) {
      // Authenticated but not assigned to a tenant → onboarding
      return NextResponse.redirect(`${origin}/onboard`);
    }
  }

  return response; // redirect to /upload with auth cookies set
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/callback/route.ts
git commit -m "feat: add OAuth callback route with tenant membership check"
```

---

## Task 8: Update Auth API Routes

**Files:**
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/logout/route.ts`
- Modify: `src/app/api/auth/me/route.ts`

- [ ] **Step 1: Stub /api/auth/login (410 Gone)**

Replace the entire `src/app/api/auth/login/route.ts` with:

```typescript
// Login via name/password has been replaced by Supabase Auth (Google OAuth).
// The OAuth flow starts client-side via supabase.auth.signInWithOAuth() on the login page.
// This endpoint is kept as a stub and returns 410 Gone to surface clear errors if called.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Password login is no longer supported. Use Google OAuth on the login page." },
    { status: 410 }
  );
}
```

- [ ] **Step 2: Replace /api/auth/logout**

Replace the entire `src/app/api/auth/logout/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.signOut();
  return response;
}
```

- [ ] **Step 3: Replace /api/auth/me**

Replace the entire `src/app/api/auth/me/route.ts` with:

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: session.name,
    email: session.email,
    tenantId: session.tenantId,
    role: session.role,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/login/route.ts src/app/api/auth/logout/route.ts src/app/api/auth/me/route.ts
git commit -m "feat: update auth API routes for Supabase Auth (stub login, replace logout/me)"
```

---

## Task 9: Stub Settings API Routes

**Files:**
- Modify: `src/app/api/settings/password/route.ts`
- Modify: `src/app/api/settings/users/route.ts`

- [ ] **Step 1: Stub /api/settings/password**

Replace the entire `src/app/api/settings/password/route.ts` with:

```typescript
// Password management is no longer applicable — auth is handled by Supabase Auth (Google OAuth).
// TODO: This endpoint will be replaced by a team management flow when tenant onboarding is built.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Password management has been replaced by Google OAuth. No shared password exists." },
    { status: 410 }
  );
}
```

- [ ] **Step 2: Stub /api/settings/users**

Replace the entire `src/app/api/settings/users/route.ts` with:

```typescript
// User management via adminNames list is no longer applicable.
// Users are now managed via Supabase Auth (Google OAuth) + the tenant_users table.
// TODO: This endpoint will be replaced by a team management flow when tenant onboarding is built.
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
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/settings/password/route.ts src/app/api/settings/users/route.ts
git commit -m "feat: stub settings/password and settings/users routes (replaced by Supabase Auth)"
```

---

## Task 10: Update src/lib/dropdowns.ts — Remove adminNames

**Files:**
- Modify: `src/lib/dropdowns.ts`

- [ ] **Step 1: Remove adminNames from the response and clean up imports**

Replace the entire `src/lib/dropdowns.ts` with:

```typescript
import dropdownOptionsRaw from "../../data/dropdown_options.json";
import type { DropdownsResponse } from "@/types";
import { config } from "@/config";
import { getTenantRestaurants } from "@/lib/tenant";

type DropdownFile = {
  concepto: string[];
  cuentaPnl: string[];
};

const options = dropdownOptionsRaw as unknown as DropdownFile;

const FALLBACK_RESTAURANTS = [
  { value: "motin_juarez", label: "Motín Juárez" },
  { value: "motin_roma",   label: "Motín Roma" },
  { value: "queseria",     label: "Quesería" },
];

export async function getDropdownOptions(tenantId?: string): Promise<DropdownsResponse> {
  const restaurants = tenantId
    ? await getTenantRestaurants(tenantId)
    : FALLBACK_RESTAURANTS;

  return {
    concepto: options.concepto ?? [],
    cuentaPnl: options.cuentaPnl ?? [],
    restaurants: restaurants.length > 0 ? restaurants : FALLBACK_RESTAURANTS,
    sheetRegistry: config.sheets.registry,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dropdowns.ts
git commit -m "feat: remove adminNames from dropdowns response"
```

---

## Task 11: Replace Login Page

**Files:**
- Modify: `src/app/login/page.tsx`

The login page becomes a single "Iniciar sesión con Google" button. The name dropdown and password field are removed entirely.

- [ ] **Step 1: Replace the entire file**

```tsx
"use client";

import React, { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (oauthError) {
        setError("Error al iniciar sesión con Google. Intenta de nuevo.");
        setLoading(false);
      }
      // On success, browser follows the OAuth redirect — no further action needed here
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* Left panel — desktop */}
      <div className="login-panel-gradient hidden lg:flex flex-col justify-between w-96 flex-shrink-0 p-10 relative overflow-hidden">
        <div className="relative z-10">
          <p className="font-display text-3xl font-bold text-white"
            style={{ fontFamily: "var(--font-display)" }}>
            BOH
          </p>
        </div>
        <div className="relative z-10">
          <p className="text-white/50 text-sm">Back-of-house automation para restaurantes</p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="w-full max-w-md animate-fade-up">
          <div className="lg:hidden text-center mb-8">
            <p className="font-display text-2xl font-bold" style={{ color: "var(--text)" }}>
              BOH
            </p>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>Iniciar sesión</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Usa tu cuenta de Google para acceder
            </p>
          </div>

          {error && (
            <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 px-4 rounded-[var(--radius-sm)] text-sm font-semibold flex items-center justify-center gap-3 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed border"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {loading ? "Redirigiendo..." : "Iniciar sesión con Google"}
          </button>

          <p className="text-center text-xs mt-8" style={{ color: "var(--text-dim)" }}>
            Solo para equipos con acceso autorizado
          </p>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: replace password login form with Google OAuth button"
```

---

## Task 12: Create /onboard Stub Page

**Files:**
- Create: `src/app/onboard/page.tsx`

- [ ] **Step 1: Create stub onboarding page**

```tsx
export default function OnboardPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>
          Bienvenido a BOH
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Tu cuenta fue verificada, pero aún no tienes acceso a ningún grupo de restaurantes.
          Contacta a tu administrador para que te agregue al equipo.
        </p>
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          Si crees que esto es un error, escribe a soporte.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/onboard/page.tsx
git commit -m "feat: add /onboard stub page for users without tenant assignment"
```

---

## Task 13: Update Shell.tsx — Logout + User Display

**Files:**
- Modify: `src/components/Shell.tsx`

Shell currently fetches `/api/auth/me` and stores the username in `sessionStorage`. With Supabase Auth, the "user" is now a `name` (display name from Google).

- [ ] **Step 1: Update the user-fetching useEffect and logout handler**

Find and replace the user-fetching `useEffect` in Shell (lines ~92-108) and `handleLogout` (lines ~110-114):

```tsx
// Replace the user state and effects:

const [user, setUser] = useState<string>("");

useEffect(() => {
  const cached = sessionStorage.getItem("boh_user_name");
  if (cached) {
    setUser(cached);
    return;
  }
  fetch("/api/auth/me")
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.user) {
        sessionStorage.setItem("boh_user_name", data.user);
        setUser(data.user);
      }
    })
    .catch(() => {});
}, []);

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  sessionStorage.removeItem("boh_user_name");
  router.push("/login");
}
```

The `initials` calculation stays the same:
```tsx
const initials = user ? user.slice(0, 2).toUpperCase() : "?";
```

Also remove the `sessionStorage.setItem("user", ...)` line in the login page — it no longer exists. Shell now uses `boh_user_name` as the storage key to avoid conflicts with old cookies.

- [ ] **Step 2: Update the sidebar wordmark**

Find the hardcoded `"Aventura Gourmet"` strings in the sidebar and mobile header. Change them to `"BOH"` (or keep as-is for Aventura — the spec doesn't require changing branding here, so leave it). Actually the spec doesn't say to change the wordmark, so leave `"Aventura Gourmet"` unchanged for now.

- [ ] **Step 3: Commit**

```bash
git add src/components/Shell.tsx
git commit -m "feat: update Shell to use Supabase Auth session for user display and logout"
```

---

## Task 14: Update Settings Page — Remove Password/Users Sections

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Remove PasswordSection and UsersSection**

In `src/app/settings/page.tsx`:

1. Delete the entire `PasswordInput` component (lines ~127-154)
2. Delete the entire `PasswordSection` component (lines ~156-225)
3. Delete the entire `UsersSection` component (lines ~229-355)
4. In the `SettingsPage` component, remove `<PasswordSection />` and `<UsersSection />` from the JSX
5. Remove the `useCallback` import if it's no longer used
6. Remove `type { DropdownsResponse }` from imports since it no longer has `adminNames`
7. Remove the `adminNames` reference from the `DropdownsResponse` destructuring

The `SettingsPage` render should become:

```tsx
return (
  <Shell>
    <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl md:text-4xl font-bold" style={{ color: "var(--text)" }}>
          Configuración
        </h1>
        <p className="text-base mt-2" style={{ color: "var(--text-muted)" }}>
          Ajustes del sistema y preferencias
        </p>
      </div>

      <div className="animate-fade-up space-y-4" style={{ animationDelay: "0.05s" }}>
        <Section title="Tutorial" description="Aprende a usar el sistema paso a paso">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Guía interactiva</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                Repasa todas las funciones del sistema en menos de 2 minutos
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("startTutorial"))}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-semibold text-white transition-colors duration-150 active:scale-[0.97] flex-shrink-0"
              style={{ background: "var(--blue)" }}
            >
              <span>✨</span>
              Iniciar tutorial
            </button>
          </div>
        </Section>
        <ThemeSection />
        {registryLoaded && <SheetRegistrySection registry={registry} />}
      </div>
    </div>
  </Shell>
);
```

Also remove:
- The `EyeIcon` component (was only used in PasswordInput)
- The `currentUser` state in UsersSection
- The `useCallback` import if unused

- [ ] **Step 2: Fix the DropdownsResponse import**

The settings page uses `DropdownsResponse` to type the fetch result. Since `adminNames` was removed from `DropdownsResponse`, the `setRegistry(d.sheetRegistry ?? {})` call should still work. Verify the type import at the top of the file is still needed (it's used for `(d: DropdownsResponse)`). Keep it.

- [ ] **Step 3: Compile check**

```bash
npx tsc --noEmit 2>&1 | grep "settings"
```

Expect no errors from settings/page.tsx.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: remove password and user management sections from settings page"
```

---

## Task 15: Update Audit Log Email References

All these routes currently write `session.user` (display name) to audit logs. The spec says to use `session.email` going forward.

**Files:**
- Modify: `src/app/api/invoices/submit/route.ts`
- Modify: `src/app/api/compras/invoices/route.ts`
- Modify: `src/app/api/compras/invoices/[id]/route.ts`
- Modify: `src/app/api/invoices/parse/route.ts`

- [ ] **Step 1: Update src/app/api/invoices/submit/route.ts**

Find:
```typescript
const session = await getSession();
if (!session.isLoggedIn || !session.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
// ...
const user = session.user;
const tenantId = session.tenantId;
```

Replace with:
```typescript
const session = await getSession();
if (!session.isLoggedIn) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
// ...
const user = session.email ?? "";
const tenantId = session.tenantId;
```

- [ ] **Step 2: Update src/app/api/compras/invoices/route.ts**

Find all occurrences of `session.user ?? "Sistema"` and replace with `session.email ?? "Sistema"`.

Also find the auth check `if (!session.isLoggedIn)` — it's already correct (doesn't check `session.user`), leave it.

- [ ] **Step 3: Update src/app/api/compras/invoices/[id]/route.ts**

Find all occurrences of `session.user ?? "Sistema"` and replace with `session.email ?? "Sistema"`.

- [ ] **Step 4: Update src/app/api/invoices/parse/route.ts**

Find:
```typescript
const rateLimitKey = `parse:${session.user ?? "anonymous"}`;
```
Replace with:
```typescript
const rateLimitKey = `parse:${session.email ?? "anonymous"}`;
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/invoices/submit/route.ts src/app/api/compras/invoices/route.ts src/app/api/compras/invoices/[id]/route.ts src/app/api/invoices/parse/route.ts
git commit -m "feat: use session.email instead of session.user for audit logs and submitted_by"
```

---

## Task 16: Remove src/lib/auth.ts and Clean Up settings-override.ts

**Files:**
- Delete: `src/lib/auth.ts`
- Modify: `src/lib/settings-override.ts`

- [ ] **Step 1: Verify auth.ts is no longer imported**

```bash
grep -rn "from.*lib/auth" /Users/mateososaalbrecht/boh-saas/src --include="*.ts" --include="*.tsx"
```

Expected: zero results. If there are any remaining references, fix them first.

- [ ] **Step 2: Delete src/lib/auth.ts**

```bash
rm src/lib/auth.ts
```

- [ ] **Step 3: Simplify settings-override.ts**

The `settings-override.ts` file managed `adminNames` and `sharedPassword`. With Supabase Auth, neither is needed. However, `writeOverride` and `readOverride` are still called from the now-stubbed password/users routes, so there are no remaining callers.

Check:
```bash
grep -rn "settings-override\|readOverride\|writeOverride" /Users/mateososaalbrecht/boh-saas/src --include="*.ts" --include="*.tsx"
```

If the only callers are the now-stubbed `settings/password` and `settings/users` routes (which no longer import it), the file can be deleted entirely. If any other route still imports it, leave the file but note it.

If safe to delete:
```bash
rm src/lib/settings-override.ts
```

- [ ] **Step 4: Compile check**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Expect zero errors. If TypeScript complains about missing imports (e.g., `auth` or `readOverride` somewhere), fix those references.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove legacy auth.ts and settings-override.ts (replaced by Supabase Auth)"
```

---

## Task 17: Final Compile + Smoke Test

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Run dev server**

```bash
npm run dev
```

Expected: server starts without errors on port 3000.

- [ ] **Step 3: Smoke test the login flow**

1. Open `http://localhost:3000/login`
2. Verify: no name dropdown, no password field, only "Iniciar sesión con Google" button
3. Click the button — verify it redirects to Google OAuth (requires Supabase Google OAuth to be configured, see Prerequisites)
4. After completing OAuth: verify redirect to `/upload` (if in `tenant_users`) or `/onboard` (if not)

- [ ] **Step 4: Smoke test protected routes**

1. Open `http://localhost:3000/upload` while not logged in → should redirect to `/login`
2. Log in via Google → should be able to access `/upload`, `/compras`, `/settings`
3. Settings page: verify no password or user management sections visible

- [ ] **Step 5: Smoke test logout**

1. Click "Salir" in the sidebar
2. Verify redirect to `/login`
3. Try accessing `/upload` → should redirect to `/login`

- [ ] **Step 6: Commit any final fixes found during smoke testing**

```bash
git add -A
git commit -m "fix: address issues found during auth smoke test"
```

---

## Self-Review Against Spec

| Spec Requirement | Task(s) |
|---|---|
| Enable Supabase Auth + Google OAuth | Tasks 2 (install), Prereqs (dashboard config) |
| Create tenant_users table | Task 1 |
| Replace iron-session with Supabase session | Task 5 (session.ts), Task 6 (middleware) |
| Shell uses getSession not /api/auth/me indirectly | Task 13 (still uses /api/auth/me but that now uses Supabase) |
| Replace login/logout with OAuth | Tasks 8, 11 |
| Tenant resolution after OAuth → /onboard if no tenant | Task 7 (callback) |
| submitted_by → email, user_name → email | Task 15 |
| Remove ADMIN_NAMES/SHARED_PASSWORD code paths | Tasks 4, 10, 16 |
| Remove adminNames/sharedPasswordHash from settings shape | Not a code change — new auth no longer reads/writes these fields |
| Stub /api/settings/users and /api/settings/password | Task 9 |
| Do not touch data tables | ✓ Only tenant_users (new table) is created |
| Session shape: userId, tenantId, email, name, role | Task 3 (types), Task 5 (implementation) |
