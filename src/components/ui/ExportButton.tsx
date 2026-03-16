"use client";

import React, { useState } from "react";

interface ExportButtonProps {
  /** Base URL for the export endpoint, e.g. "/api/compras/export" */
  href: string;
  /** Query params to append */
  params?: Record<string, string>;
  /** Label text */
  label?: string;
}

export default function ExportButton({ href, params, label = "Exportar CSV" }: ExportButtonProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleClick() {
    setDownloading(true);
    try {
      const url = new URL(href, window.location.origin);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v) url.searchParams.set(k, v);
        }
      }
      const res = await fetch(url.toString());
      if (!res.ok) return;

      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      a.download = match?.[1] ?? "export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={downloading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] border text-xs font-medium transition-colors duration-150 disabled:opacity-50"
      style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {downloading ? "Descargando..." : label}
    </button>
  );
}
