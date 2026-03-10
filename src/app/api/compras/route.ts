import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import getSupabase from "@/lib/supabase";

const filtersSchema = z.object({
  view: z.enum(["items", "invoices", "suppliers"]).default("items"),
  search: z.string().optional(),
  restaurant: z.string().optional(),
  supplier: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(["date", "description", "total", "supplier"]).default("date"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

const createItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().nullable().optional().default(null),
  unit: z.string().nullable().optional().default(null),
  unitPrice: z.number().nullable().optional().default(null),
  total: z.number(),
  restaurant: z.string().min(1),
  supplier: z.string().min(1),
  invoiceDate: z.string().optional().default(new Date().toISOString().slice(0, 10)),
  invoiceId: z.string().nullable().optional().default(null),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = filtersSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 422 });
  }

  const { view, search, restaurant, supplier, dateFrom, dateTo, sortBy, sortDir, page, pageSize } = parsed.data;

  if (view === "items") {
    let query = supabase.from("line_items").select("*", { count: "exact" });

    if (search) query = query.ilike("description", `%${search}%`);
    if (restaurant) query = query.eq("restaurant", restaurant);
    if (supplier) query = query.eq("supplier", supplier);
    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);

    const sortColumn = sortBy === "date" ? "invoice_date" : sortBy === "description" ? "description" : sortBy === "total" ? "total" : "supplier";
    query = query.order(sortColumn, { ascending: sortDir === "asc" });
    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      items: data ?? [],
      pagination: { page, pageSize, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / pageSize) },
    });
  }

  if (view === "invoices") {
    let invoiceQuery = supabase.from("invoices").select("*", { count: "exact" });

    if (restaurant) invoiceQuery = invoiceQuery.eq("restaurant", restaurant);
    if (supplier) invoiceQuery = invoiceQuery.ilike("supplier", `%${supplier}%`);
    if (dateFrom) invoiceQuery = invoiceQuery.gte("invoice_date", dateFrom);
    if (dateTo) invoiceQuery = invoiceQuery.lte("invoice_date", dateTo);

    invoiceQuery = invoiceQuery.order("invoice_date", { ascending: sortDir === "asc" });
    invoiceQuery = invoiceQuery.range((page - 1) * pageSize, page * pageSize - 1);

    const { data: invoices, count, error } = await invoiceQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch line items for these invoices
    const invoiceIds = (invoices ?? []).map((inv) => inv.id);
    let items: Record<string, unknown[]> = {};
    if (invoiceIds.length > 0) {
      const { data: lineItems } = await supabase
        .from("line_items")
        .select("*")
        .in("invoice_id", invoiceIds)
        .order("created_at", { ascending: true });

      for (const item of lineItems ?? []) {
        const key = item.invoice_id as string;
        if (!items[key]) items[key] = [];
        items[key].push(item);
      }
    }

    const invoicesWithItems = (invoices ?? []).map((inv) => ({
      ...inv,
      lineItems: items[inv.id] ?? [],
    }));

    return NextResponse.json({
      invoices: invoicesWithItems,
      pagination: { page, pageSize, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / pageSize) },
    });
  }

  if (view === "suppliers") {
    // Get unique suppliers with aggregated data
    let query = supabase.from("line_items").select("supplier, total, invoice_date, description, id, restaurant, quantity, unit, unit_price, invoice_id, created_at, updated_at");

    if (search) query = query.ilike("description", `%${search}%`);
    if (restaurant) query = query.eq("restaurant", restaurant);
    if (supplier) query = query.eq("supplier", supplier);
    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);
    query = query.order("supplier", { ascending: true }).order("invoice_date", { ascending: false });

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Group by supplier
    const grouped: Record<string, { supplier: string; totalSpend: number; itemCount: number; items: unknown[] }> = {};
    for (const item of data ?? []) {
      const s = item.supplier as string;
      if (!grouped[s]) grouped[s] = { supplier: s, totalSpend: 0, itemCount: 0, items: [] };
      grouped[s].totalSpend += Number(item.total) || 0;
      grouped[s].itemCount++;
      grouped[s].items.push(item);
    }

    const suppliers = Object.values(grouped).sort((a, b) =>
      sortBy === "total" ? (sortDir === "desc" ? b.totalSpend - a.totalSpend : a.totalSpend - b.totalSpend) : a.supplier.localeCompare(b.supplier)
    );

    // Paginate the supplier groups
    const total = suppliers.length;
    const paged = suppliers.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      suppliers: paged,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }

  return NextResponse.json({ error: "Invalid view" }, { status: 400 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const { description, quantity, unit, unitPrice, total, restaurant, supplier, invoiceDate, invoiceId } = parsed.data;

  const { data, error } = await supabase
    .from("line_items")
    .insert({
      invoice_id: invoiceId,
      restaurant,
      supplier,
      invoice_date: invoiceDate,
      description,
      quantity,
      unit,
      unit_price: unitPrice,
      total,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
