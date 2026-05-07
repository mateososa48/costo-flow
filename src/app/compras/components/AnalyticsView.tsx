"use client";

import React from "react";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { SkeletonAnalytics } from "@/components/ui/Skeleton";
import { AnalyticsData, formatCurrency, restaurantLabel } from "../types";

interface AnalyticsViewProps {
  analyticsData: AnalyticsData | null;
  analyticsLoading: boolean;
}

export default function AnalyticsView({
  analyticsData,
  analyticsLoading,
}: AnalyticsViewProps) {
  return (
    <div className="space-y-4">
      {!analyticsLoading && (
        <div className="rounded-[var(--radius)] border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Inteligencia de costos</p>
          <a href="/analytics" className="text-sm font-semibold" style={{ color: "var(--blue)" }}>
            Abrir Inteligencia
          </a>
        </div>
      )}

      {analyticsLoading && <SkeletonAnalytics />}

      {!analyticsLoading && analyticsData && (() => {
        const d = analyticsData;
        const maxCat = d.categoryBreakdown[0]?.value ?? 1;
        const maxSup = d.spendBySupplier[0]?.total ?? 1;
        const maxItem = d.topItems[0]?.totalSpend ?? 1;

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
            {/* KPI Band */}
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
                { label: "Promedio/factura", value: formatCurrency(d.kpis.avgPerInvoice) },
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

            {/* Trend Chart */}
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

            {/* Category + Supplier Row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Category breakdown */}
              <div className="md:col-span-3 rounded-[var(--radius)] border p-4 overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
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
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs truncate pr-2 flex-1 min-w-0" style={{ color: "var(--text)" }}>{c.name}</span>
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

              {/* Top Suppliers */}
              <div className="md:col-span-2 rounded-[var(--radius)] border p-4 overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
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
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs truncate pr-2 flex-1 min-w-0" title={s.supplier} style={{ color: "var(--text)" }}>{s.supplier}</span>
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

            {/* Top Ingredients */}
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
                        <div className="flex items-center gap-2 flex-shrink-0" style={{ minWidth: "80px", maxWidth: "140px", flex: "0 1 140px" }}>
                          <div className="flex-1 h-1 rounded-full hidden sm:block" style={{ background: "var(--border)" }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${barWidth}%`, background: "var(--pink-dark)", opacity: 0.75 }} />
                          </div>
                          <span className="text-xs font-semibold tabular-nums flex-shrink-0"
                            style={{ color: "var(--text)" }}>
                            {formatCurrency(item.totalSpend)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Restaurant split (if multiple) */}
            {d.spendByRestaurant.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
            style={{ background: "var(--surface-raised)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: "var(--text-dim)" }}>
              <path d="M18 20V10M12 20V4M6 20v-6" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Los análisis se generarán cuando tengas facturas registradas.
          </p>
        </div>
      )}
    </div>
  );
}
