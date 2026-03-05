"use client";

import React, { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { RESTAURANT_LABELS } from "@/types";
import type { Restaurant } from "@/types";

interface HistoryEntry {
  supplier: string;
  restaurant: Restaurant;
  total: number;
  invoiceDate: string;
  submittedAt: string;
  spreadsheetUrl: string | null;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(val);
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    document.title = "Historial — Aventura Gourmet";
    try {
      const raw = localStorage.getItem("invoiceHistory");
      setHistory(raw ? (JSON.parse(raw) as HistoryEntry[]) : []);
    } catch { setHistory([]); }
    setLoaded(true);
  }, []);

  function clearHistory() {
    if (!confirm("¿Borrar todo el historial de facturas?")) return;
    localStorage.removeItem("invoiceHistory");
    setHistory([]);
  }

  const total = history.reduce((sum, e) => sum + e.total, 0);

  return (
    <Shell>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-6">
        {/* Header */}
        <div className="animate-fade-up flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold"
              style={{ color: "var(--text)" }}>
              Historial
            </h1>
            <p className="text-base mt-2" style={{ color: "var(--text-muted)" }}>
              Facturas enviadas a Google Sheets
            </p>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="flex-shrink-0 mt-1 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium border transition-all duration-150"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--surface)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--danger)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--danger)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
            >
              Borrar historial
            </button>
          )}
        </div>

        {!loaded ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
          </div>
        ) : history.length === 0 ? (
          <div className="animate-fade-up text-center py-20 space-y-3">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
              style={{ background: "var(--surface-raised)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: "var(--text-dim)" }}>
                <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="font-medium" style={{ color: "var(--text)" }}>Sin facturas enviadas</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Las facturas que envíes a Google Sheets aparecerán aquí
            </p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="animate-fade-up flex items-center gap-4 text-sm" style={{ color: "var(--text-muted)" }}>
              <span>{history.length} factura{history.length !== 1 ? "s" : ""}</span>
              <span className="w-px h-4" style={{ background: "var(--border)" }} />
              <span>
                Total:{" "}
                <span className="font-semibold" style={{ color: "var(--blue)" }}>
                  {formatCurrency(total)}
                </span>
              </span>
            </div>

            {/* List */}
            <div className="animate-fade-up rounded-[var(--radius-lg)] border overflow-hidden"
              style={{ borderColor: "var(--border)" }}>
              {history.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3.5"
                  style={{
                    background: "var(--surface)",
                    borderBottom: i < history.length - 1 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  {/* Pink dot */}
                  <div className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: "var(--pink-dark)" }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                        {entry.supplier}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: "var(--pink-glow)", color: "var(--pink-dark)", fontSize: "10px", border: "1px solid rgba(201,127,126,0.25)" }}>
                        {RESTAURANT_LABELS[entry.restaurant] ?? entry.restaurant}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>{formatDate(entry.invoiceDate)}</span>
                      <span>·</span>
                      <span>Enviado {formatTime(entry.submittedAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      {formatCurrency(entry.total)}
                    </span>
                    {entry.spreadsheetUrl && (
                      <a
                        href={entry.spreadsheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md transition-colors duration-150"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--blue)"; (e.currentTarget as HTMLElement).style.background = "var(--blue-light)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.background = ""; }}
                        title="Ver hoja de cálculo"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 7H11.5M7.5 3L11.5 7L7.5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
