/**
 * tenant.ts — helpers for resolving the current tenant from the session.
 *
 * Every data-touching API route should call `getTenantId()` and bail with 403
 * if the result is null. This enforces tenant isolation at the application layer.
 */

import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

/** Returns the tenantId stored in the current session, or null if not present. */
export async function getTenantId(): Promise<string | null> {
  const session = await getSession();
  return session.tenantId ?? null;
}

/**
 * Fetches the settings JSONB for a given tenant from the `tenants` table.
 * Returns null if Supabase is unavailable or the tenant doesn't exist.
 */
export async function getTenantSettings(tenantId: string): Promise<Record<string, unknown> | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();
  return (data?.settings as Record<string, unknown>) ?? null;
}

/**
 * Fetches the restaurant list for a given tenant.
 * Returns [] if Supabase is unavailable.
 */
export async function getTenantRestaurants(
  tenantId: string
): Promise<Array<{ value: string; label: string }>> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("restaurants")
    .select("slug, label")
    .eq("tenant_id", tenantId)
    .order("label", { ascending: true });
  return (data ?? []).map((r) => ({ value: r.slug as string, label: r.label as string }));
}

/**
 * Returns the valid restaurant slugs for a tenant (for input validation).
 */
export async function getTenantRestaurantSlugs(tenantId: string): Promise<string[]> {
  const restaurants = await getTenantRestaurants(tenantId);
  return restaurants.map((r) => r.value);
}

/**
 * Saves (upserts) settings for a tenant.
 */
export async function saveTenantSettings(
  tenantId: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  // Read current + merge
  const current = (await getTenantSettings(tenantId)) ?? {};
  const merged = { ...current, ...patch };

  const { error } = await supabase
    .from("tenants")
    .update({ settings: merged })
    .eq("id", tenantId);

  return !error;
}
