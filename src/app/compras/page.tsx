"use client";

import React, { useCallback, useEffect, useState, lazy, Suspense } from "react";
import Shell from "@/components/Shell";
import Button from "@/components/ui/Button";
import { SkeletonTable } from "@/components/ui/Skeleton";
import type {
  ViewMode, DbLineItem, DbInvoice, SupplierGroup, Pagination, Stats,
  Ingredient, UnmatchedGroup, AnalyticsData,
} from "./types";
import { getPresetRange, getWeekOptions } from "./types";
import FilterPanel from "./components/FilterPanel";
import FilterChips from "@/components/ui/FilterChips";
import ExportButton from "@/components/ui/ExportButton";
import ItemsView from "./components/ItemsView";
import InvoicesView from "./components/InvoicesView";
import SuppliersView from "./components/SuppliersView";
const AnalyticsView = lazy(() => import("./components/AnalyticsView"));
import NormalizeView from "./components/NormalizeView";

// ─── Main Page ──────────────────────────────────────────────────────
export default function ComprasPage() {
  // Shared filter state
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

  // Data state
  const [items, setItems] = useState<DbLineItem[]>([]);
  const [invoices, setInvoices] = useState<DbInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierGroup[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<Stats>({ totalItems: 0, totalSpend: 0, uniqueSuppliers: 0, supplierList: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Normalize state
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedGroup[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [normalizeLoading, setNormalizeLoading] = useState(false);

  // Supplier tags state
  const [supplierTags, setSupplierTags] = useState<Record<string, string>>({});

  // Add modal
  const [addModalOpen, setAddModalOpen] = useState(false);

  // ── Fetchers ──────────────────────────────────────────────────────
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

  const fetchNormalize = useCallback(async () => {
    setNormalizeLoading(true);
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

  // ── Effects ───────────────────────────────────────────────────────
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
  useEffect(() => { setUnmatchedCount(unmatched.length); }, [unmatched]);
  useEffect(() => {
    fetch("/api/compras?view=normalize&pageSize=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.pagination?.total != null) setUnmatchedCount(data.pagination.total); })
      .catch(() => {});
  }, []);

  // ── Filter handlers ───────────────────────────────────────────────
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

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  }

  const hasFilters = !!(search || restaurant || supplier || dateFrom || dateTo || selectedMonth || selectedWeek);

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-0 animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-4">
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text)" }}>
            Gastos de Alimentos
          </h1>
          <div className="flex items-center gap-2">
            {(view === "items" || view === "invoices") && (
              <ExportButton
                href="/api/compras/export"
                params={{
                  type: view === "invoices" ? "invoices" : "items",
                  ...(restaurant && { restaurant }),
                  ...(dateFrom && { dateFrom }),
                  ...(dateTo && { dateTo }),
                  ...(supplier && { supplier }),
                }}
              />
            )}
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">Agregar</span>
            </Button>
          </div>
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
        <FilterPanel
          showFilters={showFilters}
          search={search} setSearch={setSearch}
          restaurant={restaurant} setRestaurant={setRestaurant}
          supplier={supplier} setSupplier={setSupplier}
          supplierList={stats.supplierList}
          dateFrom={dateFrom} setDateFrom={(v) => { setDateFrom(v); setSelectedMonth(""); setSelectedWeek(""); }}
          dateTo={dateTo} setDateTo={(v) => { setDateTo(v); setSelectedMonth(""); setSelectedWeek(""); }}
          selectedMonth={selectedMonth}
          selectedWeek={selectedWeek}
          activePreset={activePreset}
          hasFilters={hasFilters}
          onMonthSelect={handleMonthSelect}
          onWeekSelect={handleWeekSelect}
          onApplyPreset={applyPreset}
          onResetFilters={resetFilters}
        />

        {/* Active filter chips — always visible */}
        {hasFilters && (
          <div className="pt-3">
            <FilterChips
              chips={[
                ...(search ? [{ label: `"${search}"`, onRemove: () => setSearch("") }] : []),
                ...(restaurant ? [{ label: restaurant === "motin_juarez" ? "Motín Juárez" : restaurant === "motin_roma" ? "Motín Roma" : "Quesería", onRemove: () => setRestaurant("") }] : []),
                ...(supplier ? [{ label: supplier, onRemove: () => setSupplier("") }] : []),
                ...(activePreset ? [{ label: activePreset === "thisMonth" ? "Este mes" : activePreset === "lastMonth" ? "Mes pasado" : activePreset === "last30" ? "Últ. 30d" : "YTD", onRemove: () => { setActivePreset(""); setDateFrom(""); setDateTo(""); } }] : []),
                ...(!activePreset && selectedMonth ? [{ label: selectedMonth, onRemove: () => { setSelectedMonth(""); setDateFrom(""); setDateTo(""); } }] : []),
                ...(!activePreset && !selectedMonth && selectedWeek ? [{ label: `Sem. ${selectedWeek}`, onRemove: () => { setSelectedWeek(""); setDateFrom(""); setDateTo(""); } }] : []),
                ...(!activePreset && !selectedMonth && !selectedWeek && dateFrom ? [{ label: `Desde ${dateFrom}`, onRemove: () => setDateFrom("") }] : []),
                ...(!activePreset && !selectedMonth && !selectedWeek && dateTo ? [{ label: `Hasta ${dateTo}`, onRemove: () => setDateTo("") }] : []),
              ]}
              onClearAll={resetFilters}
            />
          </div>
        )}

        <div className="pt-4" />

        {/* Error */}
        {error && (
          <div className="p-4 rounded-[var(--radius)] border" style={{ borderColor: "var(--danger)", background: "var(--danger-dim)" }}>
            <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && view !== "analytics" && view !== "normalize" && <SkeletonTable rows={6} />}

        {/* Empty state */}
        {!loading && !error && pagination.total === 0 && view !== "analytics" && view !== "normalize" && (
          <div className="text-center py-16 space-y-4">
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
            <a href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98]"
              style={{ background: "var(--blue)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Subir tu primera factura
            </a>
          </div>
        )}

        {/* ─── View content ─────────────────────────────────────────── */}
        {!loading && view === "items" && items.length > 0 && (
          <ItemsView
            items={items} setItems={setItems}
            sortBy={sortBy} sortDir={sortDir} toggleSort={toggleSort}
            fetchStats={fetchStats}
            addModalOpen={addModalOpen} setAddModalOpen={setAddModalOpen}
            supplierList={stats.supplierList} fetchData={fetchData}
          />
        )}

        {!loading && view === "invoices" && invoices.length > 0 && (
          <InvoicesView
            invoices={invoices} setInvoices={setInvoices}
            fetchStats={fetchStats}
          />
        )}

        {!loading && view === "suppliers" && (
          <SuppliersView
            suppliers={suppliers}
            supplierTags={supplierTags} setSupplierTags={setSupplierTags}
          />
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

        {view === "analytics" && (
          <Suspense fallback={<div className="py-8 text-center"><div className="w-5 h-5 mx-auto border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} /></div>}>
            <AnalyticsView analyticsData={analyticsData} analyticsLoading={analyticsLoading} />
          </Suspense>
        )}

        {view === "normalize" && (
          <NormalizeView
            ingredients={ingredients} setIngredients={setIngredients}
            unmatched={unmatched} unmatchedCount={unmatchedCount}
            normalizeLoading={normalizeLoading} fetchNormalize={fetchNormalize}
          />
        )}
      </div>
    </Shell>
  );
}
