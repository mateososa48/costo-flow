import { RESTAURANT_LABELS } from "@/types";
import type { Restaurant } from "@/types";

// ─── Types ──────────────────────────────────────────────────────────
export type ViewMode = "items" | "invoices" | "suppliers" | "analytics" | "normalize";

export type DbLineItem = {
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

export type Ingredient = {
  id: string;
  canonical_name: string;
  aliases: string[];
  category: string | null;
  default_unit: string | null;
};

export type UnmatchedGroup = {
  description: string;
  count: number;
  suppliers: string[];
};

export type AnalyticsData = {
  kpis: { totalSpend: number; uniqueInvoices: number; uniqueSuppliers: number; avgPerInvoice: number };
  monthlySpend: Array<Record<string, string | number>>;
  categories: string[];
  weeklyTrend: Array<{ week: string; total: number }>;
  categoryBreakdown: Array<{ name: string; value: number }>;
  spendBySupplier: Array<{ supplier: string; total: number }>;
  topItems: Array<{ description: string; totalSpend: number; count: number }>;
  spendByRestaurant: Array<{ restaurant: string; total: number }>;
};

export type DbInvoice = {
  id: string;
  restaurant: string;
  supplier: string;
  invoice_number: string | null;
  invoice_date: string;
  importe: number;
  iva: number;
  total: number;
  concepto: string | null;
  cuenta_pnl: string | null;
  submitted_by: string;
  submitted_at: string;
  spreadsheet_url: string | null;
  file_url: string | null;
  lineItems: DbLineItem[];
};

export type SupplierGroup = {
  supplier: string;
  totalSpend: number;
  itemCount: number;
  items: DbLineItem[];
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Stats = {
  totalItems: number;
  totalSpend: number;
  uniqueSuppliers: number;
  supplierList: string[];
};

export type AISuggestion = {
  canonicalName: string;
  aliases: string[];
  category: string | null;
  matchCount: number;
};

// ─── Constants ──────────────────────────────────────────────────────
export const BLUE_SHADES = [
  "#0450A9", "#2E6EC4", "#5589D4", "#7AA5E0",
  "#9DC0EC", "#C0D9F5", "#033D82", "#1A5DB8",
  "#3A7FCC", "#042F6B",
];

export const PINK_SHADES = [
  "#C97F7E", "#D99998", "#B36564", "#E8B3B2",
  "#9D4F4E", "#F2CDCC", "#874040", "#DEBDBC",
  "#A06160", "#F7E4E4",
];

export const NORMALIZED_UNITS_LIST = [
  "kg", "g", "l", "ml", "pz", "caja", "docena",
  "bolsa", "metro", "lata", "botella", "galon",
  "costal", "sobre", "rollo", "otros",
];

// ─── Helpers ────────────────────────────────────────────────────────
export function getPresetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (preset === "thisMonth") {
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (preset === "lastMonth") {
    return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  if (preset === "last30") {
    const f = new Date(now); f.setDate(f.getDate() - 30);
    return { from: iso(f), to: iso(now) };
  }
  if (preset === "ytd") {
    return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
  }
  return { from: "", to: "" };
}

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(val);
}

export function formatDate(d: string): string {
  if (!d) return "—";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
}

export function restaurantLabel(r: string): string {
  return RESTAURANT_LABELS[r as Restaurant] ?? r;
}

export function getMonthOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts;
}

export function getWeekOptions() {
  const opts: { value: string; label: string; dateFrom: string; dateTo: string }[] = [];
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  for (let i = 0; i < 12; i++) {
    const mon = new Date(monday);
    mon.setDate(monday.getDate() - i * 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    opts.push({ value: toISO(mon), label: `${fmt(mon)} – ${fmt(sun)}`, dateFrom: toISO(mon), dateTo: toISO(sun) });
  }
  return opts;
}
