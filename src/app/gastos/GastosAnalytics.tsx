"use client";

import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

type AnalyticsData = {
  kpis: { totalSpend: number; invoiceCount: number; uniqueSuppliers: number };
  monthlySpend: Array<Record<string, string | number>>;
  cuentas: string[];
  breakdown: Array<{ name: string; value: number }>;
  topSuppliers: Array<{ supplier: string; total: number }>;
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${months[parseInt(mo) - 1]} ${y.slice(2)}`;
}

export default function GastosAnalytics({ analytics }: { analytics: AnalyticsData }) {
  const totalSpend = analytics.kpis.totalSpend;
  const avgPerInvoice = analytics.kpis.invoiceCount > 0 ? totalSpend / analytics.kpis.invoiceCount : 0;
  const maxCat = analytics.breakdown[0]?.value ?? 1;
  const maxSup = analytics.topSuppliers[0]?.total ?? 1;

  const monthlyTotals = analytics.monthlySpend.map((row) => ({
    month: row.month as string,
    total: Object.entries(row).filter(([k]) => k !== "month").reduce((s, [, v]) => s + Number(v), 0),
  }));

  return (
    <div className="space-y-4">
      {/* KPI Band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-[var(--radius)] border p-4"
          style={{ borderColor: "color-mix(in srgb, var(--blue) 30%, transparent)", background: "var(--blue-glow)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--blue)" }}>
            Gasto Total
          </p>
          <p className="text-2xl font-bold leading-none"
            style={{ fontFamily: "var(--font-display)", color: "var(--blue)", letterSpacing: "-0.03em" }}>
            {fmt(totalSpend)}
          </p>
        </div>
        {[
          { label: "Facturas", value: analytics.kpis.invoiceCount.toLocaleString("es-MX") },
          { label: "Proveedores", value: analytics.kpis.uniqueSuppliers.toLocaleString("es-MX") },
          { label: "Promedio/factura", value: fmt(avgPerInvoice) },
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

      {/* Monthly Trend */}
      {monthlyTotals.length > 0 && (
        <div className="rounded-[var(--radius)] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-dim)" }}>Tendencia mensual</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyTotals} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGradOp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--blue)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                tickFormatter={(v: string) => fmtMonth(v)} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: unknown) => [fmt(Number(value)), "Gasto"]}
                labelFormatter={(label: unknown) => fmtMonth(String(label))}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: "var(--text)", fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="total" stroke="var(--blue)" strokeWidth={2} fill="url(#areaGradOp)"
                dot={{ fill: "var(--blue)", r: 3, strokeWidth: 0 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                activeDot={{ r: 5, strokeWidth: 0 } as any} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category + Supplier Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3 rounded-[var(--radius)] border p-4 overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-dim)" }}>Por categoría</p>
          {analytics.breakdown.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--text-dim)" }}>Sin datos</p>
          ) : (
            <div>
              {analytics.breakdown.slice(0, 10).map((c) => {
                const pct = totalSpend > 0 ? (c.value / totalSpend) * 100 : 0;
                const barWidth = (c.value / maxCat) * 100;
                return (
                  <div key={c.name} className="py-2 border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs truncate pr-2 flex-1 min-w-0" style={{ color: "var(--text)" }}>{c.name}</span>
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <span className="text-[10px] tabular-nums" style={{ color: "var(--text-dim)" }}>{pct.toFixed(1)}%</span>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text)" }}>{fmt(c.value)}</span>
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

        <div className="md:col-span-2 rounded-[var(--radius)] border p-4 overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-dim)" }}>Top proveedores</p>
          {analytics.topSuppliers.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--text-dim)" }}>Sin datos</p>
          ) : (
            <div>
              {analytics.topSuppliers.slice(0, 8).map((s) => {
                const barWidth = (s.total / maxSup) * 100;
                const pct = totalSpend > 0 ? (s.total / totalSpend) * 100 : 0;
                return (
                  <div key={s.supplier} className="py-2 border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs truncate pr-2 flex-1 min-w-0" title={s.supplier} style={{ color: "var(--text)" }}>{s.supplier}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] tabular-nums" style={{ color: "var(--text-dim)" }}>{pct.toFixed(1)}%</span>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text)" }}>{fmt(s.total)}</span>
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
    </div>
  );
}
