"use client";

import React from "react";

function SkeletonPulse({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: "var(--surface-raised)",
        borderRadius: "var(--radius-sm)",
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

export function SkeletonKPICards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-[var(--radius)] border p-4 space-y-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <SkeletonPulse style={{ width: "60%", height: 12 }} />
          <SkeletonPulse style={{ width: "80%", height: 28 }} />
          <SkeletonPulse style={{ width: "40%", height: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div
      className="rounded-[var(--radius)] border p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <SkeletonPulse style={{ width: "30%", height: 16, marginBottom: 24 }} />
      <div className="flex items-end gap-2" style={{ height: 200 }}>
        {[40, 65, 50, 80, 55, 70, 45, 75, 60, 85, 50, 65].map((h, i) => (
          <SkeletonPulse
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              borderRadius: "4px 4px 0 0",
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-sm)] border p-3 flex items-center gap-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <SkeletonPulse style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
          <div className="flex-1 space-y-2">
            <SkeletonPulse style={{ width: `${60 + (i * 7) % 30}%`, height: 12 }} />
            <SkeletonPulse style={{ width: `${30 + (i * 11) % 40}%`, height: 10 }} />
          </div>
          <SkeletonPulse style={{ width: 60, height: 14, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonAnalytics() {
  return (
    <div className="space-y-4">
      <SkeletonKPICards />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
}

export default SkeletonPulse;
