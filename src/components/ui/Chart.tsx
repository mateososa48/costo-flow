"use client";

import React from "react";

type ChartTooltipPayload = {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  value?: unknown;
};

type ChartTooltipContentProps = {
  active?: boolean;
  label?: unknown;
  payload?: ChartTooltipPayload[];
  labelFormatter?: (label: unknown) => React.ReactNode;
  nameFormatter?: (name: unknown, item: ChartTooltipPayload) => React.ReactNode;
  valueFormatter?: (value: unknown, item: ChartTooltipPayload) => React.ReactNode;
};

export function ChartFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "w-full overflow-hidden rounded-[var(--radius)]",
        "[&_.recharts-cartesian-axis-tick_text]:fill-[var(--text-muted)]",
        "[&_.recharts-cartesian-grid_line]:stroke-[var(--chart-grid)]",
        "[&_.recharts-layer]:outline-none",
        "[&_.recharts-sector]:outline-none",
        "[&_.recharts-surface]:overflow-visible",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function ChartTooltipContent({
  active,
  label,
  payload,
  labelFormatter,
  nameFormatter,
  valueFormatter,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="min-w-[150px] rounded-[10px] border px-3 py-2 shadow-[var(--shadow-elevated)] backdrop-blur-md"
      style={{ background: "var(--chart-tooltip-bg)", borderColor: "var(--chart-tooltip-border)" }}
    >
      {label != null && (
        <div className="mb-1.5 text-xs font-semibold" style={{ color: "var(--text)" }}>
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={`${String(item.dataKey ?? item.name ?? "value")}-${index}`} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color ?? "var(--chart-1)" }} />
              <span className="truncate" style={{ color: "var(--text-muted)" }}>
                {nameFormatter ? nameFormatter(item.name ?? item.dataKey, item) : String(item.name ?? item.dataKey ?? "Valor")}
              </span>
            </div>
            <span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>
              {valueFormatter ? valueFormatter(item.value, item) : String(item.value ?? "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
