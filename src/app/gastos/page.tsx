"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import Shell from "@/components/Shell";
import { RESTAURANT_LABELS } from "@/types";
import type { Restaurant } from "@/types";

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
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [invPage, setInvPage] = useState(1);
  const [invTotal, setInvTotal] = useState(0);
  const invPageSize = 50;

  // Suppliers state
  const [suppliers, setSuppliers] = useState<Array<{ supplier: string; totalSpend: number; invoiceCount: number }>>([]);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Stats
  const [stats, setStats] = useState({ total: 0, invoiceCount: 0, supplierCount: 0 });

  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    document.title = "Gastos — Aventura Gourmet";
    fetchStats();
  }, [restaurant, dateFrom, dateTo]);

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
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>Gastos</h1>
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
          <div className="flex items-center gap-2 pb-2">
            <select value={restaurant} onChange={(e) => setRestaurant(e.target.value)}
              className="text-xs px-2 py-1.5 rounded border appearance-none"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}>
              <option value="">Todos los restaurantes</option>
              {Object.entries(RESTAURANT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs px-2 py-1.5 rounded border"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="text-xs px-2 py-1.5 rounded border"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
            {hasFilters && (
              <button onClick={() => { setRestaurant(""); setDateFrom(""); setDateTo(""); }}
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
        {!loading && view === "invoices" && (
          <div className="space-y-2">
            {invoices.length === 0 && (
              <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>No hay gastos operativos para este período.</p>
            )}
            {invoices.map((inv) => {
              const open = expandedInvoice === inv.id;
              return (
                <div key={inv.id} className="rounded-[var(--radius)] border overflow-hidden"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    onClick={() => setExpandedInvoice(open ? null : inv.id)}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
                      className="flex-shrink-0 transition-transform duration-150"
                      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", color: "var(--text-muted)" }}>
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm uppercase" style={{ color: "var(--text)" }}>{inv.supplier}</span>
                        {inv.invoice_number && (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>#{inv.invoice_number}</span>
                        )}
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}>
                          {RESTAURANT_LABELS[inv.restaurant as Restaurant] ?? inv.restaurant}
                        </span>
                        {inv.cuenta_pnl && (
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: "color-mix(in srgb, var(--pink-dark) 15%, transparent)", color: "var(--pink-dark)" }}>
                            {inv.cuenta_pnl}
                          </span>
                        )}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {fmtDate(inv.invoice_date)} · {inv.lineItems.length} artículo{inv.lineItems.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <span className="font-bold text-sm flex-shrink-0" style={{ color: "var(--blue)" }}>{fmt(inv.total)}</span>
                  </button>
                  {open && inv.lineItems.length > 0 && (
                    <div className="border-t" style={{ borderColor: "var(--border)" }}>
                      {inv.lineItems.map((item, idx) => (
                        <div key={idx} className="flex items-center px-10 py-2 text-sm gap-4 border-b last:border-b-0"
                          style={{ borderColor: "var(--border-subtle, var(--border))", background: "var(--surface-raised)" }}>
                          <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{item.description}</span>
                          <span className="text-xs w-16 text-right" style={{ color: "var(--text-muted)" }}>
                            {item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : "—"}
                          </span>
                          <span className="font-medium w-24 text-right" style={{ color: "var(--blue)" }}>{fmt(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {invTotalPages > 1 && (
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
          </div>
        )}

        {/* ── Proveedores tab ── */}
        {!loading && view === "suppliers" && (
          <div className="space-y-2">
            {suppliers.length === 0 && (
              <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>No hay proveedores para este período.</p>
            )}
            {suppliers.map((s) => (
              <div key={s.supplier} className="flex items-center justify-between px-4 py-3 rounded-[var(--radius)] border"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div>
                  <p className="font-semibold text-sm uppercase" style={{ color: "var(--text)" }}>{s.supplier}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.invoiceCount} factura{s.invoiceCount !== 1 ? "s" : ""}</p>
                </div>
                <span className="font-bold text-sm" style={{ color: "var(--blue)" }}>{fmt(s.totalSpend)}</span>
              </div>
            ))}
          </div>
        )}

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
    </Shell>
  );
}
