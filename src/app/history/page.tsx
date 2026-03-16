"use client";

import React, { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { RESTAURANT_LABELS } from "@/types";
import type { Restaurant } from "@/types";

type AuditAction = "submitted" | "duplicate_bypassed" | "invoice_deleted" | "invoice_reclassified";

interface AuditEntry {
  id: string;
  action: AuditAction;
  user: string;
  restaurant: string;
  supplier: string;
  invoiceId: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  total: number;
  spreadsheetUrl?: string;
  details?: Record<string, string>;
  createdAt: string;
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

function actionLabel(action: AuditAction): string {
  switch (action) {
    case "submitted": return "Enviada";
    case "duplicate_bypassed": return "Enviada (duplicado)";
    case "invoice_deleted": return "Eliminada";
    case "invoice_reclassified": return "Reclasificada";
    default: return action;
  }
}

function actionColor(action: AuditAction): { bg: string; text: string; dot: string } {
  switch (action) {
    case "submitted":
    case "duplicate_bypassed":
      return { bg: "var(--blue-glow)", text: "var(--blue)", dot: "var(--blue)" };
    case "invoice_deleted":
      return { bg: "var(--danger-dim)", text: "var(--danger)", dot: "var(--danger)" };
    case "invoice_reclassified":
      return { bg: "color-mix(in srgb, var(--pink-dark) 12%, transparent)", text: "var(--pink-dark)", dot: "var(--pink-dark)" };
    default:
      return { bg: "var(--surface-raised)", text: "var(--text-muted)", dot: "var(--text-muted)" };
  }
}

type FilterMode = "all" | "submitted" | "invoice_deleted" | "invoice_reclassified";

export default function HistoryPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    document.title = "Historial — Aventura Gourmet";
    fetch("/api/audit-log")
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoaded(true));
  }, []);

  const filtered = entries.filter((e) => {
    // Action filter
    if (filter === "submitted" && e.action !== "submitted" && e.action !== "duplicate_bypassed") return false;
    if (filter !== "all" && filter !== "submitted" && e.action !== filter) return false;
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const match = e.supplier.toLowerCase().includes(q)
        || e.user?.toLowerCase().includes(q)
        || e.invoiceNumber?.toLowerCase().includes(q);
      if (!match) return false;
    }
    // Date range filter
    if (dateFrom) {
      const entryDate = (e.invoiceDate || e.createdAt).slice(0, 10);
      if (entryDate < dateFrom) return false;
    }
    if (dateTo) {
      const entryDate = (e.invoiceDate || e.createdAt).slice(0, 10);
      if (entryDate > dateTo) return false;
    }
    return true;
  });

  const hasActiveFilters = !!search || !!dateFrom || !!dateTo;

  const totalSubmitted = entries
    .filter((e) => e.action === "submitted" || e.action === "duplicate_bypassed")
    .reduce((s, e) => s + (e.total ?? 0), 0);

  const filterTabs: { key: FilterMode; label: string }[] = [
    { key: "all", label: "Todo" },
    { key: "submitted", label: "Enviadas" },
    { key: "invoice_deleted", label: "Eliminadas" },
    { key: "invoice_reclassified", label: "Reclasificadas" },
  ];

  return (
    <Shell>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-6">
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="font-display text-3xl md:text-4xl font-bold" style={{ color: "var(--text)" }}>
            Historial
          </h1>
          <p className="text-base mt-2" style={{ color: "var(--text-muted)" }}>
            Registro de actividad — facturas enviadas, eliminadas y reclasificadas
          </p>
        </div>

        {/* Filter tabs + search/date */}
        {loaded && entries.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
              {filterTabs.map(({ key, label }) => (
                <button key={key} onClick={() => setFilter(key)}
                  className="px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors duration-150"
                  style={{
                    borderColor: filter === key ? "var(--blue)" : "transparent",
                    color: filter === key ? "var(--blue)" : "var(--text-muted)",
                  }}>
                  {label}
                </button>
              ))}
            </div>
            {/* Search + date range */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar proveedor, usuario o # factura..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-[var(--radius-sm)] border text-sm transition-colors focus:outline-none focus:ring-2"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 rounded-[var(--radius-sm)] border text-sm"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                title="Desde"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 rounded-[var(--radius-sm)] border text-sm"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                title="Hasta"
              />
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
                  className="px-3 py-2 rounded-[var(--radius-sm)] text-xs font-medium transition-colors"
                  style={{ color: "var(--blue)", background: "var(--blue-glow)" }}
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        )}

        {!loaded ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="animate-fade-up text-center py-20 space-y-4">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
              style={{ background: "var(--surface-raised)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: "var(--text-dim)" }}>
                <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="font-medium" style={{ color: "var(--text)" }}>Sin actividad registrada</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Las facturas enviadas, eliminadas y reclasificadas aparecerán aquí
            </p>
            <a href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98]"
              style={{ background: "var(--blue)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Subir tu primera factura
            </a>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="animate-fade-up flex flex-wrap items-center gap-4 text-sm" style={{ color: "var(--text-muted)" }}>
              <span>{entries.length} acción{entries.length !== 1 ? "es" : ""} registrada{entries.length !== 1 ? "s" : ""}</span>
              <span className="w-px h-4" style={{ background: "var(--border)" }} />
              <span>
                Total enviado:{" "}
                <span className="font-semibold" style={{ color: "var(--blue)" }}>
                  {formatCurrency(totalSubmitted)}
                </span>
              </span>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
              <p className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>
                No hay entradas para este filtro.
              </p>
            ) : (
              <div className="animate-fade-up rounded-[var(--radius-lg)] border overflow-hidden"
                style={{ borderColor: "var(--border)" }}>
                {filtered.map((entry, i) => {
                  const colors = actionColor(entry.action);
                  return (
                    <div key={entry.id}
                      className="flex items-center gap-3 px-4 py-3.5"
                      style={{
                        background: "var(--surface)",
                        borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : undefined,
                      }}
                    >
                      {/* Dot */}
                      <div className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: colors.dot }} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                            {entry.supplier}
                          </span>
                          {/* Action badge */}
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: colors.bg, color: colors.text }}>
                            {actionLabel(entry.action)}
                          </span>
                          {/* Restaurant badge */}
                          <span className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}>
                            {RESTAURANT_LABELS[entry.restaurant as Restaurant] ?? entry.restaurant}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                          {entry.invoiceDate && <span>{formatDate(entry.invoiceDate)}</span>}
                          {entry.invoiceDate && <span>·</span>}
                          <span>{formatDate(entry.createdAt)} {formatTime(entry.createdAt)}</span>
                          {entry.user && <span>· {entry.user}</span>}
                          {entry.details && entry.action === "invoice_reclassified" && (
                            <>
                              <span>·</span>
                              <span>{entry.details.from} → {entry.details.to}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {entry.total > 0 && (
                          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                            {formatCurrency(entry.total)}
                          </span>
                        )}
                        {entry.spreadsheetUrl && (
                          <a href={entry.spreadsheetUrl} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-md transition-colors duration-150 hover-blue-bg"
                            style={{ color: "var(--text-muted)" }}
                            title="Ver hoja de cálculo"
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M2.5 7H11.5M7.5 3L11.5 7L7.5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
