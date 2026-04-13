import type { SupabaseClient } from "@supabase/supabase-js";
import log from "@/lib/logger";

export type AuditAction =
  | "submitted"
  | "duplicate_bypassed"
  | "invoice_deleted"
  | "invoice_reclassified"
  | "invoice_added_manually";

export type AuditEntry = {
  id: string;
  action: AuditAction;
  user: string;
  tenantId?: string;
  restaurant: string;
  supplier: string;
  invoiceId: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  total: number;
  spreadsheetUrl?: string;
  details?: Record<string, string>;
  createdAt: string;
};

// ─── Database row shape (snake_case) ────────────────────────────
type AuditRow = {
  id: string;
  action: string;
  user_name: string;
  restaurant: string;
  supplier: string;
  invoice_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  total: number;
  spreadsheet_url: string | null;
  details: Record<string, string> | null;
  created_at: string;
};

function rowToEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    action: row.action as AuditAction,
    user: row.user_name,
    restaurant: row.restaurant,
    supplier: row.supplier,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number ?? undefined,
    invoiceDate: row.invoice_date ?? undefined,
    total: row.total,
    spreadsheetUrl: row.spreadsheet_url ?? undefined,
    details: row.details ?? undefined,
    createdAt: row.created_at,
  };
}

// ─── Legacy JSONB fallback (reads old data if table doesn't exist) ──
const LEGACY_KEY = "audit_history";

async function readLegacy(supabase: SupabaseClient): Promise<AuditEntry[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", LEGACY_KEY)
      .single();
    const raw = (data?.value ?? []) as AuditEntry[];
    return raw
      .filter((e) => e && typeof e === "object" && typeof e.id === "string")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

// ─── Table-based read ───────────────────────────────────────────
export async function readAuditEntries(
  supabase: SupabaseClient,
  options?: { limit?: number; offset?: number; tenantId?: string }
): Promise<AuditEntry[]> {
  const limit = options?.limit ?? 500;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.tenantId) query = query.eq("tenant_id", options.tenantId);

  const { data, error } = await query;

  if (error) {
    // Table doesn't exist yet — fall back to legacy JSONB
    if (error.code === "42P01" || error.message?.includes("audit_log")) {
      return readLegacy(supabase);
    }
    log.error({ ctx: "audit-log", msg: "Read error", data: { code: error.code, detail: error.message } });
    return readLegacy(supabase);
  }

  return (data as AuditRow[]).map(rowToEntry);
}

// ─── Table-based write ──────────────────────────────────────────
export async function appendAuditEntries(
  supabase: SupabaseClient,
  inputs: Omit<AuditEntry, "id" | "createdAt">[]
): Promise<void> {
  if (inputs.length === 0) return;

  const rows = inputs.map((input) => ({
    id: crypto.randomUUID(),
    action: input.action,
    user_name: input.user,
    ...(input.tenantId ? { tenant_id: input.tenantId } : {}),
    restaurant: input.restaurant,
    supplier: input.supplier,
    invoice_id: input.invoiceId,
    invoice_number: input.invoiceNumber ?? null,
    invoice_date: input.invoiceDate ?? null,
    total: input.total,
    spreadsheet_url: input.spreadsheetUrl ?? null,
    details: input.details ?? null,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("audit_log").insert(rows);

  if (error) {
    // Table doesn't exist — fall back to legacy JSONB append
    if (error.code === "42P01" || error.message?.includes("audit_log")) {
      await legacyAppend(supabase, inputs);
      return;
    }
    log.error({ ctx: "audit-log", msg: "Insert error", data: { code: error.code, detail: error.message } });
  }
}

// ─── Legacy JSONB append (fallback until table is created) ──────
async function legacyAppend(
  supabase: SupabaseClient,
  inputs: Omit<AuditEntry, "id" | "createdAt">[]
): Promise<void> {
  const existing = await readLegacy(supabase);
  const created = inputs.map((input) => ({
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }));
  const deduped = new Map<string, AuditEntry>();
  for (const e of [...created, ...existing]) deduped.set(e.id, e);
  const merged = Array.from(deduped.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 1000);

  await supabase
    .from("app_settings")
    .upsert({ key: LEGACY_KEY, value: merged, updated_at: new Date().toISOString() }, { onConflict: "key" });
}
