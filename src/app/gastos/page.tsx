"use client";

import React, { useEffect, useState, lazy, Suspense } from "react";
import Shell from "@/components/Shell";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { SkeletonAnalytics, SkeletonTable } from "@/components/ui/Skeleton";
import FilterChips from "@/components/ui/FilterChips";
import ExportButton from "@/components/ui/ExportButton";
import { RESTAURANT_LABELS } from "@/types";
import type { Restaurant } from "@/types";
import dropdownOptions from "../../../data/dropdown_options.json";

const GastosAnalytics = lazy(() => import("./GastosAnalytics"));

type ViewMode = "invoices" | "suppliers" | "analytics";

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
  lineItems: Array<{ description: string; quantity: number | null; unit: string | null; total: number }>;
};

type AnalyticsData = {
  kpis: { totalSpend: number; invoiceCount: number; uniqueSuppliers: number };
  monthlySpend: Array<Record<string, string | number>>;
  cuentas: string[];
  breakdown: Array<{ name: string; value: number }>;
  topSuppliers: Array<{ supplier: string; total: number }>;
};


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

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

export default function GastosPage() {
  const [view, setView] = useState<ViewMode>("invoices");
  const [restaurant, setRestaurant] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Invoices state
  const [invoices, setInvoices] = useState<DbInvoice[]>([]);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [invPage, setInvPage] = useState(1);
  const [invTotal, setInvTotal] = useState(0);
  const invPageSize = 50;
  const [invoiceSelectMode, setInvoiceSelectMode] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [confirmDeleteInvoices, setConfirmDeleteInvoices] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [reclassifyingId, setReclassifyingId] = useState<string | null>(null);
  const [reclassifyValue, setReclassifyValue] = useState("");
  const [reclassifyingSaving, setReclassifyingSaving] = useState(false);

  type SupplierInvoice = { id: string; invoice_date: string; invoice_number: string | null; cuenta_pnl: string | null; concepto: string | null; total: number; restaurant: string };
  // Suppliers state
  const [suppliers, setSuppliers] = useState<Array<{ supplier: string; totalSpend: number; invoiceCount: number; invoices: SupplierInvoice[] }>>([]);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [supplierTags, setSupplierTags] = useState<Record<string, string>>({});
  const [editingSupplierTag, setEditingSupplierTag] = useState<string | null>(null);

  // Merge supplier state
  const [mergeFor, setMergeFor] = useState<string | null>(null);
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergeDropdownOpen, setMergeDropdownOpen] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Stats
  const [stats, setStats] = useState({ total: 0, invoiceCount: 0, supplierCount: 0 });

  const [loading, setLoading] = useState(false);

  // Period presets + supplier search + supplier sort
  const [activePreset, setActivePreset] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierSortMode, setSupplierSortMode] = useState<"spend" | "count" | "alpha">("alpha");

  // Invoice search + sort
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceSortMode, setInvoiceSortMode] = useState<"recent" | "date" | "alpha">("date");

  function applyPreset(preset: string) {
    const { from, to } = getPresetRange(preset);
    setDateFrom(from);
    setDateTo(to);
    setActivePreset(preset);
    setInvPage(1);
  }

  function buildParams(extra: Record<string, string> = {}) {
    const p = new URLSearchParams({ view, ...(restaurant && { restaurant }), ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }), ...extra });
    return p.toString();
  }

  async function fetchStats() {
    const res = await fetch(`/api/gastos?${new URLSearchParams({ view: "analytics", ...(restaurant && { restaurant }), ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) })}`);
    if (res.ok) {
      const data = await res.json();
      setStats({ total: data.kpis?.totalSpend ?? 0, invoiceCount: data.kpis?.invoiceCount ?? 0, supplierCount: data.kpis?.uniqueSuppliers ?? 0 });
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

  async function fetchSuppliers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/gastos?${buildParams({ sortDir: "desc" })}`);
      const d = await res.json();
      setSuppliers(d.suppliers ?? []);
    } finally { setLoading(false); }
  }

  async function handleMerge() {
    if (!mergeFor || !mergeTarget) return;
    setMerging(true);
    setMergeError("");
    try {
      const res = await fetch("/api/compras/suppliers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: mergeFor, into: mergeTarget }),
      });
      if (!res.ok) { setMergeError("Error al fusionar"); return; }
      setSupplierTags((prev) => {
        const next = { ...prev };
        if (next[mergeFor] && !next[mergeTarget]) next[mergeTarget] = next[mergeFor];
        delete next[mergeFor];
        return next;
      });
      setMergeFor(null);
      fetchSuppliers();
    } catch { setMergeError("Error de conexión"); }
    finally { setMerging(false); }
  }

  useEffect(() => {
    document.title = "Gastos Operativos — Aventura Gourmet";
    fetchStats();
  }, [restaurant, dateFrom, dateTo]);

  useEffect(() => {
    if (view === "suppliers") {
      fetch("/api/compras/suppliers/tags")
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => setSupplierTags(d ?? {}))
        .catch(() => {});
    }
  }, [view]);

  useEffect(() => {
    setLoading(true);
    if (view === "invoices") {
      fetch(`/api/gastos?${buildParams({ page: String(invPage), pageSize: String(invPageSize) })}`)
        .then((r) => r.json())
        .then((d) => { setInvoices(d.invoices ?? []); setInvTotal(d.pagination?.total ?? 0); })
        .finally(() => setLoading(false));
    } else if (view === "suppliers") {
      fetch(`/api/gastos?${buildParams({ sortDir: "desc" })}`)
        .then((r) => r.json())
        .then((d) => setSuppliers(d.suppliers ?? []))
        .finally(() => setLoading(false));
    } else if (view === "analytics") {
      fetch(`/api/gastos?${buildParams()}`)
        .then((r) => r.json())
        .then((d) => setAnalytics(d))
        .finally(() => setLoading(false));
    }
  }, [view, restaurant, dateFrom, dateTo, invPage]);

  const invTotalPages = Math.ceil(invTotal / invPageSize);
  const hasFilters = !!(restaurant || dateFrom || dateTo);

  return (
    <Shell>
      <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>Gastos Operativos</h1>
          {view === "invoices" && (
            <ExportButton
              href="/api/compras/export"
              params={{
                type: "invoices",
                ...(restaurant && { restaurant }),
                ...(dateFrom && { dateFrom }),
                ...(dateTo && { dateTo }),
              }}
            />
          )}
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "gasto operativo", value: fmt(stats.total), highlight: true },
            { label: "facturas", value: String(stats.invoiceCount) },
            { label: "proveedores", value: String(stats.supplierCount) },
          ].map((s, i) => (
            <div key={i} className="px-3 py-2.5 rounded-[var(--radius)] border text-sm flex flex-col gap-0.5"
              style={{
                background: i === 0 ? "var(--blue-glow)" : "var(--surface)",
                borderColor: i === 0 ? "color-mix(in srgb, var(--blue) 25%, transparent)" : "var(--border)",
              }}>
              <span className={i === 0 ? "text-base sm:text-xl font-bold leading-tight" : "font-semibold leading-tight"} style={{ color: i === 0 ? "var(--blue)" : "var(--text)" }}>
                {s.value}
              </span>
              <span className="text-[10px] leading-tight" style={{ color: "var(--text-dim)" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Tab nav + filters ── */}
        <div className="flex flex-col mb-5 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex gap-1 overflow-x-auto">
            {(["invoices", "suppliers", "analytics"] as ViewMode[]).map((v) => {
              const labels: Record<ViewMode, string> = { invoices: "Facturas", suppliers: "Proveedores", analytics: "Análisis" };
              return (
                <button key={v} onClick={() => setView(v)}
                  className="px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150"
                  style={{
                    borderColor: view === v ? "var(--blue)" : "transparent",
                    color: view === v ? "var(--blue)" : "var(--text-muted)",
                  }}>
                  {labels[v]}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 py-2">
            {/* Row 1: Period presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: "thisMonth", label: "Este mes" },
                { key: "lastMonth", label: "Mes pasado" },
                { key: "last30", label: "Últ. 30d" },
                { key: "ytd", label: "YTD" },
              ].map(({ key, label }) => (
                <button key={key} type="button" onClick={() => applyPreset(key)}
                  className="text-xs px-2 py-1.5 rounded border transition-colors duration-150"
                  style={{
                    background: activePreset === key ? "var(--blue)" : "var(--surface)",
                    color: activePreset === key ? "#fff" : "var(--text-muted)",
                    borderColor: activePreset === key ? "var(--blue)" : "var(--border)",
                  }}>
                  {label}
                </button>
              ))}
            </div>
            {/* Row 2: Restaurant + dates + clear */}
            <div className="flex items-center gap-2">
              <select value={restaurant} onChange={(e) => setRestaurant(e.target.value)}
                className="flex-1 text-xs px-2 py-1.5 rounded border appearance-none min-w-0"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}>
                <option value="">Todos los restaurantes</option>
                {Object.entries(RESTAURANT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="date" value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setActivePreset(""); }}
                className="flex-1 text-xs px-2 py-1.5 rounded border min-w-0"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
              <input type="date" value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setActivePreset(""); }}
                className="flex-1 text-xs px-2 py-1.5 rounded border min-w-0"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
              {hasFilters && (
                <button onClick={() => { setRestaurant(""); setDateFrom(""); setDateTo(""); setActivePreset(""); }}
                  className="flex-shrink-0 text-xs px-2 py-1.5 rounded border"
                  style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="mb-4">
            <FilterChips
              chips={[
                ...(restaurant ? [{ label: RESTAURANT_LABELS[restaurant as Restaurant] ?? restaurant, onRemove: () => setRestaurant("") }] : []),
                ...(activePreset ? [{ label: activePreset === "thisMonth" ? "Este mes" : activePreset === "lastMonth" ? "Mes pasado" : activePreset === "last30" ? "Últ. 30d" : "YTD", onRemove: () => { setActivePreset(""); setDateFrom(""); setDateTo(""); } }] : []),
                ...(!activePreset && dateFrom ? [{ label: `Desde ${dateFrom}`, onRemove: () => setDateFrom("") }] : []),
                ...(!activePreset && dateTo ? [{ label: `Hasta ${dateTo}`, onRemove: () => setDateTo("") }] : []),
              ]}
              onClearAll={() => { setRestaurant(""); setDateFrom(""); setDateTo(""); setActivePreset(""); }}
            />
          </div>
        )}

        {loading && (view === "analytics" ? <SkeletonAnalytics /> : <SkeletonTable rows={6} />)}

        {/* ── Facturas tab ── */}
        {!loading && view === "invoices" && (() => {
          if (invoices.length === 0) return (
            <div className="text-center py-16 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
                style={{ background: "var(--surface-raised)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: "var(--text-dim)" }}>
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No hay gastos operativos para este período.</p>
              <a href="/upload"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98]"
                style={{ background: "var(--blue)" }}>
                Subir facturas
              </a>
            </div>
          );
          const q = invoiceSearch.trim().toLowerCase();
          const sortedInvoices = invoices
            .filter((inv) => !q || inv.supplier.toLowerCase().includes(q) || (inv.invoice_number ?? "").toLowerCase().includes(q))
            .slice()
            .sort((a, b) => {
              if (invoiceSortMode === "recent") return (b.id ?? "").localeCompare(a.id ?? "");
              if (invoiceSortMode === "alpha") return a.supplier.localeCompare(b.supplier, "es");
              return (b.invoice_date ?? "").localeCompare(a.invoice_date ?? "");
            });
          // Group invoices by cuenta_pnl
          const groups: Record<string, DbInvoice[]> = {};
          for (const inv of sortedInvoices) {
            const key = inv.cuenta_pnl ?? "Sin categoría";
            if (!groups[key]) groups[key] = [];
            groups[key].push(inv);
          }
          const groupKeys = Object.keys(groups).sort();
          return (
            <div className="space-y-2">
              {/* Search + sort bar */}
              <div className="flex flex-col gap-2 mb-2">
                <div className="relative w-full">
                  <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: "var(--text-muted)" }}>
                    <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    placeholder="Buscar factura..."
                    className="w-full pl-8 pr-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--surface)", borderColor: invoiceSearch ? "var(--blue)" : "var(--border)", color: "var(--text)" }}
                  />
                  {invoiceSearch && (
                    <button type="button" onClick={() => setInvoiceSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                      style={{ color: "var(--text-muted)" }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 p-0.5 rounded-[var(--radius-sm)]" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}>
                    {([["recent", "Recientes"], ["date", "Por fecha"], ["alpha", "A–Z"]] as [typeof invoiceSortMode, string][]).map(([mode, label]) => (
                      <button key={mode} type="button"
                        className="text-[11px] px-2.5 py-1 rounded transition-colors"
                        style={{
                          background: invoiceSortMode === mode ? "var(--surface)" : "transparent",
                          color: invoiceSortMode === mode ? "var(--text)" : "var(--text-muted)",
                          fontWeight: invoiceSortMode === mode ? 600 : 400,
                          boxShadow: invoiceSortMode === mode ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                        }}
                        onClick={() => setInvoiceSortMode(mode)}>
                        {label}
                      </button>
                    ))}
                  </div>
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
                    className="ml-auto px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors"
                    style={{ background: invoiceSelectMode ? "var(--surface)" : "var(--blue-glow)", color: invoiceSelectMode ? "var(--text-muted)" : "var(--blue)", border: "1px solid", borderColor: invoiceSelectMode ? "var(--border)" : "color-mix(in srgb, var(--blue) 25%, transparent)" }}
                    onClick={() => { setInvoiceSelectMode((m) => !m); setSelectedInvoiceIds(new Set()); }}
                  >
                    {invoiceSelectMode ? "Cancelar" : "Seleccionar"}
                    {invoiceSelectMode && selectedInvoiceIds.size > 0 && (
                      <span className="ml-1">({selectedInvoiceIds.size})</span>
                    )}
                  </button>
                </div>
              </div>

              {groupKeys.map((groupKey) => (
                <div key={groupKey} className="space-y-2">
                  <div className="flex items-center justify-between pt-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>{groupKey}</h3>
                    <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                      {fmt(groups[groupKey].reduce((s, i) => s + i.total, 0))}
                    </span>
                  </div>
                  {groups[groupKey].map((inv) => {
                    const isExpanded = expandedInvoices.has(inv.id);
                    const isSelected = selectedInvoiceIds.has(inv.id);
                    return (
                      <div key={inv.id} className="rounded-[var(--radius)] border overflow-hidden"
                        style={{ borderColor: isSelected ? "var(--blue)" : "var(--border)", background: "var(--surface)" }}>
                        <div className="flex items-center">
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
                            {invoiceSelectMode && (
                              <div className="w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer"
                                style={{ borderColor: isSelected ? "var(--blue)" : "var(--border)", background: isSelected ? "var(--blue)" : "transparent" }}>
                                {isSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                            )}
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
                              {/* Line 1: supplier + price */}
                              <div className="flex items-center justify-between gap-2 overflow-hidden">
                                <span className="text-sm font-medium truncate flex-1 min-w-0" style={{ color: "var(--text)" }}>{inv.supplier}</span>
                                <span className="font-bold text-sm flex-shrink-0" style={{ color: "var(--blue)" }}>{fmt(inv.total)}</span>
                              </div>
                              {/* Line 2: invoice# · date · items */}
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                                {inv.invoice_number && <span className="font-mono">#{inv.invoice_number}</span>}
                                {inv.invoice_number && <span style={{ opacity: 0.4 }}>·</span>}
                                <span>{fmtDate(inv.invoice_date)}</span>
                                <span style={{ opacity: 0.4 }}>·</span>
                                <span>{inv.lineItems.length} artículo{inv.lineItems.length !== 1 ? "s" : ""}</span>
                              </div>
                              {/* Line 3: restaurant tag */}
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}>
                                  {RESTAURANT_LABELS[inv.restaurant as Restaurant] ?? inv.restaurant}
                                </span>
                              </div>
                            </div>
                          </button>
                        </div>
                        {isExpanded && !invoiceSelectMode && (
                          <div className="border-t px-4 py-3 space-y-1.5" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)" }}>
                            {/* Reclassify cuentaPnl */}
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
                                <button type="button"
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
                              inv.lineItems.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                                  <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{item.description}</span>
                                  <span className="text-xs w-16 text-right" style={{ color: "var(--text-muted)" }}>
                                    {item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : "—"}
                                  </span>
                                  <span className="font-medium w-24 text-right" style={{ color: "var(--blue)" }}>{fmt(item.total)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })()}
        {!loading && view === "invoices" && invTotalPages > 1 && (
          <div className="flex items-center justify-between pt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            <span>Página {invPage} de {invTotalPages} ({invTotal} resultados)</span>
            <div className="flex gap-2">
              <button onClick={() => setInvPage((p) => Math.max(1, p - 1))} disabled={invPage === 1}
                className="px-3 py-1.5 rounded border text-xs disabled:opacity-40"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>Anterior</button>
              <button onClick={() => setInvPage((p) => Math.min(invTotalPages, p + 1))} disabled={invPage === invTotalPages}
                className="px-3 py-1.5 rounded border text-xs disabled:opacity-40"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>Siguiente</button>
            </div>
          </div>
        )}

        {/* ── Proveedores tab ── */}
        {!loading && view === "suppliers" && (() => {
          const q = supplierSearch.trim().toLowerCase();
          const grandTotal = suppliers.reduce((s, g) => s + g.totalSpend, 0);
          const filtered = suppliers
            .filter((g) => !q || g.supplier.toLowerCase().includes(q))
            .slice()
            .sort((a, b) => {
              if (supplierSortMode === "count") return b.invoiceCount - a.invoiceCount;
              if (supplierSortMode === "alpha") return a.supplier.localeCompare(b.supplier, "es");
              return b.totalSpend - a.totalSpend;
            });

          return (
            <div className="space-y-4">
              {/* Controls row */}
              <div className="flex flex-col gap-2">
                {/* Search */}
                <div className="relative w-full">
                  <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: "var(--text-muted)" }}>
                    <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    placeholder="Buscar proveedor..."
                    className="w-full pl-8 pr-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
                    style={{ background: "var(--surface)", borderColor: supplierSearch ? "var(--blue)" : "var(--border)", color: "var(--text)" }}
                  />
                  {supplierSearch && (
                    <button type="button" onClick={() => setSupplierSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                      style={{ color: "var(--text-muted)" }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
                {/* Sort pills */}
                <div className="flex items-center gap-1 p-0.5 rounded-[var(--radius-sm)]" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}>
                  {([["spend", "Mayor gasto"], ["count", "Más facturas"], ["alpha", "A–Z"]] as [typeof supplierSortMode, string][]).map(([mode, label]) => (
                    <button key={mode} type="button"
                      className="text-[11px] px-2.5 py-1 rounded transition-colors"
                      style={{
                        background: supplierSortMode === mode ? "var(--surface)" : "transparent",
                        color: supplierSortMode === mode ? "var(--text)" : "var(--text-muted)",
                        fontWeight: supplierSortMode === mode ? 600 : 400,
                        boxShadow: supplierSortMode === mode ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                      }}
                      onClick={() => setSupplierSortMode(mode)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary strip */}
              {filtered.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-[var(--radius-sm)]"
                  style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{filtered.length}</span> proveedor{filtered.length !== 1 ? "es" : ""}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--blue)" }}>
                    {fmt(filtered.reduce((s, g) => s + g.totalSpend, 0))} total
                  </span>
                </div>
              )}

              {/* Empty state */}
              {filtered.length === 0 && (
                <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
                  {supplierSearch ? `Sin resultados para "${supplierSearch}"` : "No hay proveedores para este período."}
                </p>
              )}

              {/* Two independent columns — expanding one never shifts the other */}
              {(() => {
                const renderCard = (group: typeof filtered[0]) => {
                  const isExpanded = expandedSuppliers.has(group.supplier);
                  const currentTag = supplierTags[group.supplier] ?? "";
                  const isEditingTag = editingSupplierTag === group.supplier;
                  const sortedDates = group.invoices.map((i: { invoice_date: string }) => i.invoice_date).sort();
                  const firstDate = sortedDates[0];
                  const lastDate = sortedDates[sortedDates.length - 1];
                  return (
                    <div key={group.supplier}
                      className="rounded-[var(--radius)] border overflow-hidden"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span className="text-base font-semibold leading-tight truncate" style={{ color: "var(--text)" }} title={group.supplier}>
                            {group.supplier}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Merge icon button */}
                            <button
                              type="button"
                              title="Fusionar con otro proveedor"
                              className="p-1 rounded transition-colors cursor-pointer"
                              style={{ color: "var(--text-dim)", background: "transparent" }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-raised)"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                              onClick={() => {
                                setMergeFor(group.supplier);
                                setMergeQuery("");
                                setMergeTarget("");
                                setMergeDropdownOpen(false);
                                setMergeError("");
                              }}
                            >
                              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                <path d="M1 3h4l2 3.5L9 3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M6.5 6.5V12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                              </svg>
                            </button>
                            {/* Classify tag */}
                            {isEditingTag ? (
                              <select
                                autoFocus
                                value={currentTag}
                                className="px-2 py-0.5 rounded-[var(--radius-sm)] border text-[11px] appearance-none focus:outline-none focus:ring-1"
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
                                className="text-[10px] px-2 py-0.5 rounded-full transition-colors cursor-pointer"
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
                        <p className="text-lg font-bold mb-1"
                          style={{ fontFamily: "var(--font-display)", color: "var(--blue)", letterSpacing: "-0.02em" }}>
                          {fmt(group.totalSpend)}
                        </p>
                        <div className="flex items-center gap-2.5 mb-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          <span>{group.invoiceCount} factura{group.invoiceCount !== 1 ? "s" : ""}</span>
                          {firstDate && (
                            <>
                              <span style={{ color: "var(--border)" }}>·</span>
                              <span>{firstDate === lastDate ? fmtDate(firstDate) : `${fmtDate(firstDate)} – ${fmtDate(lastDate)}`}</span>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
                          style={{ color: isExpanded ? "var(--blue)" : "var(--text-dim)" }}
                          onClick={() => setExpandedSuppliers((prev) => {
                            const next = new Set(prev);
                            isExpanded ? next.delete(group.supplier) : next.add(group.supplier);
                            return next;
                          })}
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"
                            className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                            <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Ver facturas
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateRows: isExpanded ? "1fr" : "0fr", transition: "grid-template-rows 0.25s ease" }}>
                        <div style={{ overflow: "hidden", minHeight: 0 }}>
                          <div className="border-t px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)" }}>
                            {group.invoices.map((inv: { id: string; invoice_number: string | null; invoice_date: string; cuenta_pnl: string | null; total: number }) => (
                              <div key={inv.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0 text-xs"
                                style={{ borderColor: "var(--border-subtle)" }}>
                                <span className="flex-1 truncate" style={{ color: "var(--text)" }}>
                                  {inv.invoice_number ? `#${inv.invoice_number}` : "Sin número"}
                                </span>
                                <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>{fmtDate(inv.invoice_date)}</span>
                                {inv.cuenta_pnl && (
                                  <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded"
                                    style={{ background: "color-mix(in srgb, var(--pink-dark) 15%, transparent)", color: "var(--pink-dark)" }}>
                                    {inv.cuenta_pnl}
                                  </span>
                                )}
                                <span className="flex-shrink-0 font-semibold" style={{ color: "var(--blue)" }}>{fmt(inv.total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                };
                return (
                  <>
                    {/* Desktop: two truly independent columns */}
                    <div className="hidden md:flex gap-3 items-start w-full">
                      <div className="flex-1 min-w-0 flex flex-col gap-3">
                        {filtered.filter((_, i) => i % 2 === 0).map(renderCard)}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-3">
                        {filtered.filter((_, i) => i % 2 !== 0).map(renderCard)}
                      </div>
                    </div>
                    {/* Mobile: single column */}
                    <div className="flex flex-col gap-3 md:hidden">
                      {filtered.map(renderCard)}
                    </div>
                  </>
                );
              })()}
            </div>
          );
        })()}

        {/* ── Análisis tab ── */}
        {!loading && view === "analytics" && analytics && (
          <Suspense fallback={<SkeletonAnalytics />}>
            <GastosAnalytics analytics={analytics} />
          </Suspense>
        )}
      </div>

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
      {/* Merge supplier modal */}
      <Modal open={!!mergeFor} onClose={() => setMergeFor(null)} title={`Fusionar "${mergeFor}"`} maxWidth="max-w-sm">
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Elige el proveedor canónico. Todos los registros de <span className="font-medium" style={{ color: "var(--text)" }}>{mergeFor}</span> pasarán al proveedor seleccionado.
          </p>
          <div className="relative">
            <input
              type="text"
              value={mergeTarget || mergeQuery}
              placeholder="Buscar proveedor..."
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: mergeDropdownOpen ? "var(--blue)" : "var(--border)", color: "var(--text)" }}
              onFocus={() => { setMergeDropdownOpen(true); setMergeTarget(""); }}
              onChange={(e) => { setMergeQuery(e.target.value); setMergeTarget(""); setMergeDropdownOpen(true); }}
            />
            {mergeDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 rounded-[var(--radius-sm)] border overflow-y-auto"
                style={{ background: "var(--surface)", borderColor: "var(--border)", maxHeight: "180px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
                {suppliers
                  .map((g) => g.supplier)
                  .filter((s) => s !== mergeFor && (!mergeQuery || s.toLowerCase().includes(mergeQuery.toLowerCase())))
                  .map((name) => (
                    <button key={name} type="button"
                      className="w-full text-left px-3 py-2 text-sm transition-colors"
                      style={{ color: "var(--text)" }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setMergeTarget(name); setMergeQuery(""); setMergeDropdownOpen(false); }}>
                      {name}
                    </button>
                  ))}
              </div>
            )}
          </div>
          {mergeError && <p className="text-xs" style={{ color: "var(--danger)" }}>{mergeError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setMergeFor(null)}>Cancelar</Button>
            <Button size="sm" loading={merging} disabled={!mergeTarget} onClick={handleMerge}>Fusionar</Button>
          </div>
        </div>
      </Modal>
    </Shell>
  );
}
