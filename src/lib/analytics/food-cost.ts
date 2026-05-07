import type { SupabaseClient } from "@supabase/supabase-js";

type Filters = {
  restaurant?: string;
  supplier?: string;
  search?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
};

type LineItemRow = {
  id: string;
  invoice_id: string | null;
  restaurant: string;
  supplier: string;
  invoice_date: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_normalized: string | null;
  unit_price: number | null;
  total: number;
  category: string | null;
  ingredient_id: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceRow = {
  id: string;
  restaurant: string;
  supplier: string;
  invoice_date: string;
  total: number;
};

function applyFilters(
  query: ReturnType<SupabaseClient["from"]>,
  filters: Filters,
  tenantId?: string
) {
  if (tenantId) query = (query as any).eq("tenant_id", tenantId);
  if (filters.restaurant) query = (query as any).eq("restaurant", filters.restaurant);
  if (filters.supplier) query = (query as any).ilike("supplier", `%${filters.supplier}%`);
  if (filters.category) query = (query as any).eq("category", filters.category);
  if (filters.search) query = (query as any).ilike("description", `%${filters.search}%`);
  if (filters.dateFrom) query = (query as any).gte("invoice_date", filters.dateFrom);
  if (filters.dateTo) query = (query as any).lte("invoice_date", filters.dateTo);
  return query;
}

export async function loadFoodData(
  supabase: SupabaseClient,
  tenantId: string | undefined,
  filters: Filters
): Promise<{ items: LineItemRow[]; invoices: InvoiceRow[] }> {
  let itemQ = supabase
    .from("line_items")
    .select("id,invoice_id,restaurant,supplier,invoice_date,description,quantity,unit,unit_normalized,unit_price,total,category,ingredient_id,created_at,updated_at")
    .is("deleted_at", null);
  itemQ = applyFilters(itemQ as any, filters, tenantId) as any;
  const { data: items } = await itemQ;

  let invQ = supabase
    .from("invoices")
    .select("id,restaurant,supplier,invoice_date,total")
    .is("deleted_at", null);
  if (tenantId) invQ = (invQ as any).eq("tenant_id", tenantId);
  if (filters.restaurant) invQ = (invQ as any).eq("restaurant", filters.restaurant);
  if (filters.supplier) invQ = (invQ as any).ilike("supplier", `%${filters.supplier}%`);
  if (filters.dateFrom) invQ = (invQ as any).gte("invoice_date", filters.dateFrom);
  if (filters.dateTo) invQ = (invQ as any).lte("invoice_date", filters.dateTo);
  const { data: invoices } = await invQ;

  return { items: (items ?? []) as LineItemRow[], invoices: (invoices ?? []) as InvoiceRow[] };
}

export function summarizeFoodData(
  items: LineItemRow[],
  invoices: InvoiceRow[]
): { itemCount: number; totalSpend: number; supplierCount: number } {
  const totalSpend = items.reduce((s, i) => s + Number(i.total), 0);
  const supplierCount = new Set(items.map((i) => i.supplier)).size;
  return { itemCount: items.length, totalSpend, supplierCount };
}

export async function buildFoodCostAnalytics(
  supabase: SupabaseClient,
  tenantId: string | undefined,
  filters: Filters
) {
  const { items, invoices } = await loadFoodData(supabase, tenantId, filters);

  const totalSpend = items.reduce((s, i) => s + Number(i.total), 0);
  const supplierSet = new Set(items.map((i) => i.supplier));
  const invoiceSet = new Set(items.map((i) => i.invoice_id).filter(Boolean));
  const invoiceCount = invoiceSet.size || invoices.length;
  const avgPerInvoice = invoiceCount > 0 ? totalSpend / invoiceCount : 0;

  // Category breakdown
  const catMap = new Map<string, number>();
  for (const item of items) {
    const key = item.category ?? "Sin categoría";
    catMap.set(key, (catMap.get(key) ?? 0) + Number(item.total));
  }
  const categories = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => ({ name, total }));

  // Supplier breakdown
  const supMap = new Map<string, number>();
  for (const item of items) {
    supMap.set(item.supplier, (supMap.get(item.supplier) ?? 0) + Number(item.total));
  }
  const suppliers = [...supMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([supplier, total]) => ({ supplier, total }));

  // Top items by description
  const itemMap = new Map<string, { total: number; count: number }>();
  for (const item of items) {
    const cur = itemMap.get(item.description) ?? { total: 0, count: 0 };
    itemMap.set(item.description, { total: cur.total + Number(item.total), count: cur.count + 1 });
  }
  const topItems = [...itemMap.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .map(([label, v]) => ({ label, total: v.total, count: v.count }));

  // Weekly trend
  const weekMap = new Map<string, number>();
  for (const item of items) {
    const d = new Date(item.invoice_date);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    const week = monday.toISOString().slice(0, 10);
    weekMap.set(week, (weekMap.get(week) ?? 0) + Number(item.total));
  }
  const trend = [...weekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, total]) => ({ week, total }));

  // Restaurant breakdown
  const restMap = new Map<string, number>();
  for (const item of items) {
    restMap.set(item.restaurant, (restMap.get(item.restaurant) ?? 0) + Number(item.total));
  }
  const restaurants = [...restMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([restaurant, total]) => ({ restaurant, total }));

  return {
    kpis: { totalSpend, invoiceCount, supplierCount: supplierSet.size, avgPerInvoice },
    categories,
    trend,
    suppliers,
    topItems,
    restaurants,
  };
}
