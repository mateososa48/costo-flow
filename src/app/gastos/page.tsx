"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import Shell from "@/components/Shell";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { RESTAURANT_LABELS } from "@/types";
import type { Restaurant } from "@/types";
import dropdownOptions from "../../../data/dropdown_options.json";

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

const PINK_SHADES = [
  "#C97F7E", "#D99998", "#B36564", "#E8B3B2",
  "#9D4F4E", "#F2CDCC", "#874040", "#DEBDBC",
  "#A06160", "#F7E4E4",
];

const BLUE_SHADES = [
  "#0450A9", "#2E6EC4", "#5589D4", "#7AA5E0",
  "#9DC0EC", "#C0D9F5", "#033D82", "#1A5DB8",
  "#3A7FCC", "#042F6B",
];

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

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Stats
  const [stats, setStats] = useState({ total: 0, invoiceCount: 0, supplierCount: 0 });

  const [loading, setLoading] = useState(false);

  // Period presets + supplier search + supplier sort
  const [activePreset, setActivePreset] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierSortMode, setSupplierSortMode] = useState<"spend" | "count" | "alpha">("alpha");

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
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "gasto operativo", value: fmt(stats.total), highlight: true },
            { label: "facturas", value: String(stats.invoiceCount) },
            { label: "proveedores", value: String(stats.supplierCount) },
          ].map((s, i) => (
            <div key={i} className="px-4 py-3 rounded-[var(--radius)] border text-sm"
              style={{
                background: i === 0 ? "var(--blue-glow)" : "var(--surface)",
                borderColor: i === 0 ? "color-mix(in srgb, var(--blue) 25%, transparent)" : "var(--border)",
              }}>
              <span className={i === 0 ? "text-xl font-bold" : "font-semibold"} style={{ color: i === 0 ? "var(--blue)" : "var(--text)" }}>
                {s.value}
              </span>
              <span className="ml-2 text-xs" style={{ color: "var(--text-dim)" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Tab nav + filters ── */}
        <div className="flex items-center justify-between gap-4 mb-5 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex gap-1">
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
          <div className="flex flex-wrap items-center gap-1.5 pb-2">
            {/* Period presets */}
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
            <span className="w-px h-4 mx-0.5" style={{ background: "var(--border)" }} />
            <select value={restaurant} onChange={(e) => setRestaurant(e.target.value)}
              className="text-xs px-2 py-1.5 rounded border appearance-none"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}>
              <option value="">Todos los restaurantes</option>
              {Object.entries(RESTAURANT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="date" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setActivePreset(""); }}
              className="text-xs px-2 py-1.5 rounded border"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
            <input type="date" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setActivePreset(""); }}
              className="text-xs px-2 py-1.5 rounded border"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
            {hasFilters && (
              <button onClick={() => { setRestaurant(""); setDateFrom(""); setDateTo(""); setActivePreset(""); }}
                className="text-xs px-2 py-1.5 rounded border"
                style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
                Limpiar
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
          </div>
        )}

        {/* ── Facturas tab ── */}
        {!loading && view === "invoices" && (() => {
          if (invoices.length === 0) return (
            <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>No hay gastos operativos para este período.</p>
          );
          // Group invoices by cuenta_pnl
          const groups: Record<string, DbInvoice[]> = {};
          for (const inv of invoices) {
            const key = inv.cuenta_pnl ?? "Sin categoría";
            if (!groups[key]) groups[key] = [];
            groups[key].push(inv);
          }
          const groupKeys = Object.keys(groups).sort();
          return (
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{inv.supplier}</span>
                                {inv.invoice_number && (
                                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>#{inv.invoice_number}</span>
                                )}
                                <span className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}>
                                  {RESTAURANT_LABELS[inv.restaurant as Restaurant] ?? inv.restaurant}
                                </span>
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                                {fmtDate(inv.invoice_date)} · {inv.lineItems.length} artículo{inv.lineItems.length !== 1 ? "s" : ""}
                              </div>
                            </div>
                            <span className="font-bold text-sm flex-shrink-0" style={{ color: "var(--blue)" }}>{fmt(inv.total)}</span>
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
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
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
                          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Gasto Operativo", value: fmt(analytics.kpis.totalSpend) },
                { label: "Facturas", value: String(analytics.kpis.invoiceCount) },
                { label: "Proveedores", value: String(analytics.kpis.uniqueSuppliers) },
              ].map((k, i) => (
                <div key={i} className="rounded-[var(--radius)] border px-5 py-4"
                  style={{
                    background: i === 0 ? "var(--blue-glow)" : "var(--surface)",
                    borderColor: i === 0 ? "color-mix(in srgb, var(--blue) 25%, transparent)" : "var(--border)",
                  }}>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-dim)" }}>{k.label}</p>
                  <p className={i === 0 ? "text-2xl font-bold" : "text-xl font-semibold"} style={{ color: i === 0 ? "var(--blue)" : "var(--text)" }}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Monthly by category */}
            {analytics.monthlySpend.length > 0 && (
              <div className="rounded-[var(--radius)] border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>Gasto mensual por tipo</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={analytics.monthlySpend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={55} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {analytics.cuentas.map((c, i) => (
                      <Bar key={c} dataKey={c} stackId="a" fill={PINK_SHADES[i % PINK_SHADES.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Breakdown donut + top suppliers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics.breakdown.length > 0 && (
                <div className="rounded-[var(--radius)] border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>Por cuenta P&L</h3>
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie data={analytics.breakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                          {analytics.breakdown.map((_, i) => <Cell key={i} fill={PINK_SHADES[i % PINK_SHADES.length]} />)}
                        </Pie>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {analytics.breakdown.map((item, i) => (
                        <div key={item.name} className="flex items-center justify-between text-xs gap-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PINK_SHADES[i % PINK_SHADES.length] }} />
                            <span className="truncate" style={{ color: "var(--text)" }}>{item.name}</span>
                          </div>
                          <span className="font-medium flex-shrink-0" style={{ color: "var(--text-muted)" }}>{fmt(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {analytics.topSuppliers.length > 0 && (
                <div className="rounded-[var(--radius)] border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>Top proveedores</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={analytics.topSuppliers} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="supplier" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={120} />
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12 }} />
                      <Bar dataKey="total" fill="#0450A9" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
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
    </Shell>
  );
}
