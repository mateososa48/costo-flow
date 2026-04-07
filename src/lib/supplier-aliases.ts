import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPPLIER_ALIASES_KEY = "supplier_aliases";

/** Returns map of rawName → displayName. Missing entries mean displayName === rawName. */
export async function readSupplierAliases(
  supabase: SupabaseClient
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SUPPLIER_ALIASES_KEY)
    .single();
  return (data?.value as Record<string, string>) ?? {};
}

/** Returns the display name for a raw supplier name. */
export function resolveDisplayName(rawName: string, aliases: Record<string, string>): string {
  return aliases[rawName] ?? rawName;
}
