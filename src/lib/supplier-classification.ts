import type { SupabaseClient } from "@supabase/supabase-js";

const SETTINGS_KEY = "supplier_tags";

export const FOOD_SUPPLIER_TAGS = new Set([
  "Costo de Alimentos",
  "Costo de Bebidas sin Alcohol",
]);

export type SupplierTagMap = Record<string, string>;

export function isFoodSupplierTag(tag: string | null | undefined): boolean {
  return !!tag && FOOD_SUPPLIER_TAGS.has(tag);
}

export function hasSupplierTagOverride(tag: string | null | undefined): boolean {
  return !!tag;
}

/** Supplier belongs in Compras (food/bev tab) */
export function belongsInCompras(tag: string | null | undefined, fallbackIsFood: boolean): boolean {
  if (hasSupplierTagOverride(tag)) return isFoodSupplierTag(tag);
  return fallbackIsFood;
}

/** Supplier belongs in Gastos (operational tab) */
export function belongsInGastos(tag: string | null | undefined, fallbackIsFood: boolean): boolean {
  if (hasSupplierTagOverride(tag)) return !isFoodSupplierTag(tag);
  return !fallbackIsFood;
}

export async function readSupplierTags(
  supabase: SupabaseClient,
  tenantId?: string
): Promise<SupplierTagMap> {
  let query = supabase.from("app_settings").select("value").eq("key", SETTINGS_KEY);
  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data } = await query.limit(1).single();
  return (data?.value as SupplierTagMap) ?? {};
}
