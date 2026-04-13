"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import type { SalesData } from "@/app/api/pos/sales/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} días`;
}

function getDefaultDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { dateFrom: iso(from), dateTo: iso(to) };
}

const PROVIDER_LABELS: Record<string, string> = {
  PARROT: "Salón",
  RAPPI: "Rappi",
  UBER_EATS: "Uber Eats",
  DIDI_FOOD: "Didi Food",
};

const PROVIDER_COLORS: Record<string, string> = {
  PARROT: "#0450A9",
  RAPPI: "#FF441A",
  UBER_EATS: "#06C167",
  DIDI_FOOD: "#FF6900",
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="flex-1 min-w-0 p-4 rounded-[var(--radius)] border"
      style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-xl font-bold font-display" style={{ color: "var(--text)" }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VentasView() {
  const { dateFrom: defaultFrom, dateTo: defaultTo } = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [sales, setSales] = useState<SalesData | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState("");

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0); // 0–100
  const [syncError, setSyncError] = useState("");

  // ── Fetch sales data ───────────────────────────────────────────────
  const fetchSales = useCallback(async (from: string, to: string) => {
    setSalesLoading(true);
    setSalesError("");
    try {
      const params = new URLSearchParams({ dateFrom: from, dateTo: to });
      const res = await fetch(`/api/pos/sales?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Error al cargar ventas");
      }
      setSales(await res.json());
    } catch (e) {
      setSalesError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSalesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSales(dateFrom, dateTo);
  }, [fetchSales, dateFrom, dateTo]);

  // ── Sync ───────────────────────────────────────────────────────────
  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncError("");
    setSyncProgress(0);

    // Build 7-day windows covering the last 30 days
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 30);

    const windows: Array<[string, string]> = [];
    let cur = new Date(start);
    while (cur < end) {
      const winEnd = new Date(cur);
      winEnd.setDate(cur.getDate() + 6);
      if (winEnd > end) winEnd.setTime(end.getTime());
      const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      windows.push([iso(cur), iso(winEnd)]);
      cur = new Date(winEnd);
      cur.setDate(cur.getDate() + 1);
    }

    let done = 0;
    for (const [s, e] of windows) {
      try {
        const res = await fetch("/api/pos/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: s, endDate: e }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? "Error de sincronización");
        }
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : "Error de sincronización");
        setSyncing(false);
        return;
      }
      done++;
      setSyncProgress(Math.round((done / windows.length) * 100));
    }

    setSyncing(false);
    // Update date range to last 30 days and refetch
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const newFrom = iso(start);
    const newTo = iso(new Date());
    setDateFrom(newFrom);
    setDateTo(newTo);
    fetchSales(newFrom, newTo);
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={syncing}
          onClick={handleSync}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
          style={{ background: "var(--blue)" }}
        >
          {syncing ? (
            <>
              <span
                className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "rgba(255,255,255,0.5)", borderTopColor: "transparent" }}
              />
              Sincronizando…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M13 2v4h-4M1 12V8h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1.5 5a5.5 5.5 0 0110.2-1.5M12.5 9A5.5 5.5 0 012.3 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Sincronizar (últimos 30 días)
            </>
          )}
        </button>

        {/* Progress bar */}
        {syncing && (
          <div className="flex items-center gap-2">
            <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${syncProgress}%`, background: "var(--blue)" }}
              />
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{syncProgress}%</span>
          </div>
        )}

        {/* Last sync label */}
        {!syncing && sales?.lastSyncedAt && (
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
            Último sync: {relativeTime(sales.lastSyncedAt)}
          </span>
        )}

        {/* Date range picker */}
        <div className="flex items-center gap-1 ml-auto">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 rounded-[var(--radius-sm)] border text-xs"
            style={{ borderColor: "var(--border)", background: "var(--surface-raised)", color: "var(--text)" }}
          />
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 rounded-[var(--radius-sm)] border text-xs"
            style={{ borderColor: "var(--border)", background: "var(--surface-raised)", color: "var(--text)" }}
          />
        </div>
      </div>

      {/* Sync error */}
      {syncError && (
        <div className="p-3 rounded-[var(--radius-sm)] border text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-dim)" }}>
          {syncError}
        </div>
      )}

      {/* Loading */}
      {salesLoading && (
        <div className="flex items-center justify-center py-16">
          <div
            className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }}
          />
        </div>
      )}

      {/* Error */}
      {salesError && !salesLoading && (
        <div className="p-4 rounded-[var(--radius)] border text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-dim)" }}>
          {salesError}
        </div>
      )}

      {/* No data yet */}
      {!salesLoading && !salesError && sales && sales.totalOrders === 0 && (
        <div className="text-center py-16 space-y-3">
          <div
            className="w-12 h-12 mx-auto rounded-full flex items-center justify-center"
            style={{ background: "var(--surface-raised)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ color: "var(--text-dim)" }}>
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Sin datos de ventas para este período.
          </p>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            Haz clic en "Sincronizar" para importar datos de Parrot POS.
          </p>
        </div>
      )}

      {/* Content */}
      {!salesLoading && !salesError && sales && sales.totalOrders > 0 && (
        <>
          {/* KPI Row */}
          <div className="flex flex-wrap gap-3">
            <KpiCard label="Ventas totales" value={fmt(sales.totalRevenue)} />
            <KpiCard label="Órdenes" value={sales.totalOrders.toLocaleString("es-MX")} />
            <KpiCard
              label="Ticket promedio"
              value={fmt(sales.avgTicket)}
            />
            <KpiCard
              label="Costo de alimentos %"
              value="—"
              sub="Próximamente"
            />
          </div>

          {/* Daily Revenue Chart */}
          <div
            className="p-4 rounded-[var(--radius)] border"
            style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>
              Ventas diarias
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sales.dailyRevenue} barSize={12} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "var(--text-dim)" }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v + "T12:00:00");
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "var(--text-dim)" }}
                  tickFormatter={fmtShort}
                  width={48}
                />
                <Tooltip
                  formatter={(v) => [fmt(Number(v)), "Ventas"]}
                  labelFormatter={(l) => {
                    const d = new Date(String(l) + "T12:00:00");
                    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
                  }}
                  contentStyle={{
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 12,
                    color: "var(--text)",
                  }}
                />
                <Bar dataKey="total" radius={[3, 3, 0, 0]} fill="var(--blue)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Two-column: Top Items + Provider Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top artículos */}
            <div
              className="p-4 rounded-[var(--radius)] border"
              style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
            >
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
                Top artículos vendidos
              </h3>
              <div className="space-y-2">
                {sales.topItems.slice(0, 10).map((item) => (
                  <div key={item.item_name} className="flex items-center justify-between gap-2">
                    <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {item.item_name}
                    </span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs tabular-nums" style={{ color: "var(--text-dim)" }}>
                        ×{item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}
                      </span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                        {fmt(item.revenue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ventas por canal */}
            <div
              className="p-4 rounded-[var(--radius)] border"
              style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
            >
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
                Ventas por canal
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={sales.providerBreakdown}
                  barSize={28}
                  layout="vertical"
                  margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "var(--text-dim)" }}
                    tickFormatter={fmtShort}
                  />
                  <YAxis
                    type="category"
                    dataKey="provider"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    tickFormatter={(v: string) => PROVIDER_LABELS[v] ?? v}
                    width={64}
                  />
                  <Tooltip
                    formatter={(v, _name, entry) => [
                      `${fmt(Number(v))} · ${(entry.payload as { orders?: number })?.orders ?? 0} órdenes`,
                      "Ventas",
                    ]}
                    labelFormatter={(l) => PROVIDER_LABELS[String(l)] ?? String(l)}
                    contentStyle={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: 12,
                      color: "var(--text)",
                    }}
                  />
                  <Bar dataKey="total" radius={[0, 3, 3, 0]}>
                    {sales.providerBreakdown.map((entry) => (
                      <Cell
                        key={entry.provider}
                        fill={PROVIDER_COLORS[entry.provider] ?? "#7AA5E0"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cashier Sessions */}
          {sales.cashierSessions.length > 0 && (
            <div
              className="rounded-[var(--radius)] border overflow-hidden"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Sesiones de caja
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--surface)" }}>
                      <th className="px-4 py-2.5 text-left font-medium" style={{ color: "var(--text-dim)" }}>#</th>
                      <th className="px-4 py-2.5 text-left font-medium" style={{ color: "var(--text-dim)" }}>Inicio</th>
                      <th className="px-4 py-2.5 text-left font-medium" style={{ color: "var(--text-dim)" }}>Fin</th>
                      <th className="px-4 py-2.5 text-left font-medium" style={{ color: "var(--text-dim)" }}>Estado</th>
                      <th className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--text-dim)" }}>Total ventas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.cashierSessions.map((s) => (
                      <tr
                        key={s.uuid}
                        className="border-t"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                          {s.session_number ?? "—"}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                          {s.started_at
                            ? new Date(s.started_at).toLocaleString("es-MX", {
                                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                          {s.finished_at
                            ? new Date(s.finished_at).toLocaleString("es-MX", {
                                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              background: s.state === "CLOSED" ? "var(--surface)" : "var(--blue-glow)",
                              color: s.state === "CLOSED" ? "var(--text-dim)" : "var(--blue)",
                            }}
                          >
                            {s.state ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                          {s.total_sales != null ? fmt(s.total_sales) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
