import fs from "fs";
import path from "path";
import getSupabase from "@/lib/supabase";
import log from "@/lib/logger";

const BUNDLED_FILE = path.join(process.cwd(), "data", "settings-override.json");
const WRITABLE_FILE =
  process.env.NODE_ENV === "production" ? "/tmp/settings-override.json" : BUNDLED_FILE;

export type SettingsOverride = {
  sharedPassword?: string;
  adminNames?: string[];
};

function readFile(filePath: string): SettingsOverride {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SettingsOverride;
  } catch {
    return {};
  }
}

function writeFile(data: SettingsOverride): void {
  const tmpPath = WRITABLE_FILE + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmpPath, WRITABLE_FILE);
}

// ─── Tenant-based read/write (multi-tenant path) ─────────────────

async function readFromTenant(tenantId: string): Promise<SettingsOverride | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();
  if (!data) return null;
  const s = data.settings as Record<string, unknown>;
  // Map tenant settings fields to SettingsOverride shape
  return {
    adminNames: s.adminNames as string[] | undefined,
    sharedPassword: s.sharedPasswordHash as string | undefined,
  };
}

async function writeToTenant(tenantId: string, patch: SettingsOverride): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  // Read current tenant settings
  const { data } = await supabase.from("tenants").select("settings").eq("id", tenantId).single();
  const current = (data?.settings as Record<string, unknown>) ?? {};
  if (patch.adminNames !== undefined) current.adminNames = patch.adminNames;
  if (patch.sharedPassword !== undefined) current.sharedPasswordHash = patch.sharedPassword;

  const { error } = await supabase
    .from("tenants")
    .update({ settings: current })
    .eq("id", tenantId);
  if (error) {
    log.error({ ctx: "settings", msg: "Tenant settings write failed", data: { detail: error.message } });
    return false;
  }
  return true;
}

// ─── Legacy app_settings fallback ────────────────────────────────

async function readFromSupabase(): Promise<SettingsOverride | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "main")
    .limit(1)
    .single();
  if (error || !data) return null;
  return data.value as SettingsOverride;
}

async function writeToSupabase(data: SettingsOverride): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { key: "main", value: data, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) {
    log.error({ ctx: "settings", msg: "Supabase write failed", data: { detail: error.message } });
    return false;
  }
  return true;
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Read settings for a specific tenant. Falls back to legacy app_settings,
 * then to the bundled JSON file.
 */
export async function readOverrideForTenant(tenantId: string): Promise<SettingsOverride> {
  if (process.env.NODE_ENV === "production") {
    const fromTenant = await readFromTenant(tenantId);
    if (fromTenant && (fromTenant.adminNames || fromTenant.sharedPassword)) return fromTenant;
    const fromSupabase = await readFromSupabase();
    if (fromSupabase) return fromSupabase;
  }
  return readFile(BUNDLED_FILE);
}

/**
 * Legacy: read settings without a tenant (used during login for backwards compat).
 */
export async function readOverride(): Promise<SettingsOverride> {
  if (process.env.NODE_ENV === "production") {
    const fromSupabase = await readFromSupabase();
    if (fromSupabase) return fromSupabase;
  }
  return readFile(BUNDLED_FILE);
}

/**
 * Write settings. Prefers tenant-scoped storage when tenantId is provided.
 */
export async function writeOverride(
  patch: Partial<SettingsOverride>,
  tenantId?: string
): Promise<void> {
  if (tenantId && process.env.NODE_ENV === "production") {
    const ok = await writeToTenant(tenantId, patch);
    if (ok) return;
  }

  // Legacy path
  if (process.env.NODE_ENV === "production") {
    const existing = await readOverride();
    const merged = { ...existing, ...patch };
    const ok = await writeToSupabase(merged);
    if (ok) return;
  }

  const existing = readFile(BUNDLED_FILE);
  writeFile({ ...existing, ...patch });
}
