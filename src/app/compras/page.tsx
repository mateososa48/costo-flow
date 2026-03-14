"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Shell from "@/components/Shell";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { RESTAURANT_LABELS } from "@/types";
import type { Restaurant } from "@/types";
import dropdownOptions from "../../../data/dropdown_options.json";

// ─── Types ──────────────────────────────────────────────────────────
type ViewMode = "items" | "invoices" | "suppliers" | "analytics" | "normalize";

type DbLineItem = {
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

type Ingredient = {
  id: string;
  canonical_name: string;
  aliases: string[];
  category: string | null;
  default_unit: string | null;
};

type UnmatchedGroup = {
  description: string;
  count: number;
};

type AnalyticsData = {
  kpis: { totalSpend: number; uniqueInvoices: number; uniqueSuppliers: number; avgPerInvoice: number };
  monthlySpend: Array<Record<string, string | number>>;
  categories: string[];
  weeklyTrend: Array<{ week: string; total: number }>;
  categoryBreakdown: Array<{ name: string; value: number }>;
  spendBySupplier: Array<{ supplier: string; total: number }>;
  topItems: Array<{ description: string; totalSpend: number; count: number }>;
  spendByRestaurant: Array<{ restaurant: string; total: number }>;
};

const BLUE_SHADES = [
  "#0450A9", "#2E6EC4", "#5589D4", "#7AA5E0",
  "#9DC0EC", "#C0D9F5", "#033D82", "#1A5DB8",
  "#3A7FCC", "#042F6B",
];

const PINK_SHADES = [
  "#C97F7E", "#D99998", "#B36564", "#E8B3B2",
  "#9D4F4E", "#F2CDCC", "#874040", "#DEBDBC",
  "#A06160", "#F7E4E4",
];

type DbInvoice = {
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
  lineItems: DbLineItem[];
};

type SupplierGroup = {
  supplier: string;
  totalSpend: number;
  itemCount: number;
  items: DbLineItem[];
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Stats = {
  totalItems: number;
  totalSpend: number;
  uniqueSuppliers: number;
  supplierList: string[];
};

// ─── Helpers ────────────────────────────────────────────────────────
function getPresetRange(preset: string): { from: string; to: string } {
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

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(val);
}

function formatDate(d: string): string {
  if (!d) return "—";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
}

function restaurantLabel(r: string): string {
  return RESTAURANT_LABELS[r as Restaurant] ?? r;
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function ComprasPage() {
  const [view, setView] = useState<ViewMode>("items");
  const [search, setSearch] = useState("");
  const [restaurant, setRestaurant] = useState("");
  const [supplier, setSupplier] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [activePreset, setActivePreset] = useState("");

  const [items, setItems] = useState<DbLineItem[]>([]);
  const [invoices, setInvoices] = useState<DbInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierGroup[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<Stats>({ totalItems: 0, totalSpend: 0, uniqueSuppliers: 0, supplierList: [] });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState("");
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [invoiceSelectMode, setInvoiceSelectMode] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [confirmDeleteInvoices, setConfirmDeleteInvoices] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Normalize state
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedGroup[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [normalizeLoading, setNormalizeLoading] = useState(false);
  const [createIngredientFor, setCreateIngredientFor] = useState<string | null>(null);
  const [ingredientEditMode, setIngredientEditMode] = useState(false);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<Set<string>>(new Set());
  const [confirmDeleteIngredients, setConfirmDeleteIngredients] = useState(false);
  const [deletingIngredients, setDeletingIngredients] = useState(false);
  const [mergeFor, setMergeFor] = useState<string | null>(null);
  const [mergingIntoId, setMergingIntoId] = useState("");
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeHighlight, setMergeHighlight] = useState(-1);
  const [normalizeSaving, setNormalizeSaving] = useState(false);
  const [expandedIngredientId, setExpandedIngredientId] = useState<string | null>(null);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [unmatchedCollapsed, setUnmatchedCollapsed] = useState(false);
  const [editModalIngredient, setEditModalIngredient] = useState<Ingredient | null>(null);
  const [normalizeMode, setNormalizeMode] = useState<"list" | "identify">("list");
  const [ingredientCategoryFilter, setIngredientCategoryFilter] = useState("");
  // Invoice reclassification state
  const [reclassifyingId, setReclassifyingId] = useState<string | null>(null);
  const [reclassifyValue, setReclassifyValue] = useState("");
  const [reclassifyingSaving, setReclassifyingSaving] = useState(false);

  // Supplier tags state
  const [supplierTags, setSupplierTags] = useState<Record<string, string>>({});
  const [editingSupplierTag, setEditingSupplierTag] = useState<string | null>(null);

  // AI suggestion state
  type AISuggestion = { canonicalName: string; aliases: string[]; category: string | null; matchCount: number };
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiChecked, setAiChecked] = useState<Set<number>>(new Set());
  const [aiConfirming, setAiConfirming] = useState(false);

  // ── Fetch analytics (respects global date filter) ───────────────
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams();
      if (restaurant) params.set("restaurant", restaurant);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/compras/analytics?${params}`);
      if (res.ok) setAnalyticsData(await res.json());
    } catch { /* ignore */ }
    finally { setAnalyticsLoading(false); }
  }, [restaurant, dateFrom, dateTo]);

  // ── Fetch normalize data ─────────────────────────────────────────
  const fetchNormalize = useCallback(async () => {
    setNormalizeLoading(true);
    // Backfill category from ingredients → line_items (safe no-op if already done)
    fetch("/api/compras/ingredients/backfill", { method: "POST" }).catch(() => {});
    try {
      const [ingRes, unmatchedRes] = await Promise.all([
        fetch("/api/compras/ingredients"),
        fetch("/api/compras?view=normalize&pageSize=100"),
      ]);
      if (ingRes.ok) setIngredients(await ingRes.json());
      if (unmatchedRes.ok) {
        const data = await unmatchedRes.json();
        setUnmatched(data.unmatched ?? []);
      }
    } catch { /* ignore */ }
    finally { setNormalizeLoading(false); }
  }, []);

  // ── Fetch stats ─────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (restaurant) params.set("restaurant", restaurant);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/compras/stats?${params}`);
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, [restaurant, dateFrom, dateTo]);

  // ── Fetch data ──────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ view, page: String(page), sortBy, sortDir });
      if (search) params.set("search", search);
      if (restaurant) params.set("restaurant", restaurant);
      if (supplier) params.set("supplier", supplier);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/compras?${params}`);
      if (!res.ok) { setError("Error al cargar datos"); return; }
      const data = await res.json();

      setPagination(data.pagination);
      if (view === "items") setItems(data.items ?? []);
      else if (view === "invoices") setInvoices(data.invoices ?? []);
      else if (view === "suppliers") setSuppliers(data.suppliers ?? []);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [view, page, sortBy, sortDir, search, restaurant, supplier, dateFrom, dateTo]);

  useEffect(() => { document.title = "Gastos de Alimentos — Aventura Gourmet"; }, []);
  useEffect(() => { if (view !== "analytics" && view !== "normalize") fetchData(); }, [fetchData, view]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { setPage(1); }, [view, search, restaurant, supplier, dateFrom, dateTo]);
  useEffect(() => { if (view === "analytics") fetchAnalytics(); }, [view, fetchAnalytics]);
  useEffect(() => { if (view === "normalize") fetchNormalize(); }, [view, fetchNormalize]);
  useEffect(() => {
    if (view === "suppliers") {
      fetch("/api/compras/suppliers/tags")
        .then((r) => (r.ok ? r.json() : {}))
        .then(setSupplierTags)
        .catch(() => {});
    }
  }, [view]);
  // Keep unmatchedCount up to date whenever unmatched list changes
  useEffect(() => { setUnmatchedCount(unmatched.length); }, [unmatched]);
  // Also fetch count on mount so the dot shows even before visiting the Ingredientes tab
  useEffect(() => {
    fetch("/api/compras?view=normalize&pageSize=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.pagination?.total != null) setUnmatchedCount(data.pagination.total); })
      .catch(() => {});
  }, []);

  // ── Inline edit ─────────────────────────────────────────────────
  async function saveEdit(id: string, field: string, value: string) {
    const numFields = ["quantity", "unitPrice", "total"];
    const body: Record<string, unknown> = {};
    if (numFields.includes(field)) {
      body[field] = value === "" ? null : parseFloat(value);
    } else {
      body[field] = value || null;
    }

    // Snapshot for revert
    const previous = items;
    // Optimistic update
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item };
        if (field === "description") updated.description = value;
        if (field === "quantity") updated.quantity = value ? parseFloat(value) : null;
        if (field === "unit") updated.unit = value || null;
        if (field === "unitPrice") updated.unit_price = value ? parseFloat(value) : null;
        if (field === "total") updated.total = parseFloat(value) || 0;
        return updated;
      })
    );
    setEditingId(null);
    setSavingId(id);
    setSaveError("");

    try {
      const res = await fetch(`/api/compras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setItems(previous);
        setSaveError("No se pudo guardar el cambio. Intenta de nuevo.");
      }
    } catch {
      setItems(previous);
      setSaveError("Error de conexión. El cambio no fue guardado.");
    } finally {
      setSavingId(null);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await fetch(`/api/compras/${deleteConfirmId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== deleteConfirmId));
      fetchStats();
    } catch { /* ignore */ }
    finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  }

  // ── Delete invoice(s) ────────────────────────────────────────────
  async function confirmDeleteInvoice() {
    if (!deleteInvoiceId) return;
    setDeletingInvoice(true);
    try {
      await fetch(`/api/compras/invoices/${deleteInvoiceId}`, { method: "DELETE" });
      setInvoices((prev) => prev.filter((i) => i.id !== deleteInvoiceId));
      fetchStats();
    } catch { /* ignore */ }
    finally {
      setDeletingInvoice(false);
      setDeleteInvoiceId(null);
    }
  }

  async function deleteSelectedInvoices() {
    setDeletingInvoice(true);
    try {
      await Promise.all(
        Array.from(selectedInvoiceIds).map((id) =>
          fetch(`/api/compras/invoices/${id}`, { method: "DELETE" })
        )
      );
      setInvoices((prev) => prev.filter((i) => !selectedInvoiceIds.has(i.id)));
      setSelectedInvoiceIds(new Set());
      setInvoiceSelectMode(false);
      fetchStats();
    } catch { /* ignore */ }
    finally {
      setDeletingInvoice(false);
      setConfirmDeleteInvoices(false);
    }
  }

  // ── Delete ingredients (bulk) ─────────────────────────────────────
  async function deleteSelectedIngredients() {
    setDeletingIngredients(true);
    try {
      await Promise.all(
        Array.from(selectedIngredientIds).map((id) =>
          fetch(`/api/compras/ingredients/${id}`, { method: "DELETE" })
        )
      );
      setIngredients((prev) => prev.filter((i) => !selectedIngredientIds.has(i.id)));
      setSelectedIngredientIds(new Set());
      setIngredientEditMode(false);
      fetchNormalize();
    } catch { /* ignore */ }
    finally {
      setDeletingIngredients(false);
      setConfirmDeleteIngredients(false);
    }
  }

  // ── Date shortcut helpers ─────────────────────────────────────────
  function getMonthOptions() {
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

  function getWeekOptions() {
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

  function handleMonthSelect(value: string) {
    setSelectedMonth(value);
    setSelectedWeek("");
    setActivePreset("");
    if (value) {
      const [y, m] = value.split("-").map(Number);
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      setDateFrom(toISO(first));
      setDateTo(toISO(last));
    } else {
      setDateFrom(""); setDateTo("");
    }
  }

  function handleWeekSelect(value: string) {
    setSelectedWeek(value);
    setSelectedMonth("");
    setActivePreset("");
    if (value) {
      const week = getWeekOptions().find((w) => w.value === value);
      if (week) { setDateFrom(week.dateFrom); setDateTo(week.dateTo); }
    } else {
      setDateFrom(""); setDateTo("");
    }
  }

  // ── Reset filters ────────────────────────────────────────────────
  function resetFilters() {
    setSearch(""); setRestaurant(""); setSupplier(""); setDateFrom(""); setDateTo("");
    setSelectedMonth(""); setSelectedWeek(""); setActivePreset("");
  }

  function applyPreset(preset: string) {
    const { from, to } = getPresetRange(preset);
    setDateFrom(from); setDateTo(to);
    setSelectedMonth(""); setSelectedWeek("");
    setActivePreset(preset);
    setPage(1);
  }

  // ── Sort toggle ─────────────────────────────────────────────────
  function toggleSort(col: string) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  }

  function startEdit(id: string, field: string, currentValue: string) {
    setEditingId(id);
    setEditField(field);
    setEditValue(currentValue);
  }

  const hasFilters = !!(search || restaurant || supplier || dateFrom || dateTo || selectedMonth || selectedWeek);
  const deleteTarget = items.find((i) => i.id === deleteConfirmId);

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-0 animate-fade-up">
        {/* Header row: title + action */}
        <div className="flex items-center justify-between gap-4 pb-4">
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text)" }}>
            Gastos de Alimentos
          </h1>
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Agregar</span>
          </Button>
        </div>



        {/* Tabs + filter toggle */}
        <div className="flex items-center justify-between gap-2 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-0 -mb-px overflow-x-auto">
            {([
              { key: "items", label: "Artículos" },
              { key: "invoices", label: "Facturas" },
              { key: "suppliers", label: "Proveedores" },
              { key: "analytics", label: "Análisis" },
              { key: "normalize", label: "Ingredientes" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className="px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-150"
                style={{
                  borderBottomColor: view === key ? "var(--blue)" : "transparent",
                  color: view === key ? "var(--blue)" : "var(--text-muted)",
                  background: "transparent",
                }}
                onClick={() => { setView(key); setSortBy("date"); setSortDir("desc"); }}
              >
                <span className="relative inline-flex items-center gap-1.5">
                  {label}
                  {key === "normalize" && unmatchedCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "var(--pink-dark)" }} />
                  )}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors duration-150 mb-1"
            style={{
              color: hasFilters ? "var(--blue)" : "var(--text-muted)",
              background: hasFilters ? "var(--blue-glow)" : "transparent",
            }}
            onClick={() => setShowFilters((v) => !v)}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1 2.5h11M3.5 6.5h6M6 10.5h1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Filtros</span>
            {hasFilters && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--blue)" }} />}
          </button>
        </div>

        {/* Filters */}
        <div className={`flex flex-col gap-2 pt-3 ${showFilters ? "" : "hidden"}`}>
          {/* Row 1: search + restaurant + supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            <div className="sm:col-span-2 md:col-span-2">
              <input
                type="text"
                value={search}
                placeholder="Buscar artículo..."
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={restaurant}
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: restaurant ? "var(--text)" : "var(--text-dim)" }}
              onChange={(e) => setRestaurant(e.target.value)}
            >
              <option value="">Todos los restaurantes</option>
              <option value="motin_juarez">Motín Juárez</option>
              <option value="motin_roma">Motín Roma</option>
              <option value="queseria">Quesería</option>
            </select>
            <select
              value={supplier}
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: supplier ? "var(--text)" : "var(--text-dim)" }}
              onChange={(e) => setSupplier(e.target.value)}
            >
              <option value="">Todos los proveedores</option>
              {stats.supplierList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Row 2: period presets + month + week + desde/hasta + limpiar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Presets */}
            {[
              { key: "thisMonth", label: "Este mes" },
              { key: "lastMonth", label: "Mes pasado" },
              { key: "last30", label: "Últ. 30d" },
              { key: "ytd", label: "YTD" },
            ].map(({ key, label }) => (
              <button key={key} type="button" onClick={() => applyPreset(key)}
                className="px-2.5 py-1.5 rounded-[var(--radius-sm)] border text-xs font-medium transition-colors duration-150"
                style={{
                  background: activePreset === key ? "var(--blue)" : "var(--surface)",
                  color: activePreset === key ? "#fff" : "var(--text-muted)",
                  borderColor: activePreset === key ? "var(--blue)" : "var(--border)",
                }}>
                {label}
              </button>
            ))}
            <span className="w-px h-4" style={{ background: "var(--border)" }} />
            <select
              value={selectedMonth}
              className="px-3 py-2 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: selectedMonth ? "var(--blue)" : "var(--border)", color: selectedMonth ? "var(--text)" : "var(--text-dim)", minWidth: 160 }}
              onChange={(e) => handleMonthSelect(e.target.value)}
            >
              <option value="">Mes</option>
              {getMonthOptions().map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={selectedWeek}
              className="px-3 py-2 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: selectedWeek ? "var(--blue)" : "var(--border)", color: selectedWeek ? "var(--text)" : "var(--text-dim)", minWidth: 160 }}
              onChange={(e) => handleWeekSelect(e.target.value)}
            >
              <option value="">Semana</option>
              {getWeekOptions().map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 ml-1">
              <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Desde</span>
              <input
                type="date"
                value={dateFrom}
                className="px-2 py-1 rounded-[var(--radius-sm)] border text-xs focus:outline-none focus:ring-2"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: dateFrom ? "var(--text)" : "var(--text-dim)" }}
                onChange={(e) => { setDateFrom(e.target.value); setSelectedMonth(""); setSelectedWeek(""); }}
              />
              <span className="text-[10px] uppercase tracking-wider font-medium ml-1" style={{ color: "var(--text-muted)" }}>Hasta</span>
              <input
                type="date"
                value={dateTo}
                className="px-2 py-1 rounded-[var(--radius-sm)] border text-xs focus:outline-none focus:ring-2"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: dateTo ? "var(--text)" : "var(--text-dim)" }}
                onChange={(e) => { setDateTo(e.target.value); setSelectedMonth(""); setSelectedWeek(""); }}
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Limpiar
              </Button>
            )}
          </div>
        </div>

        <div className="pt-4" />

        {/* Save error banner */}
        {saveError && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-[var(--radius)] border"
            style={{ borderColor: "var(--danger)", background: "var(--danger-dim)" }}>
            <p className="text-sm" style={{ color: "var(--danger)" }}>{saveError}</p>
            <button type="button" className="text-xs font-medium" style={{ color: "var(--danger)" }}
              onClick={() => setSaveError("")}>Cerrar</button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 rounded-[var(--radius)] border" style={{ borderColor: "var(--danger)", background: "var(--danger-dim)" }}>
            <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && pagination.total === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
              style={{ background: "var(--surface-raised)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                style={{ color: "var(--text-dim)" }}>
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Los artículos de tus facturas aparecerán aquí después de enviarlas a Google Sheets.
            </p>
          </div>
        )}

        {/* ─── ITEMS VIEW ──────────────────────────────────────────── */}
        {!loading && view === "items" && items.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-[var(--radius)] border overflow-hidden"
              style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--surface-raised)" }}>
                    {[
                      { key: "date", label: "Fecha" },
                      { key: "supplier", label: "Proveedor" },
                      { key: "description", label: "Descripción" },
                      { key: "", label: "Cant." },
                      { key: "", label: "Unidad" },
                      { key: "", label: "P. Unit." },
                      { key: "total", label: "Total" },
                      { key: "", label: "" },
                    ].map(({ key, label }, i) => (
                      <th
                        key={i}
                        className={`px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider ${key ? "cursor-pointer select-none" : ""}`}
                        style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}
                        onClick={key ? () => toggleSort(key) : undefined}
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          {key && sortBy === key && (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
                              style={{ transform: sortDir === "asc" ? "rotate(180deg)" : "" }}>
                              <path d="M4 6L1 2h6L4 6z" />
                            </svg>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} className="transition-colors duration-100"
                      style={{ background: idx % 2 === 0 ? "var(--surface)" : "var(--surface-raised)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--blue-glow)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "var(--surface)" : "var(--surface-raised)"; }}>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                        {formatDate(item.invoice_date)}
                      </td>
                      <td className="px-3 py-3 max-w-[140px] truncate" style={{ color: "var(--text)", borderBottom: "1px solid var(--border-subtle)" }}>
                        {item.supplier}
                      </td>
                      {/* Editable cells */}
                      {[
                        { field: "description", val: item.description, w: "max-w-[200px]" },
                        { field: "quantity", val: item.quantity != null ? String(item.quantity) : "", w: "w-16" },
                        { field: "unit", val: item.unit_normalized ?? item.unit ?? "", w: "w-16" },
                        { field: "unitPrice", val: item.unit_price != null ? String(item.unit_price) : "", w: "w-20" },
                        { field: "total", val: String(item.total), w: "w-24" },
                      ].map(({ field, val, w }) => (
                        <td key={field} className={`px-3 py-3 ${w}`}
                          style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          {editingId === item.id && editField === field ? (
                            <input
                              type={["quantity", "unitPrice", "total"].includes(field) ? "number" : "text"}
                              value={editValue}
                              step="any"
                              autoFocus
                              className="w-full px-1.5 py-0.5 rounded border text-sm focus:outline-none focus:ring-1"
                              style={{ background: "var(--surface)", borderColor: "var(--blue)", color: "var(--text)" }}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => saveEdit(item.id, field, editValue)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(item.id, field, editValue);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:underline truncate"
                              style={{ color: field === "total" ? "var(--blue)" : "var(--text)" }}
                              onClick={() => startEdit(item.id, field, val)}
                            >
                              {field === "total" || field === "unitPrice"
                                ? (val ? formatCurrency(parseFloat(val)) : "—")
                                : (val || "—")}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        {savingId === item.id ? (
                          <div className="w-6 h-6 flex items-center justify-center">
                            <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="w-6 h-6 rounded flex items-center justify-center transition-colors duration-150"
                            style={{ color: "var(--text-dim)" }}
                            onClick={() => setDeleteConfirmId(item.id)}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--danger)"; (e.currentTarget as HTMLElement).style.background = "var(--danger-dim)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-dim)"; (e.currentTarget as HTMLElement).style.background = ""; }}
                            aria-label="Eliminar"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {items.map((item) => (
                <MobileItemCard key={item.id} item={item} onDelete={() => setDeleteConfirmId(item.id)} onEdit={(field, val) => startEdit(item.id, field, val)}
                  editingId={editingId} editField={editField} editValue={editValue}
                  setEditValue={setEditValue} onSaveEdit={(field, val) => saveEdit(item.id, field, val)}
                  onCancelEdit={() => setEditingId(null)} itemId={item.id} />
              ))}
            </div>
          </>
        )}

        {/* ─── INVOICES VIEW ───────────────────────────────────────── */}
        {!loading && view === "invoices" && invoices.length > 0 && (
          <div className="space-y-2">
            {/* Select mode toolbar */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                {invoiceSelectMode && selectedInvoiceIds.size > 0
                  ? `${selectedInvoiceIds.size} seleccionada${selectedInvoiceIds.size !== 1 ? "s" : ""}`
                  : ""}
              </span>
              <div className="flex items-center gap-2">
                {invoiceSelectMode && selectedInvoiceIds.size > 0 && (
                  <button type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors"
                    style={{ background: "var(--danger-dim, #fee2e2)", color: "var(--danger, #ef4444)", border: "1px solid var(--danger-border, #fca5a5)" }}
                    onClick={() => setConfirmDeleteInvoices(true)}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                      <path d="M6 2h4M2 5h12M4.5 5l1 9a.5.5 0 00.5.5h4a.5.5 0 00.5-.5l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Eliminar ({selectedInvoiceIds.size})
                  </button>
                )}
                <button type="button"
                  className="px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors"
                  style={{ background: invoiceSelectMode ? "var(--surface)" : "var(--blue-glow)", color: invoiceSelectMode ? "var(--text-muted)" : "var(--blue)", border: "1px solid", borderColor: invoiceSelectMode ? "var(--border)" : "color-mix(in srgb, var(--blue) 25%, transparent)" }}
                  onClick={() => { setInvoiceSelectMode((m) => !m); setSelectedInvoiceIds(new Set()); }}
                >
                  {invoiceSelectMode ? "Cancelar" : "Seleccionar"}
                </button>
              </div>
            </div>

            {invoices.map((inv) => {
              const isExpanded = expandedInvoices.has(inv.id);
              const isSelected = selectedInvoiceIds.has(inv.id);
              return (
                <div key={inv.id} className="rounded-[var(--radius)] border overflow-hidden"
                  style={{ borderColor: isSelected ? "var(--blue)" : "var(--border)", background: "var(--surface)" }}>
                  <div className="flex items-center">
                    {/* Checkbox in select mode, chevron otherwise */}
                    <div className="pl-4 flex-shrink-0"
                      onClick={() => {
                        if (invoiceSelectMode) {
                          setSelectedInvoiceIds((prev) => {
                            const next = new Set(prev);
                            isSelected ? next.delete(inv.id) : next.add(inv.id);
                            return next;
                          });
                        }
                      }}
                    >
                      {invoiceSelectMode ? (
                        <div className="w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer"
                          style={{ borderColor: isSelected ? "var(--blue)" : "var(--border)", background: isSelected ? "var(--blue)" : "transparent" }}>
                          {isSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="flex-1 flex items-center gap-3 px-3 py-3 text-left"
                      onClick={() => {
                        if (invoiceSelectMode) {
                          setSelectedInvoiceIds((prev) => {
                            const next = new Set(prev);
                            isSelected ? next.delete(inv.id) : next.add(inv.id);
                            return next;
                          });
                        } else {
                          setExpandedInvoices((prev) => {
                            const next = new Set(prev);
                            isExpanded ? next.delete(inv.id) : next.add(inv.id);
                            return next;
                          });
                        }
                      }}
                    >
                      {!invoiceSelectMode && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                          className={`transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                          style={{ color: "var(--text-muted)" }}>
                          <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{inv.supplier}</span>
                          {inv.invoice_number && (
                            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>#{inv.invoice_number}</span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--pink-glow)", color: "var(--pink-dark)" }}>
                            {restaurantLabel(inv.restaurant)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                          <span>{formatDate(inv.invoice_date)}</span>
                          <span className="font-semibold" style={{ color: "var(--blue)" }}>{formatCurrency(inv.total)}</span>
                          <span>{inv.lineItems.length} artículo{inv.lineItems.length !== 1 ? "s" : ""}</span>
                          {inv.cuenta_pnl && !invoiceSelectMode && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ background: "var(--surface-raised)", color: "var(--text-dim)", border: "1px solid var(--border-subtle)" }}>
                              {inv.cuenta_pnl}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                  {isExpanded && !invoiceSelectMode && (
                    <div className="border-t px-4 py-3 space-y-1.5" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)" }}>
                      {/* Reclassify cuentaPnl — only visible when expanded */}
                      <div className="flex items-center gap-2 pb-2 mb-1 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Cuenta P&L</span>
                        {reclassifyingId === inv.id ? (
                          <span className="flex items-center gap-1">
                            <select
                              autoFocus
                              value={reclassifyValue}
                              className="px-1.5 py-0.5 rounded border text-[10px] appearance-none focus:outline-none focus:ring-1"
                              style={{ background: "var(--surface)", borderColor: "var(--blue)", color: "var(--text)" }}
                              onChange={(e) => setReclassifyValue(e.target.value)}
                            >
                              {(dropdownOptions.cuentaPnl as string[]).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <button type="button"
                              disabled={reclassifyingSaving}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ background: "var(--blue)", color: "#fff" }}
                              onClick={async () => {
                                setReclassifyingSaving(true);
                                try {
                                  const res = await fetch(`/api/compras/invoices/${inv.id}`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ cuentaPnl: reclassifyValue }),
                                  });
                                  if (res.ok) {
                                    setInvoices((prev) => prev.map((i) =>
                                      i.id === inv.id ? { ...i, cuenta_pnl: reclassifyValue } : i
                                    ));
                                    setReclassifyingId(null);
                                  }
                                } finally { setReclassifyingSaving(false); }
                              }}
                            >
                              {reclassifyingSaving ? "..." : "✓"}
                            </button>
                            <button type="button"
                              className="text-[10px]"
                              style={{ color: "var(--text-muted)" }}
                              onClick={() => setReclassifyingId(null)}
                            >✕</button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="text-[10px] px-1.5 py-0.5 rounded-full transition-colors"
                            style={{ background: "var(--surface)", color: "var(--text-dim)", border: "1px solid var(--border-subtle)" }}
                            onClick={() => { setReclassifyingId(inv.id); setReclassifyValue(inv.cuenta_pnl ?? ""); }}
                          >
                            {inv.cuenta_pnl ?? "Sin categoría"} ✎
                          </button>
                        )}
                      </div>
                      {inv.lineItems.length === 0 ? (
                        <p className="text-xs py-2" style={{ color: "var(--text-dim)" }}>Sin artículos individuales</p>
                      ) : (
                        inv.lineItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                            <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{item.description}</span>
                            <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                              {item.quantity != null ? `${item.quantity} ${item.unit_normalized ?? item.unit ?? ""}` : ""}
                            </span>
                            <span className="flex-shrink-0 font-medium" style={{ color: "var(--blue)" }}>
                              {formatCurrency(item.total)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── SUPPLIERS VIEW ──────────────────────────────────────── */}
        {!loading && view === "suppliers" && suppliers.length > 0 && (
          <div className="space-y-2">
            {suppliers.map((group) => {
              const isExpanded = expandedSuppliers.has(group.supplier);
              const currentTag = supplierTags[group.supplier] ?? "";
              const isEditingTag = editingSupplierTag === group.supplier;
              return (
                <div key={group.supplier} className="rounded-[var(--radius)] border overflow-hidden"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="flex items-center">
                    <button
                      type="button"
                      className="flex-1 flex items-center gap-3 px-4 py-3 text-left"
                      onClick={() => {
                        setExpandedSuppliers((prev) => {
                          const next = new Set(prev);
                          isExpanded ? next.delete(group.supplier) : next.add(group.supplier);
                          return next;
                        });
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                        className={`transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                        style={{ color: "var(--text-muted)" }}>
                        <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{group.supplier}</span>
                        <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                          <span>{group.itemCount} artículo{group.itemCount !== 1 ? "s" : ""}</span>
                          <span className="font-semibold" style={{ color: "var(--blue)" }}>{formatCurrency(group.totalSpend)}</span>
                        </div>
                      </div>
                    </button>
                    {/* Supply type tag */}
                    <div className="px-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isEditingTag ? (
                        <select
                          autoFocus
                          value={currentTag}
                          className="px-2 py-1 rounded-[var(--radius-sm)] border text-xs appearance-none focus:outline-none focus:ring-1"
                          style={{ background: "var(--surface)", borderColor: "var(--blue)", color: "var(--text)" }}
                          onBlur={() => setEditingSupplierTag(null)}
                          onChange={async (e) => {
                            const supplyType = e.target.value;
                            setSupplierTags((prev) => ({ ...prev, [group.supplier]: supplyType }));
                            setEditingSupplierTag(null);
                            await fetch("/api/compras/suppliers/tags", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ supplier: group.supplier, supplyType }),
                            });
                          }}
                        >
                          <option value="">Sin clasificar</option>
                          {(dropdownOptions.cuentaPnl as string[]).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          type="button"
                          title="Clasificar proveedor"
                          className="text-[10px] px-2 py-1 rounded-full transition-colors"
                          style={{
                            background: currentTag ? "var(--blue-glow)" : "var(--surface-raised)",
                            color: currentTag ? "var(--blue)" : "var(--text-dim)",
                            border: `1px solid ${currentTag ? "color-mix(in srgb, var(--blue) 25%, transparent)" : "var(--border-subtle)"}`,
                          }}
                          onClick={() => setEditingSupplierTag(group.supplier)}
                        >
                          {currentTag || "Clasificar ✎"}
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t px-4 py-3 space-y-1.5" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)" }}>
                      {group.items.map((item: DbLineItem) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                          <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{item.description}</span>
                          <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                            {formatDate(item.invoice_date)}
                          </span>
                          <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                            {item.quantity != null ? `${item.quantity} ${item.unit_normalized ?? item.unit ?? ""}` : ""}
                          </span>
                          <span className="flex-shrink-0 font-medium" style={{ color: "var(--blue)" }}>
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && view !== "normalize" && view !== "analytics" && (
          <div className="flex items-center justify-between gap-4 pt-2">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Página {pagination.page} de {pagination.totalPages} ({pagination.total} resultado{pagination.total !== 1 ? "s" : ""})
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] border text-xs font-medium transition-colors duration-150 disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] border text-xs font-medium transition-colors duration-150 disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* ─── ANALYTICS VIEW ──────────────────────────────────────── */}
        {view === "analytics" && (
          <div className="space-y-4">
            {analyticsLoading && (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
              </div>
            )}

            {!analyticsLoading && analyticsData && (() => {
              const d = analyticsData;
              const maxCat = d.categoryBreakdown[0]?.value ?? 1;
              const maxSup = d.spendBySupplier[0]?.total ?? 1;
              const maxItem = d.topItems[0]?.totalSpend ?? 1;

              const allMonthlyTotals = d.monthlySpend.map(m => ({
                month: m.month as string,
                total: Object.entries(m).filter(([k]) => k !== "month").reduce((s, [, v]) => s + Number(v), 0),
              }));
              const weeklyTotals = d.weeklyTrend.map((w: { week: string; total: number }) => ({
                week: w.week as string,
                total: Number(w.total),
              }));

              function fmtWeek(yw: string) {
                const dt = new Date(yw + "T00:00:00");
                return dt.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
              }

              return (
                <>
                  {/* ── KPI Band ── */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-[var(--radius)] border p-4"
                      style={{ borderColor: "color-mix(in srgb, var(--blue) 30%, transparent)", background: "var(--blue-glow)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--blue)" }}>
                        Gasto Total
                      </p>
                      <p className="text-2xl font-bold leading-none"
                        style={{ fontFamily: "var(--font-display)", color: "var(--blue)", letterSpacing: "-0.03em" }}>
                        {formatCurrency(d.kpis.totalSpend)}
                      </p>
                    </div>
                    {[
                      { label: "Facturas", value: d.kpis.uniqueInvoices.toLocaleString("es-MX") },
                      { label: "Proveedores", value: d.kpis.uniqueSuppliers.toLocaleString("es-MX") },
                      { label: "Prom / Factura", value: formatCurrency(d.kpis.avgPerInvoice) },
                    ].map(kpi => (
                      <div key={kpi.label} className="rounded-[var(--radius)] border p-4"
                        style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-dim)" }}>{kpi.label}</p>
                        <p className="text-2xl font-bold leading-none"
                          style={{ fontFamily: "var(--font-display)", color: "var(--text)", letterSpacing: "-0.03em" }}>
                          {kpi.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* ── Trend Chart ── */}
                  {weeklyTotals.length > 0 && (
                    <div className="rounded-[var(--radius)] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-dim)" }}>Tendencia semanal</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={weeklyTotals} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="var(--blue)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                            tickFormatter={(v: string) => fmtWeek(v)} />
                          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            formatter={(value: unknown) => [formatCurrency(Number(value)), "Gasto"]}
                            labelFormatter={(label: unknown) => {
                              const dt = new Date(String(label) + "T00:00:00");
                              const end = new Date(dt); end.setDate(dt.getDate() + 6);
                              return `Sem ${dt.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`;
                            }}
                            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                            labelStyle={{ color: "var(--text)", fontWeight: 600 }}
                          />
                          <Area type="monotone" dataKey="total" stroke="var(--blue)" strokeWidth={2} fill="url(#areaGrad)"
                            dot={{ fill: "var(--blue)", r: 3, strokeWidth: 0 }}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            activeDot={{ r: 5, strokeWidth: 0 } as any} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* ── Category + Supplier Row ── */}
                  <div className="grid md:grid-cols-5 gap-4">
                    {/* Category breakdown — 3 cols */}
                    <div className="md:col-span-3 rounded-[var(--radius)] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-dim)" }}>Por categoría</p>
                      {d.categoryBreakdown.length === 0 ? (
                        <p className="text-sm py-6 text-center" style={{ color: "var(--text-dim)" }}>Sin datos</p>
                      ) : (
                        <div>
                          {d.categoryBreakdown.slice(0, 10).map((c) => {
                            const pct = d.kpis.totalSpend > 0 ? (c.value / d.kpis.totalSpend) * 100 : 0;
                            const barWidth = (c.value / maxCat) * 100;
                            return (
                              <div key={c.name} className="py-2 border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs truncate pr-2" style={{ color: "var(--text)", maxWidth: "55%" }}>{c.name}</span>
                                  <div className="flex items-center gap-2.5 flex-shrink-0">
                                    <span className="text-[10px] tabular-nums" style={{ color: "var(--text-dim)" }}>{pct.toFixed(1)}%</span>
                                    <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text)" }}>{formatCurrency(c.value)}</span>
                                  </div>
                                </div>
                                <div className="h-1 rounded-full" style={{ background: "var(--border)" }}>
                                  <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: "var(--blue)", opacity: 0.65 }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Top Suppliers — 2 cols */}
                    <div className="md:col-span-2 rounded-[var(--radius)] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-dim)" }}>Top proveedores</p>
                      {d.spendBySupplier.length === 0 ? (
                        <p className="text-sm py-6 text-center" style={{ color: "var(--text-dim)" }}>Sin datos</p>
                      ) : (
                        <div>
                          {d.spendBySupplier.slice(0, 8).map((s) => {
                            const barWidth = (s.total / maxSup) * 100;
                            const pct = d.kpis.totalSpend > 0 ? (s.total / d.kpis.totalSpend) * 100 : 0;
                            return (
                              <div key={s.supplier} className="py-2 border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs truncate pr-2" title={s.supplier} style={{ color: "var(--text)", maxWidth: "55%" }}>{s.supplier}</span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[10px] tabular-nums" style={{ color: "var(--text-dim)" }}>{pct.toFixed(1)}%</span>
                                    <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text)" }}>{formatCurrency(s.total)}</span>
                                  </div>
                                </div>
                                <div className="h-1 rounded-full" style={{ background: "var(--border)" }}>
                                  <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: "var(--pink-dark)", opacity: 0.75 }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Top Ingredients ── */}
                  {d.topItems.length > 0 && (
                    <div className="rounded-[var(--radius)] border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                      <div className="px-4 py-3 border-b"
                        style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                          Top artículos por gasto
                        </p>
                      </div>
                      <div style={{ background: "var(--surface)" }}>
                        {d.topItems.map((item, i) => {
                          const barWidth = (item.totalSpend / maxItem) * 100;
                          return (
                            <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0"
                              style={{ borderColor: "var(--border-subtle)" }}>
                              <span className="text-[10px] font-bold tabular-nums flex-shrink-0 w-4 text-right"
                                style={{ color: "var(--text-dim)" }}>
                                {i + 1}
                              </span>
                              <span className="text-xs flex-1 truncate min-w-0" style={{ color: "var(--text)" }} title={item.description}>
                                {item.description}
                              </span>
                              <span className="text-[10px] flex-shrink-0 hidden sm:block tabular-nums"
                                style={{ color: "var(--text-dim)", minWidth: "40px", textAlign: "center" }}>
                                ×{item.count}
                              </span>
                              <div className="flex items-center gap-2 flex-shrink-0" style={{ minWidth: "140px" }}>
                                <div className="flex-1 h-1 rounded-full" style={{ background: "var(--border)" }}>
                                  <div className="h-full rounded-full"
                                    style={{ width: `${barWidth}%`, background: "var(--pink-dark)", opacity: 0.75 }} />
                                </div>
                                <span className="text-xs font-semibold tabular-nums"
                                  style={{ color: "var(--text)", minWidth: "72px", textAlign: "right" }}>
                                  {formatCurrency(item.totalSpend)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Restaurant split (if multiple) ── */}
                  {d.spendByRestaurant.length > 1 && (
                    <div className="grid grid-cols-3 gap-3">
                      {d.spendByRestaurant.map((r) => (
                        <div key={r.restaurant} className="rounded-[var(--radius)] border p-3"
                          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-dim)" }}>
                            {restaurantLabel(r.restaurant)}
                          </p>
                          <p className="text-lg font-bold"
                            style={{ fontFamily: "var(--font-display)", color: "var(--blue)", letterSpacing: "-0.02em" }}>
                            {formatCurrency(r.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {!analyticsLoading && !analyticsData && (
              <p className="text-sm text-center py-12" style={{ color: "var(--text-dim)" }}>Sin datos de análisis</p>
            )}
          </div>
        )}

        {/* ─── NORMALIZE VIEW ──────────────────────────────────────── */}
        {view === "normalize" && (
          <div>
            <style>{`
              .ing-row {
                transition: background 0.15s ease;
                cursor: pointer;
              }
              .ing-row:hover {
                background: var(--surface-raised) !important;
              }
              .ing-row-expand {
                display: grid;
                transition: grid-template-rows 0.22s ease;
              }
              .ing-row-expand > div { overflow: hidden; min-height: 0; }
              .ing-chevron {
                transition: transform 0.2s ease;
              }
            `}</style>

            {normalizeLoading && (
              <div className="flex justify-center py-16">
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
              </div>
            )}

            {!normalizeLoading && normalizeMode === "list" && (() => {
              const q = ingredientSearch.trim().toLowerCase();
              const filteredIngredients = ingredients.filter(i => {
                const matchesSearch = !q ||
                  i.canonical_name.toLowerCase().includes(q) ||
                  i.aliases.some(a => a.toLowerCase().includes(q));
                const matchesCat = !ingredientCategoryFilter || i.category === ingredientCategoryFilter;
                return matchesSearch && matchesCat;
              });
              const uniqueCategories = Array.from(new Set(
                ingredients.map(i => i.category).filter(Boolean)
              )).sort() as string[];

              return (
                <>
                  {/* ── Toolbar ── */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px]">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "var(--text-muted)" }}>
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Buscar ingrediente o alias…"
                        value={ingredientSearch}
                        onChange={e => setIngredientSearch(e.target.value)}
                        className="w-full pl-8 pr-8 py-1.5 text-sm rounded-[var(--radius-sm)] border focus:outline-none"
                        style={{
                          background: "var(--surface)",
                          borderColor: ingredientSearch ? "var(--blue)" : "var(--border)",
                          color: "var(--text)",
                          transition: "border-color 0.15s ease",
                        }}
                      />
                      {ingredientSearch && (
                        <button type="button"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                          onClick={() => setIngredientSearch("")}>
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <path d="M1 1l9 9M10 1L1 10" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Category filter */}
                    {uniqueCategories.length > 0 && (
                      <div className="relative">
                        <select
                          value={ingredientCategoryFilter}
                          onChange={e => setIngredientCategoryFilter(e.target.value)}
                          className="pl-3 pr-7 py-1.5 text-xs rounded-[var(--radius-sm)] border appearance-none cursor-pointer focus:outline-none"
                          style={{
                            background: "var(--surface)",
                            borderColor: ingredientCategoryFilter ? "var(--blue)" : "var(--border)",
                            color: ingredientCategoryFilter ? "var(--text)" : "var(--text-muted)",
                            transition: "border-color 0.15s ease",
                          }}>
                          <option value="">Categoría</option>
                          {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: "var(--text-dim)" }}>
                          <path d="M1.5 3.5l3.5 3 3.5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}

                    {/* Spacer */}
                    <div className="flex-1 min-w-0" />

                    {/* Count */}
                    <span className="text-[10px] flex-shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {filteredIngredients.length}{(q || ingredientCategoryFilter) ? ` / ${ingredients.length}` : ""} ingrediente{ingredients.length !== 1 ? "s" : ""}
                    </span>

                    {/* Identify mode button */}
                    {unmatchedCount > 0 && (
                      <button type="button"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium flex-shrink-0"
                        style={{ background: "var(--blue-glow)", color: "var(--blue)", border: "1px solid color-mix(in srgb, var(--blue) 25%, transparent)" }}
                        onClick={() => setNormalizeMode("identify")}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        Identificar {unmatchedCount}
                      </button>
                    )}

                    {/* Edit mode controls */}
                    {ingredients.length > 0 && (
                      <>
                        {ingredientEditMode && selectedIngredientIds.size > 0 && (
                          <button type="button"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium flex-shrink-0"
                            style={{ background: "#fee2e2", color: "#b91c1c" }}
                            onClick={() => setConfirmDeleteIngredients(true)}>
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                              <path d="M6 2h4M2 5h12M4.5 5l1 9a.5.5 0 00.5.5h4a.5.5 0 00.5-.5l1-9M6.5 8v4M9.5 8v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Eliminar ({selectedIngredientIds.size})
                          </button>
                        )}
                        <button type="button"
                          className="px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium flex-shrink-0"
                          style={{
                            background: ingredientEditMode ? "var(--surface)" : "var(--surface-raised)",
                            color: ingredientEditMode ? "var(--text)" : "var(--text-muted)",
                            border: "1px solid var(--border)",
                          }}
                          onClick={() => { setIngredientEditMode(m => !m); setSelectedIngredientIds(new Set()); setExpandedIngredientId(null); }}>
                          {ingredientEditMode ? "Cancelar" : "Editar"}
                        </button>
                      </>
                    )}
                  </div>

                  {/* ── Ingredient list table ── */}
                  {ingredients.length === 0 ? (
                    <div className="rounded-[var(--radius)] border py-14 text-center"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <p className="text-sm" style={{ color: "var(--text-dim)" }}>Ningún ingrediente registrado aún</p>
                    </div>
                  ) : filteredIngredients.length === 0 ? (
                    <div className="rounded-[var(--radius)] border py-10 text-center"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <p className="text-sm" style={{ color: "var(--text-dim)" }}>Sin resultados</p>
                      <button type="button" className="mt-2 text-xs underline" style={{ color: "var(--text-muted)" }}
                        onClick={() => { setIngredientSearch(""); setIngredientCategoryFilter(""); }}>
                        Limpiar filtros
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-[var(--radius)] border overflow-hidden"
                      style={{ borderColor: "var(--border)" }}>
                      {/* Column headers */}
                      <div className="grid px-4 py-2 border-b select-none"
                        style={{
                          gridTemplateColumns: "1fr 130px 56px 28px",
                          borderColor: "var(--border)",
                          background: "var(--surface-raised)",
                        }}>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Ingrediente</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Categoría</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Unidad</span>
                        <span />
                      </div>

                      {/* Rows */}
                      <div style={{ background: "var(--surface)" }}>
                        {filteredIngredients.map((ing) => {
                          const isExpanded = expandedIngredientId === ing.id && !ingredientEditMode;
                          const isChecked = selectedIngredientIds.has(ing.id);
                          return (
                            <div key={ing.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                              {/* Row */}
                              <div
                                className="ing-row grid px-4 py-2.5"
                                style={{
                                  gridTemplateColumns: "1fr 130px 56px 28px",
                                  background: isChecked ? "var(--blue-glow)" : isExpanded ? "var(--surface-raised)" : undefined,
                                }}
                                onClick={() => {
                                  if (ingredientEditMode) {
                                    setSelectedIngredientIds(prev => {
                                      const next = new Set(prev);
                                      isChecked ? next.delete(ing.id) : next.add(ing.id);
                                      return next;
                                    });
                                  } else {
                                    setExpandedIngredientId(isExpanded ? null : ing.id);
                                  }
                                }}>
                                {/* Name + aliases */}
                                <div className="min-w-0 flex items-center gap-2 pr-3">
                                  {ingredientEditMode && (
                                    <input type="checkbox" readOnly checked={isChecked}
                                      className="flex-shrink-0 accent-[#0450A9]" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                                      {ing.canonical_name}
                                    </p>
                                    {ing.aliases.length > 0 && (
                                      <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                                        {ing.aliases.join(" · ")}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Category */}
                                <div className="flex items-center">
                                  {ing.category && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full truncate max-w-full"
                                      style={{ background: "var(--blue-glow)", color: "var(--blue)" }}>
                                      {ing.category}
                                    </span>
                                  )}
                                </div>

                                {/* Unit */}
                                <div className="flex items-center">
                                  {ing.default_unit && (
                                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                                      {ing.default_unit}
                                    </span>
                                  )}
                                </div>

                                {/* Chevron */}
                                {!ingredientEditMode && (
                                  <div className="flex items-center justify-center">
                                    <svg className="ing-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"
                                      style={{ color: "var(--text-dim)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                                      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              {/* Inline edit (expand) */}
                              <div className="ing-row-expand" style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
                                <div>
                                  <div className="border-t" style={{ borderColor: "var(--border-subtle)", background: "var(--surface)" }}>
                                    <div className="p-5">
                                      <IngredientEditRow
                                        ingredient={ing}
                                        onClose={() => setExpandedIngredientId(null)}
                                        onSaved={(updated) => {
                                          setIngredients(prev => prev.map(i => i.id === updated.id ? updated : i));
                                          setExpandedIngredientId(null);
                                        }}
                                        onDeleted={(id) => {
                                          setIngredients(prev => prev.filter(i => i.id !== id));
                                          setExpandedIngredientId(null);
                                          fetchNormalize();
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {!normalizeLoading && normalizeMode === "identify" && (() => {
              const identifySearch = ingredientSearch.trim().toLowerCase();
              const identifyFiltered = identifySearch
                ? ingredients.filter(i =>
                    i.canonical_name.toLowerCase().includes(identifySearch) ||
                    i.aliases.some(a => a.toLowerCase().includes(identifySearch))
                  )
                : ingredients;

              return (
                <div>
                  {/* Identify mode header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <button type="button"
                        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-[var(--radius-sm)]"
                        style={{ background: "var(--surface-raised)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                        onClick={() => { setNormalizeMode("list"); setIngredientSearch(""); }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M7.5 2L3 6l4.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Salir
                      </button>
                      <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Modo identificar</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "var(--blue-glow)", color: "var(--blue)" }}>
                        {unmatched.length} sin identificar
                      </span>
                    </div>
                  </div>

                  {/* AI loading bar */}
                  {aiLoading && (
                    <div className="mb-3 px-4 py-2.5 rounded-[var(--radius-sm)] border"
                      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Analizando con IA…</span>
                        <span className="text-xs font-medium" style={{ color: "var(--blue)" }}>{aiProgress}%</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                        <div className="h-full rounded-full" style={{ width: `${aiProgress}%`, background: "var(--blue)", transition: "width 0.4s ease-out" }} />
                      </div>
                    </div>
                  )}

                  {/* 50/50 split */}
                  <div className="grid grid-cols-2 gap-3" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>

                    {/* Left: unidentified */}
                    <div className="rounded-[var(--radius)] border overflow-hidden flex flex-col"
                      style={{ borderColor: "var(--border)" }}>
                      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0"
                        style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>Sin identificar</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                            style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                            {unmatched.length}
                          </span>
                        </div>
                        {!aiSuggestions && unmatched.length > 0 && (
                          <button type="button"
                            disabled={aiLoading}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium"
                            style={{ background: "var(--blue-glow)", color: "var(--blue)", border: "1px solid color-mix(in srgb, var(--blue) 25%, transparent)", opacity: aiLoading ? 0.6 : 1 }}
                            onClick={async () => {
                              setAiLoading(true); setAiProgress(0);
                              const startTime = Date.now();
                              const progressInterval = setInterval(() => {
                                const elapsed = (Date.now() - startTime) / 1000;
                                setAiProgress(Math.min(85, Math.round(85 * (1 - Math.exp(-elapsed / 20)))));
                              }, 300);
                              try {
                                const res = await fetch("/api/compras/ingredients/suggest-batch", {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ items: unmatched }),
                                });
                                let data: { suggestions?: AISuggestion[]; error?: string };
                                try { data = await res.json(); } catch { alert("Error: respuesta no válida"); return; }
                                if (res.ok) {
                                  setAiProgress(100);
                                  const suggestions = data.suggestions ?? [];
                                  if (suggestions.length === 0) { alert("La IA no devolvió sugerencias."); }
                                  else { setAiSuggestions(suggestions); setAiChecked(new Set(suggestions.map((_: AISuggestion, i: number) => i))); }
                                } else { alert(`Error ${res.status}: ${data.error ?? "Error desconocido"}`); }
                              } catch (err: unknown) {
                                alert(`Error de red: ${err instanceof Error ? err.message : String(err)}`);
                              } finally { clearInterval(progressInterval); setAiLoading(false); setAiProgress(0); }
                            }}>
                            {aiLoading ? (
                              <><div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />Analizando...</>
                            ) : (
                              <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" /></svg>Sugerir con IA</>
                            )}
                          </button>
                        )}
                        {aiSuggestions && (
                          <button type="button"
                            className="text-xs px-2 py-1 rounded"
                            style={{ color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--border)" }}
                            onClick={() => { setAiSuggestions(null); setAiChecked(new Set()); }}>
                            Volver
                          </button>
                        )}
                      </div>

                      <div className="overflow-y-auto flex-1" style={{ background: "var(--surface)" }}>
                        {aiSuggestions ? (
                          <>
                            <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                              {aiSuggestions.map((s, i) => {
                                const checked = aiChecked.has(i);
                                return (
                                  <div key={i}
                                    className="px-4 py-2.5 cursor-pointer transition-colors duration-100"
                                    style={{ background: checked ? "var(--blue-glow)" : undefined }}
                                    onClick={() => setAiChecked(prev => {
                                      const next = new Set(prev);
                                      checked ? next.delete(i) : next.add(i); return next;
                                    })}>
                                    <div className="flex items-start gap-2">
                                      <input type="checkbox" readOnly checked={checked} className="mt-0.5 flex-shrink-0 accent-[#0450A9]" />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{s.canonicalName}</p>
                                          <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                                            style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}>{s.matchCount} art.</span>
                                        </div>
                                        {s.category && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.category}</p>}
                                        <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-dim)" }}>{s.aliases.join(" · ")}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="sticky bottom-0 px-4 py-3 border-t flex items-center justify-between gap-3"
                              style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{aiChecked.size} / {aiSuggestions.length}</span>
                              <Button size="sm" loading={aiConfirming} disabled={aiChecked.size === 0}
                                onClick={async () => {
                                  setAiConfirming(true);
                                  try {
                                    const selected = aiSuggestions.filter((_, i) => aiChecked.has(i));
                                    for (const s of selected) {
                                      await fetch("/api/compras/ingredients", {
                                        method: "POST", headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ canonicalName: s.canonicalName, aliases: s.aliases, category: s.category || null }),
                                      });
                                    }
                                    setAiSuggestions(null); setAiChecked(new Set()); fetchNormalize();
                                  } finally { setAiConfirming(false); }
                                }}>
                                Confirmar ({aiChecked.size})
                              </Button>
                            </div>
                          </>
                        ) : unmatched.length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-sm" style={{ color: "var(--text-dim)" }}>Todo identificado ✓</p>
                          </div>
                        ) : (
                          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                            {unmatched.map((u) => (
                              <div key={u.description} className="flex items-center justify-between gap-3 px-4 py-2.5"
                                style={{ transition: "background 0.1s ease" }}>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm truncate" style={{ color: "var(--text)" }}>{u.description}</p>
                                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{u.count} artículo{u.count !== 1 ? "s" : ""}</p>
                                </div>
                                <div className="flex gap-1.5 flex-shrink-0">
                                  <button type="button"
                                    className="px-2 py-1 rounded text-xs font-medium"
                                    style={{ background: "var(--blue-glow)", color: "var(--blue)" }}
                                    onClick={() => { setCreateIngredientFor(u.description); setMergeFor(null); }}>
                                    Nuevo
                                  </button>
                                  <button type="button"
                                    className="px-2 py-1 rounded text-xs font-medium"
                                    style={{ background: "var(--surface-raised)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                                    onClick={() => { setMergeFor(u.description); setCreateIngredientFor(null); setMergingIntoId(""); }}>
                                    Unir
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: ingredients reference */}
                    <div className="rounded-[var(--radius)] border overflow-hidden flex flex-col"
                      style={{ borderColor: "var(--border)" }}>
                      <div className="px-4 py-3 border-b flex-shrink-0"
                        style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
                        <div className="relative">
                          <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "var(--text-muted)" }}>
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                          </svg>
                          <input type="text" placeholder="Buscar ingrediente…"
                            value={ingredientSearch}
                            onChange={e => setIngredientSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-[var(--radius-sm)] border focus:outline-none"
                            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
                        </div>
                      </div>
                      <div className="overflow-y-auto flex-1 divide-y" style={{ borderColor: "var(--border-subtle)", background: "var(--surface)" }}>
                        {identifyFiltered.length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-sm" style={{ color: "var(--text-dim)" }}>Sin resultados</p>
                          </div>
                        ) : identifyFiltered.map((ing) => (
                          <div key={ing.id} className="px-4 py-2.5">
                            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{ing.canonical_name}</p>
                            {ing.category && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{ing.category}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}


      </div>

      {/* Create Ingredient Modal */}
      <Modal
        open={!!createIngredientFor}
        onClose={() => setCreateIngredientFor(null)}
        title="Crear ingrediente"
        maxWidth="max-w-sm"
      >
        <CreateIngredientForm
          initialName={createIngredientFor ?? ""}
          onSave={async (canonicalName, category) => {
            setNormalizeSaving(true);
            try {
              const res = await fetch("/api/compras/ingredients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ canonicalName, aliases: [createIngredientFor], category: category || null }),
              });
              if (res.ok) { setCreateIngredientFor(null); fetchNormalize(); }
            } finally { setNormalizeSaving(false); }
          }}
          onClose={() => setCreateIngredientFor(null)}
          saving={normalizeSaving}
        />
      </Modal>

      {/* Edit Ingredient Modal */}
      <Modal
        open={!!editModalIngredient}
        onClose={() => setEditModalIngredient(null)}
        title="Editar ingrediente"
        maxWidth="max-w-sm"
      >
        {editModalIngredient && (
          <IngredientEditRow
            ingredient={editModalIngredient}
            onClose={() => setEditModalIngredient(null)}
            onSaved={(updated) => {
              setIngredients((prev) => prev.map((i) => i.id === updated.id ? updated : i));
              setEditModalIngredient(null);
            }}
            onDeleted={(id) => {
              setIngredients((prev) => prev.filter((i) => i.id !== id));
              setEditModalIngredient(null);
              fetchNormalize();
            }}
          />
        )}
      </Modal>

      {/* Merge Modal */}
      <Modal
        open={!!mergeFor}
        onClose={() => { setMergeFor(null); setMergeQuery(""); setMergeOpen(false); setMergeHighlight(-1); }}
        title="Unir con ingrediente existente"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Agregar <span className="font-medium" style={{ color: "var(--text)" }}>"{mergeFor}"</span> como alias de:
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Seleccionar ingrediente..."
              value={mergeOpen ? mergeQuery : (ingredients.find((i) => i.id === mergingIntoId)?.canonical_name ?? "")}
              className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: mergingIntoId && !mergeOpen ? "var(--text)" : "var(--text-dim)" }}
              onFocus={() => { setMergeOpen(true); setMergeQuery(""); }}
              onChange={(e) => { setMergeQuery(e.target.value); setMergeHighlight(-1); }}
              onBlur={() => setTimeout(() => setMergeOpen(false), 150)}
              onKeyDown={(e) => {
                const filtered = mergeQuery.trim()
                  ? ingredients.filter((i) => i.canonical_name.toLowerCase().includes(mergeQuery.toLowerCase()))
                  : ingredients;
                if (e.key === "ArrowDown") { e.preventDefault(); setMergeHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setMergeHighlight((h) => Math.max(h - 1, 0)); }
                else if (e.key === "Enter") { e.preventDefault(); if (mergeHighlight >= 0 && filtered[mergeHighlight]) { setMergingIntoId(filtered[mergeHighlight].id); setMergeQuery(""); setMergeOpen(false); setMergeHighlight(-1); } }
                else if (e.key === "Escape") setMergeOpen(false);
              }}
            />
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {mergeOpen && (() => {
              const filtered = mergeQuery.trim()
                ? ingredients.filter((i) => i.canonical_name.toLowerCase().includes(mergeQuery.toLowerCase()))
                : ingredients;
              return (
                <div className="absolute z-50 w-full mt-1 rounded-[var(--radius-sm)] border shadow-lg overflow-y-auto"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", maxHeight: 200 }}>
                  {filtered.length === 0 ? (
                    <div className="px-3 py-2 text-xs" style={{ color: "var(--text-dim)" }}>Sin resultados</div>
                  ) : filtered.map((ing, i) => (
                    <button key={ing.id} type="button"
                      className="w-full text-left px-3 py-2 text-sm"
                      style={{ background: i === mergeHighlight ? "var(--blue-glow)" : "transparent", color: i === mergeHighlight ? "var(--blue)" : "var(--text)" }}
                      onMouseDown={() => { setMergingIntoId(ing.id); setMergeQuery(""); setMergeOpen(false); setMergeHighlight(-1); }}
                      onMouseEnter={() => setMergeHighlight(i)}
                    >
                      {ing.canonical_name}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setMergeFor(null); setMergeQuery(""); setMergeOpen(false); setMergeHighlight(-1); }}>Cancelar</Button>
            <Button size="sm" loading={normalizeSaving} disabled={!mergingIntoId}
              onClick={async () => {
                if (!mergeFor || !mergingIntoId) return;
                setNormalizeSaving(true);
                try {
                  const res = await fetch(`/api/compras/ingredients/${mergingIntoId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ addAlias: mergeFor }),
                  });
                  if (res.ok) { setMergeFor(null); setMergingIntoId(""); setMergeQuery(""); setMergeOpen(false); setMergeHighlight(-1); fetchNormalize(); }
                } finally { setNormalizeSaving(false); }
              }}
            >
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Item Modal */}
      <AddItemModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={() => { setAddModalOpen(false); fetchData(); fetchStats(); }}
        supplierList={stats.supplierList}
      />

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Eliminar artículo"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            ¿Eliminar{" "}
            <span className="font-medium" style={{ color: "var(--text)" }}>
              {deleteTarget?.description ?? "este artículo"}
            </span>
            ? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={confirmDelete}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete invoice confirmation modal */}
      <Modal
        open={!!deleteInvoiceId}
        onClose={() => setDeleteInvoiceId(null)}
        title="Eliminar factura"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            ¿Eliminar esta factura y todos sus artículos? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteInvoiceId(null)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" loading={deletingInvoice} onClick={confirmDeleteInvoice}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk delete invoices confirmation modal */}
      <Modal
        open={confirmDeleteInvoices}
        onClose={() => setConfirmDeleteInvoices(false)}
        title="Eliminar facturas"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            ¿Eliminar <span className="font-medium" style={{ color: "var(--text)" }}>{selectedInvoiceIds.size} factura{selectedInvoiceIds.size !== 1 ? "s" : ""}</span> y todos sus artículos? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteInvoices(false)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" loading={deletingInvoice} onClick={deleteSelectedInvoices}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete ingredients confirmation modal */}
      <Modal
        open={confirmDeleteIngredients}
        onClose={() => setConfirmDeleteIngredients(false)}
        title="Eliminar ingredientes"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            ¿Eliminar <span className="font-medium" style={{ color: "var(--text)" }}>{selectedIngredientIds.size} ingrediente{selectedIngredientIds.size !== 1 ? "s" : ""}</span>? Los artículos vinculados quedarán sin asignar. Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteIngredients(false)}>Cancelar</Button>
            <Button variant="danger" size="sm" loading={deletingIngredients} onClick={deleteSelectedIngredients}>Eliminar</Button>
          </div>
        </div>
      </Modal>
    </Shell>
  );
}

// ─── Mobile Item Card ─────────────────────────────────────────────
function MobileItemCard({
  item,
  onDelete,
  onEdit,
  editingId,
  editField,
  editValue,
  setEditValue,
  onSaveEdit,
  onCancelEdit,
  itemId,
}: {
  item: DbLineItem;
  onDelete: () => void;
  onEdit: (field: string, val: string) => void;
  editingId: string | null;
  editField: string;
  editValue: string;
  setEditValue: (v: string) => void;
  onSaveEdit: (field: string, val: string) => void;
  onCancelEdit: () => void;
  itemId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-[var(--radius)] border" style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{item.description || "Sin descripción"}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>{item.supplier}</span>
            <span>·</span>
            <span>{formatDate(item.invoice_date)}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-semibold" style={{ color: "var(--blue)" }}>{formatCurrency(item.total)}</p>
          {item.quantity != null && (
            <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
              {item.quantity} {item.unit_normalized ?? item.unit ?? ""} × {item.unit_price != null ? formatCurrency(item.unit_price) : "—"}
            </p>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t px-3 py-2.5 space-y-2" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)" }}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: "Descripción", field: "description", val: item.description },
              { label: "Cantidad", field: "quantity", val: item.quantity != null ? String(item.quantity) : "" },
              { label: "Unidad", field: "unit", val: item.unit_normalized ?? item.unit ?? "" },
              { label: "P. Unitario", field: "unitPrice", val: item.unit_price != null ? String(item.unit_price) : "" },
              { label: "Total", field: "total", val: String(item.total) },
            ].map(({ label, field, val }) => (
              <div key={field}>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-dim)" }}>{label}</p>
                {editingId === itemId && editField === field ? (
                  <input
                    type={["quantity", "unitPrice", "total"].includes(field) ? "number" : "text"}
                    value={editValue}
                    step="any"
                    autoFocus
                    className="w-full px-1.5 py-0.5 rounded border text-xs focus:outline-none focus:ring-1"
                    style={{ background: "var(--surface)", borderColor: "var(--blue)", color: "var(--text)" }}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => onSaveEdit(field, editValue)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSaveEdit(field, editValue);
                      if (e.key === "Escape") onCancelEdit();
                    }}
                  />
                ) : (
                  <p
                    className="cursor-pointer"
                    style={{ color: "var(--text)" }}
                    onClick={(e) => { e.stopPropagation(); onEdit(field, val); }}
                  >
                    {val || "—"}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--pink-glow)", color: "var(--pink-dark)" }}>
              {restaurantLabel(item.restaurant)}
            </span>
            <button
              type="button"
              className="text-xs font-medium px-2 py-1 rounded transition-colors duration-150"
              style={{ color: "var(--danger)", background: "var(--danger-dim)" }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Supplier Combobox ───────────────────────────────────────────
function SupplierCombobox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  // Keep query in sync when value changes externally (e.g. reset)
  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Reset highlight when filtered list changes
  useEffect(() => { setHighlightedIndex(-1); }, [query]);

  function select(opt: string) {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
    setHighlightedIndex(-1);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) { if (e.key === "ArrowDown") setOpen(true); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        select(filtered[highlightedIndex]);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          placeholder="Nombre..."
          className="w-full mt-1 px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
          style={{ background: "var(--surface)", borderColor: open ? "var(--blue)" : "var(--border)", color: "var(--text)", boxShadow: open ? "0 0 0 3px color-mix(in srgb, var(--blue) 15%, transparent)" : undefined }}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5"
          style={{ color: "var(--text-dim)" }}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d={open ? "M2 8l4-4 4 4" : "M2 4l4 4 4-4"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-[var(--radius-sm)] border overflow-hidden"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-elevated)" }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm" style={{ color: "var(--text-dim)" }}>
              {query.trim() ? `Agregar "${query}"` : "Sin opciones"}
            </div>
          ) : (
            <ul ref={listRef} className="max-h-48 overflow-y-auto py-1">
              {filtered.map((opt, i) => {
                const isHighlighted = i === highlightedIndex;
                const isSelected = opt === value;
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm transition-colors duration-100"
                      style={{
                        background: isHighlighted ? "var(--blue-glow)" : "transparent",
                        color: isHighlighted || isSelected ? "var(--blue)" : "var(--text)",
                        fontWeight: isSelected ? 600 : 400,
                      }}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onMouseLeave={() => setHighlightedIndex(-1)}
                      onMouseDown={(e) => { e.preventDefault(); select(opt); }}
                    >
                      {opt}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Item Modal ─────────────────────────────────────────────
function AddItemModal({
  open,
  onClose,
  onAdded,
  supplierList = [],
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  supplierList?: string[];
}) {
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [total, setTotal] = useState("");
  const [addRestaurant, setAddRestaurant] = useState("motin_juarez");
  const [addSupplier, setAddSupplier] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");

  async function handleAdd() {
    if (!description.trim() || !addSupplier.trim() || !total) {
      setAddError("Descripción, proveedor y total son requeridos");
      return;
    }
    setSaving(true);
    setAddError("");
    try {
      const res = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          quantity: quantity ? parseFloat(quantity) : null,
          unit: unit || null,
          unitPrice: unitPrice ? parseFloat(unitPrice) : null,
          total: parseFloat(total),
          restaurant: addRestaurant,
          supplier: addSupplier.trim(),
          invoiceDate,
        }),
      });
      if (!res.ok) { setAddError("Error al guardar"); return; }
      // Reset
      setDescription(""); setQuantity(""); setUnit(""); setUnitPrice(""); setTotal(""); setAddSupplier("");
      onAdded();
    } catch { setAddError("Error de conexión"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar artículo">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Descripción *</label>
          <input type="text" value={description} placeholder="Nombre del producto..."
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
            onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Proveedor *</label>
            <SupplierCombobox
              value={addSupplier}
              onChange={setAddSupplier}
              options={supplierList}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Restaurante</label>
            <div className="relative mt-1">
              <select value={addRestaurant}
                className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                onChange={(e) => setAddRestaurant(e.target.value)}>
                <option value="motin_juarez">Motín Juárez</option>
                <option value="motin_roma">Motín Roma</option>
                <option value="queseria">Quesería</option>
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Cantidad</label>
            <input type="number" value={quantity} step="any" placeholder="0"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Unidad</label>
            <input type="text" value={unit} placeholder="kg"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>P. Unit.</label>
            <input type="number" value={unitPrice} step="0.01" placeholder="$0"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setUnitPrice(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total *</label>
            <input type="number" value={total} step="0.01" placeholder="$0"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setTotal(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Fecha</label>
          <input type="date" value={invoiceDate}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
            onChange={(e) => setInvoiceDate(e.target.value)} />
        </div>
        {addError && <p className="text-xs" style={{ color: "var(--danger)" }}>{addError}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" loading={saving} onClick={handleAdd}>Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Create Ingredient Form ────────────────────────────────────────
function CreateIngredientForm({
  initialName,
  onSave,
  onClose,
  saving,
}: {
  initialName: string;
  onSave: (canonicalName: string, category: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState("");
  const [catQuery, setCatQuery] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [catHighlight, setCatHighlight] = useState(-1);

  const allCats = ["Sin categoría", ...(dropdownOptions.concepto as string[])];
  const filteredCats = catQuery.trim()
    ? allCats.filter((c) => c.toLowerCase().includes(catQuery.toLowerCase()))
    : allCats;

  function selectCat(val: string) {
    setCategory(val === "Sin categoría" ? "" : val);
    setCatQuery("");
    setCatOpen(false);
    setCatHighlight(-1);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Nombre canónico *</label>
        <input type="text" value={name}
          className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          onChange={(e) => setName(e.target.value)} />
        <p className="text-[10px] mt-1" style={{ color: "var(--text-dim)" }}>
          El alias "{initialName}" se agrega automáticamente.
        </p>
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Categoría</label>
        <div className="relative mt-1">
          <input
            type="text"
            value={catOpen ? catQuery : (category || "")}
            placeholder="Sin categoría"
            className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: category && !catOpen ? "var(--text)" : "var(--text-dim)" }}
            onFocus={() => { setCatOpen(true); setCatQuery(""); }}
            onChange={(e) => { setCatQuery(e.target.value); setCatHighlight(-1); }}
            onBlur={() => setTimeout(() => setCatOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCatHighlight((i) => Math.min(i + 1, filteredCats.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setCatHighlight((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); if (catHighlight >= 0 && filteredCats[catHighlight]) selectCat(filteredCats[catHighlight]); }
              else if (e.key === "Escape") setCatOpen(false);
            }}
          />
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {catOpen && (
            <div className="absolute z-50 w-full mt-1 rounded-[var(--radius-sm)] border shadow-lg overflow-y-auto"
              style={{ background: "var(--surface)", borderColor: "var(--border)", maxHeight: 200 }}>
              {filteredCats.length === 0 ? (
                <div className="px-3 py-2 text-xs" style={{ color: "var(--text-dim)" }}>Sin resultados</div>
              ) : filteredCats.map((c, i) => (
                <button key={c} type="button"
                  className="w-full text-left px-3 py-2 text-sm"
                  style={{
                    background: i === catHighlight ? "var(--blue-glow)" : "transparent",
                    color: i === catHighlight ? "var(--blue)" : "var(--text)",
                  }}
                  onMouseDown={() => selectCat(c)}
                  onMouseEnter={() => setCatHighlight(i)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" loading={saving} disabled={!name.trim()} onClick={() => onSave(name.trim(), category)}>
          Crear
        </Button>
      </div>
    </div>
  );
}

// ─── Ingredient Edit Row ───────────────────────────────────────────
const NORMALIZED_UNITS_LIST = [
  "kg", "g", "l", "ml", "pz", "caja", "docena",
  "bolsa", "metro", "lata", "botella", "galon",
  "costal", "sobre", "rollo", "otros",
];

function IngredientEditRow({
  ingredient,
  onClose,
  onSaved,
  onDeleted,
}: {
  ingredient: Ingredient;
  onClose: () => void;
  onSaved: (updated: Ingredient) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(ingredient.canonical_name);
  const [category, setCategory] = useState(ingredient.category ?? "");
  const [defaultUnit, setDefaultUnit] = useState(ingredient.default_unit ?? "");
  const [aliases, setAliases] = useState<string[]>(ingredient.aliases);
  const [newAlias, setNewAlias] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [catQuery, setCatQuery] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [catHighlight, setCatHighlight] = useState(-1);

  const allCats = ["Sin categoría", ...(dropdownOptions.concepto as string[])];
  const filteredCats = catQuery.trim()
    ? allCats.filter((c) => c.toLowerCase().includes(catQuery.toLowerCase()))
    : allCats;

  function selectCat(val: string) {
    setCategory(val === "Sin categoría" ? "" : val);
    setCatQuery("");
    setCatOpen(false);
    setCatHighlight(-1);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/compras/ingredients/${ingredient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalName: name.trim(),
          aliases,
          category: category || null,
          defaultUnit: defaultUnit || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onSaved({ ...ingredient, ...updated, default_unit: updated.default_unit ?? null });
      }
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/compras/ingredients/${ingredient.id}`, { method: "DELETE" });
      onDeleted(ingredient.id);
    } finally { setDeleting(false); }
  }

  function removeAlias(a: string) {
    setAliases((prev) => prev.filter((x) => x !== a));
  }

  function addAlias() {
    const trimmed = newAlias.trim();
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases((prev) => [...prev, trimmed]);
    }
    setNewAlias("");
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
          style={{ color: "var(--text-muted)" }}>Nombre canónico</label>
        <input type="text" value={name}
          className="w-full px-3 py-2.5 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
          style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: "var(--text)" }}
          onChange={(e) => setName(e.target.value)} />
      </div>

      {/* Category + Unit */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: "var(--text-muted)" }}>Categoría</label>
          <div className="relative">
            <input
              type="text"
              value={catOpen ? catQuery : (category || "")}
              placeholder="Sin categoría"
              className="w-full px-3 py-2.5 pr-8 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: category && !catOpen ? "var(--text)" : "var(--text-dim)" }}
              onFocus={() => { setCatOpen(true); setCatQuery(""); }}
              onChange={(e) => { setCatQuery(e.target.value); setCatHighlight(-1); }}
              onBlur={() => setTimeout(() => setCatOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setCatHighlight((i) => Math.min(i + 1, filteredCats.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setCatHighlight((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter") { e.preventDefault(); if (catHighlight >= 0 && filteredCats[catHighlight]) selectCat(filteredCats[catHighlight]); }
                else if (e.key === "Escape") setCatOpen(false);
              }}
            />
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {catOpen && (
              <div className="absolute z-50 w-full mt-1 rounded-[var(--radius-sm)] border shadow-lg overflow-y-auto"
                style={{ background: "var(--surface)", borderColor: "var(--border)", maxHeight: 180 }}>
                {filteredCats.map((c, i) => (
                  <button key={c} type="button"
                    className="w-full text-left px-3 py-2 text-xs"
                    style={{ background: i === catHighlight ? "var(--blue-glow)" : "transparent", color: i === catHighlight ? "var(--blue)" : "var(--text)" }}
                    onMouseDown={() => selectCat(c)}
                    onMouseEnter={() => setCatHighlight(i)}
                  >{c}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: "var(--text-muted)" }}>Unidad</label>
          <div className="relative">
            <select value={defaultUnit}
              className="w-full px-3 py-2.5 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: defaultUnit ? "var(--text)" : "var(--text-dim)" }}
              onChange={(e) => setDefaultUnit(e.target.value)}>
              <option value="">—</option>
              {NORMALIZED_UNITS_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Aliases — tag input */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
          style={{ color: "var(--text-muted)" }}>Alias</label>
        <div
          className="flex flex-wrap gap-1.5 p-2 rounded-[var(--radius-sm)] border min-h-[44px] cursor-text"
          style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}
          onClick={() => (document.getElementById("ing-alias-input") as HTMLInputElement)?.focus()}
        >
          {aliases.map((a) => (
            <span key={a} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md flex-shrink-0"
              style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}>
              <span className="max-w-[160px] truncate">{a}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); removeAlias(a); }}
                className="flex-shrink-0 opacity-40 hover:opacity-80 transition-opacity ml-0.5"
                style={{ color: "var(--text-muted)", lineHeight: 1 }}>
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))}
          <input
            id="ing-alias-input"
            type="text"
            value={newAlias}
            placeholder={aliases.length === 0 ? "Escribe y presiona Enter…" : "Agregar…"}
            className="flex-1 min-w-[120px] text-xs bg-transparent outline-none py-1 px-1"
            style={{ color: "var(--text)" }}
            onChange={(e) => setNewAlias(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addAlias(); }
              if (e.key === "Backspace" && !newAlias && aliases.length > 0) removeAlias(aliases[aliases.length - 1]);
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="pt-1">
        <div className="flex items-center gap-2">
          {/* Delete — left side */}
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button type="button"
                className="text-xs font-semibold px-2.5 py-2 rounded-[var(--radius-sm)] transition-colors"
                style={{ background: "rgba(var(--danger-rgb,220,38,38),0.12)", color: "var(--danger)" }}
                onClick={handleDelete}>
                {deleting ? "Eliminando…" : "Sí, eliminar"}
              </button>
              <button type="button" className="text-xs px-2 py-2 transition-opacity hover:opacity-60"
                style={{ color: "var(--text-muted)" }}
                onClick={() => setConfirmDelete(false)}>No</button>
            </div>
          ) : (
            <button type="button"
              className="text-xs font-medium px-2.5 py-2 rounded-[var(--radius-sm)] transition-colors flex-shrink-0"
              style={{ background: "rgba(220,38,38,0.08)", color: "var(--danger)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.14)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.08)"; }}
              onClick={() => setConfirmDelete(true)}>
              Eliminar
            </button>
          )}
          {/* Spacer */}
          <div className="flex-1" />
          {/* Cancel + Save */}
          <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
          <Button size="md" loading={saving} disabled={!name.trim()} onClick={handleSave}>Guardar</Button>
        </div>
      </div>
    </div>
  );
}
