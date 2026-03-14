import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "submitted"
  | "duplicate_bypassed"
  | "invoice_deleted"
  | "invoice_reclassified";

export type AuditEntry = {
  id: string;
  action: AuditAction;
  user: string;
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

const KEY = "audit_history";
const MAX = 1000;

function makeEntry(input: Omit<AuditEntry, "id" | "createdAt">): AuditEntry {
  return { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
}

export async function readAuditEntries(supabase: SupabaseClient): Promise<AuditEntry[]> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .single();

  const raw = (data?.value ?? []) as AuditEntry[];
  return raw
    .filter((e) => e && typeof e === "object" && typeof e.id === "string")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function appendAuditEntries(
  supabase: SupabaseClient,
  inputs: Omit<AuditEntry, "id" | "createdAt">[]
): Promise<void> {
  if (inputs.length === 0) return;

  const existing = await readAuditEntries(supabase);
  const created = inputs.map(makeEntry);

  // Deduplicate by id, newest first, cap at MAX
  const deduped = new Map<string, AuditEntry>();
  for (const e of [...created, ...existing]) deduped.set(e.id, e);
  const merged = Array.from(deduped.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX);

  await supabase
    .from("app_settings")
    .upsert({ key: KEY, value: merged, updated_at: new Date().toISOString() }, { onConflict: "key" });
}
