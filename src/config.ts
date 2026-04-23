/**
 * config.ts — Lazy environment variable getters.
 * Values are validated only when accessed, not at import time (Vercel-safe).
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
      // Handle both escaped \n (env file) and real newlines
      privateKey: rawKey.replace(/\\n/g, "\n"),
    };
  },

  get sheets() {
    const registry = parseSheetRegistry(required("SHEET_REGISTRY"));
    const auditLogId = required("AUDIT_LOG_SPREADSHEET_ID");

    return {
      registry,
      auditLogId,

      /**
       * Get the Spreadsheet ID for a given restaurant, year, and month.
       * Key format: {restaurant}_{YYYY}_{MM}  e.g. "motin_juarez_2025_01"
       *
       * Throws if no sheet is registered for the combination.
       * Add entries to the SHEET_REGISTRY env var to register new months.
       */
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
