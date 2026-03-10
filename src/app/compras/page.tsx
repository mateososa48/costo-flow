"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
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
};

type UnmatchedGroup = {
  description: string;
  count: number;
};

type AnalyticsData = {
  monthlySpend: Array<Record<string, string | number>>;
  categories: string[];
  topItems: Array<{ description: string; totalSpend: number; count: number }>;
  spendByRestaurant: Array<{ restaurant: string; total: number }>;
};

const CHART_COLORS = [
  "#3b82f6", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#64748b",
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
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Normalize state
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedGroup[]>([]);
  const [normalizeLoading, setNormalizeLoading] = useState(false);
  const [createIngredientFor, setCreateIngredientFor] = useState<string | null>(null);
  const [mergeFor, setMergeFor] = useState<string | null>(null);
  const [mergingIntoId, setMergingIntoId] = useState("");
  const [normalizeSaving, setNormalizeSaving] = useState(false);

  // ── Fetch analytics ─────────────────────────────────────────────
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

  useEffect(() => { document.title = "Compras — Aventura Gourmet"; }, []);
  useEffect(() => { if (view !== "analytics" && view !== "normalize") fetchData(); }, [fetchData, view]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { setPage(1); }, [view, search, restaurant, supplier, dateFrom, dateTo]);
  useEffect(() => { if (view === "analytics") fetchAnalytics(); }, [view, fetchAnalytics]);
  useEffect(() => { if (view === "normalize") fetchNormalize(); }, [view, fetchNormalize]);

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
    setSelectedMonth(""); setSelectedWeek("");
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
        <div className="flex items-center justify-between gap-4 pb-2">
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text)" }}>
            Compras
          </h1>
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Agregar</span>
          </Button>
        </div>

        {/* Stats strip below title */}
        <div className="flex items-center gap-0 divide-x rounded-[var(--radius-sm)] border overflow-hidden mb-4 w-fit"
          style={{ borderColor: "var(--border)" }}>
          {[
            { label: "gasto total", value: formatCurrency(stats.totalSpend), highlight: true },
            { label: "proveedores", value: stats.uniqueSuppliers.toLocaleString("es-MX"), highlight: false },
            { label: "artículos", value: stats.totalItems.toLocaleString("es-MX"), highlight: false },
          ].map((stat) => (
            <div key={stat.label} className="px-3 py-1.5" style={{ background: stat.highlight ? "var(--blue-glow)" : "var(--surface)" }}>
              <span className="text-xs font-semibold" style={{ color: stat.highlight ? "var(--blue)" : "var(--text)" }}>
                {stat.value}
              </span>
              <span className="text-xs ml-1" style={{ color: "var(--text-dim)" }}>{stat.label}</span>
            </div>
          ))}
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
                className="px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors duration-150"
                style={{
                  borderBottomColor: view === key ? "var(--blue)" : "transparent",
                  color: view === key ? "var(--blue)" : "var(--text-muted)",
                  background: "transparent",
                }}
                onClick={() => { setView(key); setSortBy("date"); setSortDir("desc"); }}
              >
                {label}
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

          {/* Row 2: month + week + desde/hasta (compact) + limpiar */}
          <div className="flex flex-wrap items-center gap-2">
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
                        { field: "unit", val: item.unit ?? "", w: "w-16" },
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
                              className="cursor-pointer hover:underline truncate block"
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
            {invoices.map((inv) => {
              const isExpanded = expandedInvoices.has(inv.id);
              return (
                <div key={inv.id} className="rounded-[var(--radius)] border overflow-hidden"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    onClick={() => {
                      setExpandedInvoices((prev) => {
                        const next = new Set(prev);
                        isExpanded ? next.delete(inv.id) : next.add(inv.id);
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
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t px-4 py-3 space-y-1.5" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)" }}>
                      {inv.lineItems.length === 0 ? (
                        <p className="text-xs py-2" style={{ color: "var(--text-dim)" }}>Sin artículos individuales</p>
                      ) : (
                        inv.lineItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                            <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{item.description}</span>
                            <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                              {item.quantity != null ? `${item.quantity} ${item.unit ?? ""}` : ""}
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
              return (
                <div key={group.supplier} className="rounded-[var(--radius)] border overflow-hidden"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
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
                  {isExpanded && (
                    <div className="border-t px-4 py-3 space-y-1.5" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)" }}>
                      {group.items.map((item: DbLineItem) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                          <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{item.description}</span>
                          <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                            {formatDate(item.invoice_date)}
                          </span>
                          <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                            {item.quantity != null ? `${item.quantity} ${item.unit ?? ""}` : ""}
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
        {!loading && pagination.totalPages > 1 && (
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
          <div className="space-y-6">
            {analyticsLoading && (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
              </div>
            )}
            {!analyticsLoading && analyticsData && (
              <>
                {/* Monthly spend by category */}
                <div className="rounded-[var(--radius)] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>Gasto mensual por categoría</h3>
                  {analyticsData.monthlySpend.length === 0 ? (
                    <p className="text-sm py-8 text-center" style={{ color: "var(--text-dim)" }}>Sin datos</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={analyticsData.monthlySpend} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(value: any, name: any) => [formatCurrency(Number(value)), String(name ?? "")]}
                          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                          labelStyle={{ color: "var(--text)", fontWeight: 600 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {analyticsData.categories.slice(0, 10).map((cat, i) => (
                          <Bar key={cat} dataKey={cat} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Top 10 items */}
                <div className="rounded-[var(--radius)] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>Top 10 artículos por gasto</h3>
                  {analyticsData.topItems.length === 0 ? (
                    <p className="text-sm py-8 text-center" style={{ color: "var(--text-dim)" }}>Sin datos</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        layout="vertical"
                        data={analyticsData.topItems}
                        margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="description" width={140}
                          tick={{ fontSize: 10, fill: "var(--text)" }} />
                        <Tooltip
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(value: any) => [formatCurrency(Number(value)), "Gasto total"]}
                          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                        />
                        <Bar dataKey="totalSpend" fill={CHART_COLORS[0]} radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Spend by restaurant */}
                {analyticsData.spendByRestaurant.length > 1 && (
                  <div className="grid grid-cols-3 gap-3">
                    {analyticsData.spendByRestaurant.map((r) => (
                      <div key={r.restaurant} className="rounded-[var(--radius)] border p-3"
                        style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          {restaurantLabel(r.restaurant)}
                        </p>
                        <p className="text-lg font-bold mt-1" style={{ color: "var(--blue)" }}>
                          {formatCurrency(r.total)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {!analyticsLoading && !analyticsData && (
              <p className="text-sm text-center py-12" style={{ color: "var(--text-dim)" }}>Sin datos de análisis</p>
            )}
          </div>
        )}

        {/* ─── NORMALIZE VIEW ──────────────────────────────────────── */}
        {view === "normalize" && (
          <div className="space-y-5">
            {normalizeLoading && (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
              </div>
            )}
            {!normalizeLoading && (
              <div className="grid md:grid-cols-2 gap-5">
                {/* Unmatched descriptions */}
                <div className="rounded-[var(--radius)] border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      Sin identificar
                      {unmatched.length > 0 && (
                        <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded-full" style={{ background: "var(--blue-glow)", color: "var(--blue)" }}>
                          {unmatched.length}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Artículos sin ingrediente canónico asignado</p>
                  </div>
                  {unmatched.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm" style={{ color: "var(--text-dim)" }}>Todo identificado ✓</p>
                    </div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                      {unmatched.map((u) => (
                        <div key={u.description} className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate" style={{ color: "var(--text)" }}>{u.description}</p>
                            <p className="text-xs" style={{ color: "var(--text-dim)" }}>{u.count} artículo{u.count !== 1 ? "s" : ""}</p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button type="button"
                              className="px-2 py-1 rounded text-xs font-medium transition-colors duration-150"
                              style={{ background: "var(--blue-glow)", color: "var(--blue)" }}
                              onClick={() => { setCreateIngredientFor(u.description); setMergeFor(null); }}
                            >
                              Nuevo
                            </button>
                            <button type="button"
                              className="px-2 py-1 rounded text-xs font-medium transition-colors duration-150"
                              style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}
                              onClick={() => { setMergeFor(u.description); setCreateIngredientFor(null); setMergingIntoId(""); }}
                            >
                              Unir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Registered ingredients */}
                <div className="rounded-[var(--radius)] border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      Ingredientes registrados
                      {ingredients.length > 0 && (
                        <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}>
                          {ingredients.length}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Nombres canónicos con todos sus alias</p>
                  </div>
                  {ingredients.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm" style={{ color: "var(--text-dim)" }}>Ningún ingrediente registrado aún</p>
                    </div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                      {ingredients.map((ing) => (
                        <div key={ing.id} className="px-4 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{ing.canonical_name}</p>
                              {ing.category && (
                                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{ing.category}</p>
                              )}
                              {ing.aliases.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {ing.aliases.map((a) => (
                                    <span key={a} className="text-[10px] px-1.5 py-0.5 rounded-full"
                                      style={{ background: "var(--surface-raised)", color: "var(--text-dim)" }}>
                                      {a}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
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

      {/* Merge Modal */}
      <Modal
        open={!!mergeFor}
        onClose={() => setMergeFor(null)}
        title="Unir con ingrediente existente"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Agregar <span className="font-medium" style={{ color: "var(--text)" }}>"{mergeFor}"</span> como alias de:
          </p>
          <div className="relative">
            <select
              value={mergingIntoId}
              className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: mergingIntoId ? "var(--text)" : "var(--text-dim)" }}
              onChange={(e) => setMergingIntoId(e.target.value)}
            >
              <option value="">Seleccionar ingrediente...</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>{ing.canonical_name}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setMergeFor(null)}>Cancelar</Button>
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
                  if (res.ok) { setMergeFor(null); setMergingIntoId(""); fetchNormalize(); }
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
              {item.quantity} {item.unit ?? ""} × {item.unit_price != null ? formatCurrency(item.unit_price) : "—"}
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
              { label: "Unidad", field: "unit", val: item.unit ?? "" },
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
          <select value={category}
            className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: category ? "var(--text)" : "var(--text-dim)" }}
            onChange={(e) => setCategory(e.target.value)}>
            <option value="">Sin categoría</option>
            {(dropdownOptions.concepto as string[]).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
