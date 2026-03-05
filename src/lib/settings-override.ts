import fs from "fs";
import path from "path";

// On Vercel, the deployment filesystem is read-only.
// We write to /tmp (ephemeral per function instance) and fall back to the
// bundled data/ file for reads when /tmp hasn't been written yet.
const BUNDLED_FILE = path.join(process.cwd(), "data", "settings-override.json");
const WRITABLE_FILE = process.env.NODE_ENV === "production"
  ? "/tmp/settings-override.json"
  : BUNDLED_FILE;

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

export function readOverride(): SettingsOverride {
  // In production, prefer /tmp (written at runtime) but fall back to bundled defaults
  if (process.env.NODE_ENV === "production") {
    const tmp = readFile(WRITABLE_FILE);
    if (Object.keys(tmp).length > 0) return tmp;
    return readFile(BUNDLED_FILE);
  }
  return readFile(BUNDLED_FILE);
}

export function writeOverride(patch: Partial<SettingsOverride>): void {
  const existing = readOverride();
  const merged = { ...existing, ...patch };
  const tmpPath = WRITABLE_FILE + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2), "utf-8");
  fs.renameSync(tmpPath, WRITABLE_FILE);
}
