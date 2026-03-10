import fs from "fs";
import path from "path";
import getSupabase from "@/lib/supabase";

const BUNDLED_FILE = path.join(process.cwd(), "data", "settings-override.json");
const WRITABLE_FILE =
  process.env.NODE_ENV === "production" ? "/tmp/settings-override.json" : BUNDLED_FILE;

type SettingsOverride = {
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

// ─── Supabase-backed read/write (production) ────────────────────

async function readFromSupabase(): Promise<SettingsOverride | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "main")
    .single();
  if (error || !data) return null;
  return data.value as SettingsOverride;
}

async function writeToSupabase(data: SettingsOverride): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "main", value: data, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    console.error("[settings-override] Supabase write failed:", error.message);
    return false;
  }
  return true;
}

// ─── Public API (async) ─────────────────────────────────────────

export async function readOverride(): Promise<SettingsOverride> {
  if (process.env.NODE_ENV === "production") {
    const fromSupabase = await readFromSupabase();
    if (fromSupabase) return fromSupabase;
  }
  return readFile(BUNDLED_FILE);
}

export async function writeOverride(patch: Partial<SettingsOverride>): Promise<void> {
  const existing = await readOverride();
  const merged = { ...existing, ...patch };

  if (process.env.NODE_ENV === "production") {
    const ok = await writeToSupabase(merged);
    if (ok) return;
    // Supabase failed — fall through to /tmp as last resort
  }

  writeFile(merged);
}
