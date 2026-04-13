import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";
import { belongsInGastos, readSupplierTags } from "@/lib/supplier-classification";
import { readSupplierAliases, resolveDisplayName } from "@/lib/supplier-aliases";

const filtersSchema = z.object({
  view: z.enum(["invoices", "suppliers", "analytics"]).default("invoices"),
  restaurant: z.string().optional(),
  supplier: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const FOOD_BEV_CUENTAPNL = ["Costo de Alimentos", "Costo de Bebidas sin Alcohol"];
function isFoodCuentaPnl(c: string | null | undefined) {
  return !!c && FOOD_BEV_CUENTAPNL.includes(c);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = filtersSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid parameters" }, { status: 422 });

  const { view, restaurant, supplier, dateFrom, dateTo, sortDir, page, pageSize } = parsed.data;
  const tenantId = session.tenantId;
  const supplierTags = await readSupplierTags(supabase, tenantId);

  if (view === "invoices") {
    // Fetch all invoices (no cuenta_pnl filter — supplier tag overrides it)
    let query = supabase.from("invoices").select("*");
    if (tenantId) query = query.eq("tenant_id", tenantId);

    if (restaurant) query = query.eq("restaurant", restaurant);
    if (supplier) query = query.ilike("supplier", `%${supplier}%`);
    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);
    query = query.order("invoice_date", { ascending: sortDir === "asc" });

    const { data: invoices, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type InvoiceRow = { id: string; supplier: string; cuenta_pnl: string | null; [k: string]: unknown };
    const filtered = ((invoices ?? []) as InvoiceRow[]).filter((inv) =>
      belongsInGastos(supplierTags[inv.supplier], isFoodCuentaPnl(inv.cuenta_pnl))
    );
    const pagedInvoices = filtered.slice((page - 1) * pageSize, page * pageSize);

    // Fetch line items for paged invoices
    const invoiceIds = pagedInvoices.map((inv) => inv.id);
    const itemsByInvoice: Record<string, unknown[]> = {};
    if (invoiceIds.length > 0) {
      const { data: lineItems } = await supabase
        .from("line_items")
        .select("*")
        .in("invoice_id", invoiceIds)
        .order("created_at", { ascending: true });
      for (const item of lineItems ?? []) {
        const key = item.invoice_id as string;
        if (!itemsByInvoice[key]) itemsByInvoice[key] = [];
        itemsByInvoice[key].push(item);
      }
    }

    const invoicesWithItems = pagedInvoices.map((inv) => ({
      ...inv,
      lineItems: itemsByInvoice[inv.id] ?? [],
    }));

    return NextResponse.json({
      invoices: invoicesWithItems,
      pagination: { page, pageSize, total: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) },
    });
  }

  if (view === "suppliers") {
    let query = supabase.from("invoices").select("id, supplier, total, invoice_date, restaurant, cuenta_pnl, concepto, invoice_number");
    if (tenantId) query = query.eq("tenant_id", tenantId);

    if (restaurant) query = query.eq("restaurant", restaurant);
    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);
    query = query.order("invoice_date", { ascending: false });

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type InvRow = { id: string; supplier: string; total: number; invoice_date: string; restaurant: string; cuenta_pnl: string | null; concepto: string | null; invoice_number: string | null };

    // Group by raw supplier name first
    const rawGrouped: Record<string, { totalSpend: number; invoiceCount: number; invoices: InvRow[] }> = {};
    for (const inv of (data ?? []) as InvRow[]) {
      if (!belongsInGastos(supplierTags[inv.supplier], isFoodCuentaPnl(inv.cuenta_pnl))) continue;
      const s = inv.supplier;
      if (!rawGrouped[s]) rawGrouped[s] = { totalSpend: 0, invoiceCount: 0, invoices: [] };
      rawGrouped[s].totalSpend += Number(inv.total) || 0;
      rawGrouped[s].invoiceCount++;
      rawGrouped[s].invoices.push(inv);
    }

    // Apply display-name aliases to merge groups
    const aliases = await readSupplierAliases(supabase, tenantId);
    const grouped: Record<string, { supplier: string; canonicalNames: string[]; totalSpend: number; invoiceCount: number; invoices: InvRow[] }> = {};
    for (const [rawName, g] of Object.entries(rawGrouped)) {
      const displayName = resolveDisplayName(rawName, aliases);
      if (!grouped[displayName]) grouped[displayName] = { supplier: displayName, canonicalNames: [], totalSpend: 0, invoiceCount: 0, invoices: [] };
      grouped[displayName].canonicalNames.push(rawName);
      grouped[displayName].totalSpend += g.totalSpend;
      grouped[displayName].invoiceCount += g.invoiceCount;
      grouped[displayName].invoices.push(...g.invoices);
    }

    const suppliers = Object.values(grouped).sort((a, b) =>
      sortDir === "desc" ? b.totalSpend - a.totalSpend : a.totalSpend - b.totalSpend
    );
    const total = suppliers.length;
    return NextResponse.json({
      suppliers: suppliers.slice((page - 1) * pageSize, page * pageSize),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }

  if (view === "analytics") {
    let query = supabase.from("invoices").select("invoice_date, total, cuenta_pnl, concepto, supplier, restaurant");
    if (tenantId) query = query.eq("tenant_id", tenantId);

    if (restaurant) query = query.eq("restaurant", restaurant);
    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type AnalyticsRow = { invoice_date: string | null; total: unknown; cuenta_pnl: string | null; concepto: string | null; supplier: string; restaurant: string };
    const items = ((data ?? []) as AnalyticsRow[]).filter((item) =>
      belongsInGastos(supplierTags[item.supplier], isFoodCuentaPnl(item.cuenta_pnl))
    );
    const totalSpend = items.reduce((s, i) => s + Number(i.total ?? 0), 0);
    const uniqueSuppliers = new Set(items.map((i) => i.supplier)).size;
    const kpis = { totalSpend, invoiceCount: items.length, uniqueSuppliers };

    // Monthly by cuentaPnl
    const monthlyMap: Record<string, Record<string, number>> = {};
    const cuentaSet = new Set<string>();
    for (const item of items) {
      if (!item.invoice_date) continue;
      const month = item.invoice_date.slice(0, 7);
      const cuenta = item.cuenta_pnl ?? "Otros";
      cuentaSet.add(cuenta);
      if (!monthlyMap[month]) monthlyMap[month] = {};
      monthlyMap[month][cuenta] = (monthlyMap[month][cuenta] ?? 0) + Number(item.total ?? 0);
    }
    const sortedMonths = Object.keys(monthlyMap).sort();
    const cuentas = Array.from(cuentaSet).sort();
    const monthlySpend = sortedMonths.map((month) => {
      const entry: Record<string, string | number> = { month };
      for (const c of cuentas) entry[c] = monthlyMap[month][c] ?? 0;
      return entry;
    });

    // Breakdown by cuentaPnl
    const cuentaTotals: Record<string, number> = {};
    for (const item of items) {
      const c = item.cuenta_pnl ?? "Otros";
      cuentaTotals[c] = (cuentaTotals[c] ?? 0) + Number(item.total ?? 0);
    }
    const breakdown = Object.entries(cuentaTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Top suppliers (apply display-name aliases)
    const aliases = await readSupplierAliases(supabase, tenantId);
    const supplierMap: Record<string, number> = {};
    for (const item of items) {
      const displayName = resolveDisplayName(item.supplier, aliases);
      supplierMap[displayName] = (supplierMap[displayName] ?? 0) + Number(item.total ?? 0);
    }
    const topSuppliers = Object.entries(supplierMap)
      .map(([supplier, total]) => ({ supplier, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return NextResponse.json({ kpis, monthlySpend, cuentas, breakdown, topSuppliers }, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    });
  }

  return NextResponse.json({ error: "Invalid view" }, { status: 400 });
}
