/**
 * parrot.ts — Parrot POS API client and sync logic.
 *
 * Architecture: On-demand sync-to-Supabase. UI queries Supabase; this lib
 * pulls from Parrot and upserts. Never proxy Parrot live to the UI.
 *
 * Key params:
 * - Date range:  startTimestamp + endTimestamp  (ISO strings, max 48h apart)
 * - Pagination:  page=0 (0-based), size=100 max
 * - Store filter: storeUUID
 * - Rate limit:  15 req/min → x-rate-limit-remaining header
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import getSupabase from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ParrotConfig = {
  apiKey: string;
  storeUUIDs: string[];
};

type PaginationMeta = {
  page?: number;
  next: number | null;
  previous: number | null;
  count?: number;
  current?: number;
  pageSize?: number;
};

type ParrotResponse<T> = {
  data: T[];
  pagination: PaginationMeta;
};

// Raw shapes returned by the Parrot API
type ParrotOrder = {
  uuid: string;
  createdAt?: string;
  finishedAt?: string;
  status?: string;
  orderType?: string;
  provider?: string;
  total?: string | number;      // API returns string ("451.00")
  totalDiscounts?: string | number;
  totalTaxes?: string | number;
  customersCount?: number;
};

type ParrotOrderItem = {
  uuid: string;
  orderUuid?: string;
  createdAt?: string;
  itemName?: string;
  sku?: string;
  categoryUuid?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  discount?: number;
  total?: number;
  itemStatus?: string;
  provider?: string;
};

type ParrotCashierSession = {
  uuid: string;
  sessionNumber?: number;
  state?: string;
  startedAt?: string;
  finishedAt?: string;
  sales?: { totalSales?: number };
  [key: string]: unknown;
};

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Reads Parrot credentials from tenants.settings.parrot.
 * Returns null if not configured.
 */
export async function getParrotConfig(tenantId: string): Promise<ParrotConfig | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();

  const settings = data?.settings as Record<string, unknown> | null;
  const parrot = settings?.parrot as ParrotConfig | null;

  if (!parrot?.apiKey || !Array.isArray(parrot.storeUUIDs) || parrot.storeUUIDs.length === 0) {
    return null;
  }

  return parrot;
}

// ─── HTTP Client ─────────────────────────────────────────────────────────────

const BASE_URL = "https://api.parrot.rest/external";

async function parrotFetch<T>(
  apiKey: string,
  path: string,
  params: Record<string, string | number> = {}
): Promise<ParrotResponse<T>> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Parrot API ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<ParrotResponse<T>>;
}

/**
 * Fetches all pages for a given endpoint + params.
 * Stops when pagination.next is null or we get an empty page.
 */
async function fetchAllPages<T>(
  apiKey: string,
  path: string,
  params: Record<string, string | number> = {}
): Promise<T[]> {
  const results: T[] = [];
  let page = 0;

  while (true) {
    const resp = await parrotFetch<T>(apiKey, path, { ...params, page, size: 100 });
    const items = resp.data ?? [];
    results.push(...items);

    // pagination.next is the next page number (int) or null when done
    if (resp.pagination?.next == null || items.length === 0) break;
    page++;
  }

  return results;
}

// ─── Date Range Chunking ──────────────────────────────────────────────────────

/**
 * Splits [startTs, endTs] into chunks of at most maxHours hours.
 * Returns array of [chunkStart, chunkEnd] ISO string pairs.
 */
export function chunkDateRange(
  startTs: string,
  endTs: string,
  maxHours = 47
): Array<[string, string]> {
  const chunks: Array<[string, string]> = [];
  let cur = new Date(startTs).getTime();
  const end = new Date(endTs).getTime();
  const maxMs = maxHours * 60 * 60 * 1000;

  while (cur < end) {
    const chunkEnd = Math.min(cur + maxMs, end);
    chunks.push([new Date(cur).toISOString(), new Date(chunkEnd).toISOString()]);
    cur = chunkEnd;
  }

  return chunks;
}

// ─── Sync Functions ───────────────────────────────────────────────────────────

export async function syncOrders(
  supabase: SupabaseClient,
  tenantId: string,
  apiKey: string,
  storeUUIDs: string[],
  startTs: string,
  endTs: string
): Promise<number> {
  let total = 0;

  for (const storeUUID of storeUUIDs) {
    const chunks = chunkDateRange(startTs, endTs);

    for (const [from, to] of chunks) {
      const orders = await fetchAllPages<ParrotOrder>(apiKey, "/v1/orders", {
        storeUUID,
        startTimestamp: from,
        endTimestamp: to,
      });

      if (orders.length === 0) continue;

      const rows = orders.map((o) => ({
        uuid: o.uuid,
        tenant_id: tenantId,
        store_uuid: storeUUID,
        created_at: o.createdAt ?? null,
        finished_at: o.finishedAt ?? null,
        status: o.status ?? null,
        order_type: o.orderType ?? null,
        provider: o.provider ?? null,
        total: o.total != null ? parseFloat(String(o.total)) : null,
        total_discounts: o.totalDiscounts != null ? parseFloat(String(o.totalDiscounts)) : null,
        total_taxes: o.totalTaxes != null ? parseFloat(String(o.totalTaxes)) : null,
        customers_count: o.customersCount ?? null,
      }));

      const { error } = await supabase
        .from("pos_orders")
        .upsert(rows, { onConflict: "uuid" });

      if (error) throw new Error(`pos_orders upsert: ${error.message}`);
      total += rows.length;
    }
  }

  return total;
}

export async function syncOrderItems(
  supabase: SupabaseClient,
  tenantId: string,
  apiKey: string,
  storeUUIDs: string[],
  startTs: string,
  endTs: string
): Promise<number> {
  let total = 0;

  for (const storeUUID of storeUUIDs) {
    const chunks = chunkDateRange(startTs, endTs);

    for (const [from, to] of chunks) {
      const items = await fetchAllPages<ParrotOrderItem>(apiKey, "/v2/order-items", {
        storeUUID,
        startTimestamp: from,
        endTimestamp: to,
      });

      if (items.length === 0) continue;

      const rows = items.map((i) => ({
        uuid: i.uuid,
        tenant_id: tenantId,
        order_uuid: i.orderUuid ?? "",
        store_uuid: storeUUID,
        created_at: i.createdAt ?? null,
        item_name: i.itemName ?? null,
        sku: i.sku ?? null,
        category_uuid: i.categoryUuid ?? null,
        quantity: i.quantity ?? null,
        unit_price: i.unitPrice ?? null,
        total_price: i.totalPrice ?? null,
        discount: i.discount ?? null,
        total: i.total ?? null,
        item_status: i.itemStatus ?? null,
        provider: i.provider ?? null,
      }));

      const { error } = await supabase
        .from("pos_order_items")
        .upsert(rows, { onConflict: "uuid" });

      if (error) throw new Error(`pos_order_items upsert: ${error.message}`);
      total += rows.length;
    }
  }

  return total;
}

export async function syncCashierSessions(
  supabase: SupabaseClient,
  tenantId: string,
  apiKey: string,
  storeUUIDs: string[],
  startTs: string,
  endTs: string
): Promise<number> {
  let total = 0;

  for (const storeUUID of storeUUIDs) {
    const chunks = chunkDateRange(startTs, endTs);

    for (const [from, to] of chunks) {
      const sessions = await fetchAllPages<ParrotCashierSession>(apiKey, "/v1/cashier-sessions", {
        storeUUID,
        startTimestamp: from,
        endTimestamp: to,
      });

      if (sessions.length === 0) continue;

      const rows = sessions.map((s) => ({
        uuid: s.uuid,
        tenant_id: tenantId,
        store_uuid: storeUUID,
        session_number: s.sessionNumber != null ? String(s.sessionNumber) : null,
        state: s.state ?? null,
        started_at: s.startedAt ?? null,
        finished_at: s.finishedAt ?? null,
        total_sales: s.sales?.totalSales ?? null,
        raw_data: s,
      }));

      const { error } = await supabase
        .from("pos_cashier_sessions")
        .upsert(rows, { onConflict: "uuid" });

      if (error) throw new Error(`pos_cashier_sessions upsert: ${error.message}`);
      total += rows.length;
    }
  }

  return total;
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export type SyncResult = {
  ordersCount: number;
  itemsCount: number;
  sessionsCount: number;
  syncedAt: string;
  error?: string;
};

export async function syncAll(
  tenantId: string,
  startTs: string,
  endTs: string
): Promise<SyncResult> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const config = await getParrotConfig(tenantId);
  if (!config) throw new Error("Parrot credentials not configured for this tenant");

  const { apiKey, storeUUIDs } = config;
  const syncedAt = new Date().toISOString();

  let ordersCount = 0;
  let itemsCount = 0;
  let sessionsCount = 0;
  let syncError: string | undefined;

  try {
    [ordersCount, itemsCount, sessionsCount] = await Promise.all([
      syncOrders(supabase, tenantId, apiKey, storeUUIDs, startTs, endTs),
      syncOrderItems(supabase, tenantId, apiKey, storeUUIDs, startTs, endTs),
      syncCashierSessions(supabase, tenantId, apiKey, storeUUIDs, startTs, endTs),
    ]);
  } catch (err) {
    syncError = err instanceof Error ? err.message : "Unknown error";
  }

  // Write audit log regardless of success/failure
  await supabase.from("pos_sync_log").insert({
    tenant_id: tenantId,
    start_ts: startTs,
    end_ts: endTs,
    orders_synced: ordersCount,
    items_synced: itemsCount,
    sessions_synced: sessionsCount,
    error: syncError ?? null,
  });

  if (syncError) throw new Error(syncError);

  return { ordersCount, itemsCount, sessionsCount, syncedAt };
}
