"use client";

import React, { useState, useCallback, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { DbInvoice, formatCurrency, formatDate, restaurantLabel } from "../types";
import dropdownOptions from "../../../../data/dropdown_options.json";

interface InvoicesViewProps {
  invoices: DbInvoice[];
  setInvoices: React.Dispatch<React.SetStateAction<DbInvoice[]>>;
  fetchStats: () => void;
  addModalOpen: boolean;
  setAddModalOpen: (open: boolean) => void;
  fetchData: () => void;
  restaurantOptions: Array<{ value: string; label: string }>;
}

type EditHistory = {
  id: string;
  edited_by: string;
  edited_at: string;
  changes: Record<string, { from: unknown; to: unknown }>;
};

const FIELD_LABELS: Record<string, string> = {
  concepto:   "Concepto",
  cuenta_pnl: "Cuenta P&L",
  importe:    "Importe",
  iva:        "IVA",
  total:      "Total",
  comments:   "Comentarios",
};

export default function InvoicesView({
  invoices,
  setInvoices,
  fetchStats,
  addModalOpen,
  setAddModalOpen,
  fetchData,
  restaurantOptions,
}: InvoicesViewProps) {
  // ── List state ──────────────────────────────────────────────────────
  const [invoiceSelectMode,    setInvoiceSelectMode]    = useState(false);
  const [selectedInvoiceIds,   setSelectedInvoiceIds]   = useState<Set<string>>(new Set());
  const [expandedInvoices,     setExpandedInvoices]     = useState<Set<string>>(new Set());
  const [deleteInvoiceId,      setDeleteInvoiceId]      = useState<string | null>(null);
  const [deletingInvoice,      setDeletingInvoice]      = useState(false);
  const [confirmDeleteInvoices, setConfirmDeleteInvoices] = useState(false);
  const [fileViewerUrl,        setFileViewerUrl]        = useState<string | null>(null);
  const [fileViewerLoading,    setFileViewerLoading]    = useState(false);
  const [invoiceSearch,        setInvoiceSearch]        = useState("");
  const [invoiceSortMode,      setInvoiceSortMode]      = useState<"recent" | "date" | "alpha">("date");

  // ── Edit drawer state ────────────────────────────────────────────────
  const [editDrawerId,   setEditDrawerId]   = useState<string | null>(null);
  const [editConcepto,   setEditConcepto]   = useState("");
  const [editCuentaPnl,  setEditCuentaPnl]  = useState("");
  const [editComments,   setEditComments]   = useState("");
  const [editSaving,     setEditSaving]     = useState(false);
  const [editHistory,    setEditHistory]    = useState<EditHistory[]>([]);
  const [editHistoryLoading, setEditHistoryLoading] = useState(false);

  // ── Papelera state ───────────────────────────────────────────────────
  const [showPapelera,    setShowPapelera]    = useState(false);
  const [deletedInvoices, setDeletedInvoices] = useState<DbInvoice[]>([]);
  const [papeleraLoading, setPapeleraLoading] = useState(false);
  const [restoringId,     setRestoringId]     = useState<string | null>(null);

  // ── File viewer ──────────────────────────────────────────────────────
  const openFileViewer = useCallback(async (filePath: string) => {
    setFileViewerLoading(true);
    setFileViewerUrl(null);
    try {
      const res = await fetch(`/api/invoices/file?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
        setFileViewerUrl(data.url);
      }
    } catch { /* ignore */ }
    finally { setFileViewerLoading(false); }
  }, []);

  // ── Open edit drawer ─────────────────────────────────────────────────
  function openEditDrawer(inv: DbInvoice) {
    setEditDrawerId(inv.id);
    setEditConcepto(inv.concepto ?? "");
    setEditCuentaPnl(inv.cuenta_pnl ?? "");
    setEditComments(inv.comments ?? "");
    setEditHistory([]);
    setEditHistoryLoading(true);
    fetch(`/api/invoices/${inv.id}`)
      .then((r) => r.json())
      .then((d) => setEditHistory(d.edits ?? []))
      .catch(() => {})
      .finally(() => setEditHistoryLoading(false));
  }

  function closeEditDrawer() {
    setEditDrawerId(null);
  }

  async function saveEdit() {
    if (!editDrawerId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/invoices/${editDrawerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concepto:  editConcepto  || undefined,
          cuentaPnl: editCuentaPnl || undefined,
          comments:  editComments  || undefined,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setInvoices((prev) => prev.map((i) =>
          i.id === editDrawerId
            ? { ...i, concepto: updated.concepto, cuenta_pnl: updated.cuenta_pnl, comments: updated.comments }
            : i
        ));
        closeEditDrawer();
        fetchStats();
      }
    } finally { setEditSaving(false); }
  }

  // ── Delete ───────────────────────────────────────────────────────────
  async function confirmDeleteInvoice() {
    if (!deleteInvoiceId) return;
    setDeletingInvoice(true);
    try {
      await fetch(`/api/invoices/${deleteInvoiceId}`, { method: "DELETE" });
      setInvoices((prev) => prev.filter((i) => i.id !== deleteInvoiceId));
      fetchStats();
    } catch { /* ignore */ }
    finally { setDeletingInvoice(false); setDeleteInvoiceId(null); }
  }

  async function deleteSelectedInvoices() {
    setDeletingInvoice(true);
    try {
      await Promise.all(
        Array.from(selectedInvoiceIds).map((id) => fetch(`/api/invoices/${id}`, { method: "DELETE" }))
      );
      setInvoices((prev) => prev.filter((i) => !selectedInvoiceIds.has(i.id)));
      setSelectedInvoiceIds(new Set());
      setInvoiceSelectMode(false);
      fetchStats();
    } catch { /* ignore */ }
    finally { setDeletingInvoice(false); setConfirmDeleteInvoices(false); }
  }

  // ── Papelera ─────────────────────────────────────────────────────────
  async function loadPapelera() {
    setPapeleraLoading(true);
    try {
      const res = await fetch("/api/compras?view=invoices&showDeleted=1&pageSize=50");
      if (res.ok) {
        const d = await res.json();
        setDeletedInvoices(d.invoices ?? []);
      }
    } catch { /* ignore */ }
    finally { setPapeleraLoading(false); }
  }

  useEffect(() => {
    if (showPapelera) loadPapelera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPapelera]);

  async function restoreInvoice(id: string) {
    setRestoringId(id);
    try {
      const res = await fetch(`/api/invoices/${id}/restore`, { method: "POST" });
      if (res.ok) {
        setDeletedInvoices((prev) => prev.filter((i) => i.id !== id));
      }
    } catch { /* ignore */ }
    finally { setRestoringId(null); }
  }

  // ── Render ───────────────────────────────────────────────────────────
  if (invoices.length === 0 && !showPapelera) return null;

  const q = invoiceSearch.trim().toLowerCase();
  const filtered = invoices
    .filter((inv) => !q || inv.supplier.toLowerCase().includes(q) || (inv.invoice_number ?? "").toLowerCase().includes(q))
    .slice()
    .sort((a, b) => {
      if (invoiceSortMode === "recent") return (b.submitted_at ?? "").localeCompare(a.submitted_at ?? "");
      if (invoiceSortMode === "alpha")  return a.supplier.localeCompare(b.supplier, "es");
      return (b.invoice_date ?? "").localeCompare(a.invoice_date ?? "");
    });

  const editingInvoice = editDrawerId ? invoices.find((i) => i.id === editDrawerId) ?? null : null;

  return (
    <>
      <div className="space-y-2">
        {/* Search + sort bar */}
        <div className="flex flex-col gap-2 mb-2">
          <div className="relative w-full">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: "var(--text-muted)" }}>
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              placeholder="Buscar factura..."
              className="w-full pl-8 pr-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: invoiceSearch ? "var(--blue)" : "var(--border)", color: "var(--text)" }}
            />
            {invoiceSearch && (
              <button type="button" onClick={() => setInvoiceSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                style={{ color: "var(--text-muted)" }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-0.5 rounded-[var(--radius-sm)]" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}>
              {([["recent", "Recientes"], ["date", "Por fecha"], ["alpha", "A–Z"]] as [typeof invoiceSortMode, string][]).map(([mode, label]) => (
                <button key={mode} type="button"
                  className="text-[11px] px-2.5 py-1 rounded transition-colors"
                  style={{
                    background: invoiceSortMode === mode ? "var(--surface)" : "transparent",
                    color: invoiceSortMode === mode ? "var(--text)" : "var(--text-muted)",
                    fontWeight: invoiceSortMode === mode ? 600 : 400,
                    boxShadow: invoiceSortMode === mode ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                  onClick={() => setInvoiceSortMode(mode)}>
                  {label}
                </button>
              ))}
            </div>
            {invoiceSelectMode && selectedInvoiceIds.size > 0 && (
              <button type="button"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium"
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
              {invoiceSelectMode && selectedInvoiceIds.size > 0 && <span className="ml-1">({selectedInvoiceIds.size})</span>}
            </button>
            <button type="button"
              className="ml-auto px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors"
              style={{ background: showPapelera ? "var(--surface-raised)" : "transparent", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
              onClick={() => setShowPapelera((v) => !v)}
            >
              🗑 Papelera
            </button>
          </div>
        </div>

        {/* Invoice cards */}
        {filtered.map((inv) => {
          const isExpanded = expandedInvoices.has(inv.id);
          const isSelected = selectedInvoiceIds.has(inv.id);
          return (
            <div key={inv.id} className="rounded-[var(--radius)] border overflow-hidden"
              style={{ borderColor: isSelected ? "var(--blue)" : "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center">
                {/* Checkbox in select mode */}
                <div className="pl-4 flex-shrink-0 cursor-pointer"
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
                    <div className="w-4 h-4 rounded border-2 flex items-center justify-center"
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{inv.supplier}</span>
                      <span className="text-sm font-semibold flex-shrink-0" style={{ color: "var(--blue)" }}>{formatCurrency(inv.total)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      {inv.invoice_number && <span className="font-mono">#{inv.invoice_number}</span>}
                      {inv.invoice_number && <span style={{ opacity: 0.4 }}>·</span>}
                      <span>{formatDate(inv.invoice_date)}</span>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span>{inv.lineItems.length} artículo{inv.lineItems.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--pink-glow)", color: "var(--pink-dark)" }}>
                        {restaurantLabel(inv.restaurant)}
                      </span>
                      {inv.cuenta_pnl && !invoiceSelectMode && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: "var(--surface-raised)", color: "var(--text-dim)", border: "1px solid var(--border-subtle)" }}>
                          {inv.cuenta_pnl}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                {/* Edit + delete icons (always visible) */}
                {!invoiceSelectMode && (
                  <div className="flex items-center gap-1 pr-3">
                    <button
                      type="button"
                      title="Editar"
                      className="p-1.5 rounded transition-colors"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--blue)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      onClick={(e) => { e.stopPropagation(); openEditDrawer(inv); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <path d="M11.5 2.5a2.121 2.121 0 013 3L5 15H2v-3L11.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Eliminar"
                      className="p-1.5 rounded transition-colors"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger, #ef4444)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      onClick={(e) => { e.stopPropagation(); setDeleteInvoiceId(inv.id); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <path d="M6 2h4M2 5h12M4.5 5l1 9a.5.5 0 00.5.5h4a.5.5 0 00.5-.5l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded: line items + file viewer */}
              {isExpanded && !invoiceSelectMode && (
                <div className="border-t px-4 py-3 space-y-1.5" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)" }}>
                  <div className="flex items-center gap-2 pb-2 mb-1 border-b flex-wrap" style={{ borderColor: "var(--border-subtle)" }}>
                    {inv.file_url && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full transition-colors"
                        style={{ background: "var(--blue-glow)", color: "var(--blue)", border: "1px solid color-mix(in srgb, var(--blue) 25%, transparent)" }}
                        onClick={() => openFileViewer(inv.file_url!)}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Ver archivo
                      </button>
                    )}
                    {inv.concepto && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface)", color: "var(--text-dim)", border: "1px solid var(--border-subtle)" }}>
                        {inv.concepto}
                      </span>
                    )}
                    {inv.comments && (
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{inv.comments}</span>
                    )}
                  </div>
                  {inv.lineItems.length === 0 ? (
                    <p className="text-xs py-2" style={{ color: "var(--text-dim)" }}>Sin artículos individuales</p>
                  ) : (
                    inv.lineItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                        <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{item.description}</span>
                        <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                          {item.quantity != null ? `${item.quantity} ${item.unit_normalized ?? item.unit ?? ""}` : ""}
                        </span>
                        <span className="flex-shrink-0 font-medium" style={{ color: "var(--blue)" }}>
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Papelera section */}
        {showPapelera && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
              Papelera — facturas eliminadas
            </p>
            {papeleraLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
              </div>
            ) : deletedInvoices.length === 0 ? (
              <p className="text-xs py-3 text-center" style={{ color: "var(--text-dim)" }}>Papelera vacía</p>
            ) : (
              <div className="space-y-1.5">
                {deletedInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)] border"
                    style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)", opacity: 0.75 }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{inv.supplier}</span>
                        <span className="text-sm font-semibold flex-shrink-0" style={{ color: "var(--text-muted)" }}>{formatCurrency(inv.total)}</span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {formatDate(inv.invoice_date)} · {restaurantLabel(inv.restaurant)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={restoringId === inv.id}
                      className="flex-shrink-0 px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors"
                      style={{ background: "var(--surface)", color: "var(--blue)", border: "1px solid color-mix(in srgb, var(--blue) 30%, transparent)" }}
                      onClick={() => restoreInvoice(inv.id)}
                    >
                      {restoringId === inv.id ? "..." : "Restaurar"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit drawer */}
      {editDrawerId && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={closeEditDrawer}>
          <div
            className="relative h-full w-full max-w-sm flex flex-col"
            style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 32px rgba(0,0,0,0.12)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {editingInvoice?.supplier ?? "Editar factura"}
                </p>
                {editingInvoice && (
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {formatDate(editingInvoice.invoice_date)} · {formatCurrency(editingInvoice.total)}
                  </p>
                )}
              </div>
              <button type="button" onClick={closeEditDrawer}
                className="p-1.5 rounded"
                style={{ color: "var(--text-muted)" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1.5 1.5l11 11M12.5 1.5l-11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Drawer form */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                  Concepto
                </label>
                <div className="relative">
                  <select
                    value={editConcepto}
                    className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none focus:outline-none focus:ring-2"
                    style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: editConcepto ? "var(--text)" : "var(--text-dim)" }}
                    onChange={(e) => setEditConcepto(e.target.value)}
                  >
                    <option value="">Sin concepto</option>
                    {(dropdownOptions.concepto as string[]).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                  Cuenta P&L
                </label>
                <div className="relative">
                  <select
                    value={editCuentaPnl}
                    className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none focus:outline-none focus:ring-2"
                    style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: editCuentaPnl ? "var(--text)" : "var(--text-dim)" }}
                    onChange={(e) => setEditCuentaPnl(e.target.value)}
                  >
                    <option value="">Sin categoría</option>
                    {(dropdownOptions.cuentaPnl as string[]).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                  Comentarios
                </label>
                <textarea
                  value={editComments}
                  rows={2}
                  placeholder="Notas opcionales..."
                  className="w-full px-3 py-2 rounded-[var(--radius-sm)] border text-sm resize-none focus:outline-none focus:ring-2"
                  style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: "var(--text)" }}
                  onChange={(e) => setEditComments(e.target.value)}
                />
              </div>

              {/* Edit history */}
              <div className="pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <p className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Historial de ediciones
                </p>
                {editHistoryLoading ? (
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>Cargando...</p>
                ) : editHistory.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>Sin ediciones anteriores</p>
                ) : (
                  <div className="space-y-2">
                    {editHistory.map((h) => (
                      <div key={h.id} className="text-xs p-2 rounded-[var(--radius-sm)]" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium" style={{ color: "var(--text)" }}>{h.edited_by}</span>
                          <span style={{ color: "var(--text-dim)" }}>{new Date(h.edited_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className="space-y-0.5">
                          {Object.entries(h.changes).map(([field, { from, to }]) => (
                            <div key={field} style={{ color: "var(--text-muted)" }}>
                              <span className="font-medium">{FIELD_LABELS[field] ?? field}:</span>{" "}
                              <span style={{ textDecoration: "line-through", opacity: 0.6 }}>{String(from ?? "—")}</span>
                              {" → "}
                              <span style={{ color: "var(--text)" }}>{String(to ?? "—")}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer footer */}
            <div className="px-5 py-4 border-t flex justify-end gap-2" style={{ borderColor: "var(--border-subtle)" }}>
              <Button variant="secondary" size="sm" onClick={closeEditDrawer}>Cancelar</Button>
              <Button size="sm" loading={editSaving} onClick={saveEdit}>Guardar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete invoice confirmation modal */}
      <Modal open={!!deleteInvoiceId} onClose={() => setDeleteInvoiceId(null)} title="Eliminar factura" maxWidth="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            ¿Mover esta factura a la papelera? Podrás restaurarla desde ahí.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteInvoiceId(null)}>Cancelar</Button>
            <Button variant="danger" size="sm" loading={deletingInvoice} onClick={confirmDeleteInvoice}>Eliminar</Button>
          </div>
        </div>
      </Modal>

      {/* Bulk delete confirmation modal */}
      <Modal open={confirmDeleteInvoices} onClose={() => setConfirmDeleteInvoices(false)} title="Eliminar facturas" maxWidth="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            ¿Mover <span className="font-medium" style={{ color: "var(--text)" }}>{selectedInvoiceIds.size} factura{selectedInvoiceIds.size !== 1 ? "s" : ""}</span> a la papelera?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteInvoices(false)}>Cancelar</Button>
            <Button variant="danger" size="sm" loading={deletingInvoice} onClick={deleteSelectedInvoices}>Eliminar</Button>
          </div>
        </div>
      </Modal>

      {/* File viewer modal */}
      <Modal open={fileViewerUrl !== null || fileViewerLoading} onClose={() => { setFileViewerUrl(null); setFileViewerLoading(false); }} title="Archivo original" maxWidth="max-w-3xl">
        <div className="min-h-[300px] flex items-center justify-center">
          {fileViewerLoading ? (
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
          ) : fileViewerUrl ? (
            fileViewerUrl.includes(".pdf") ? (
              <iframe src={fileViewerUrl} className="w-full h-[70vh] rounded" title="Invoice PDF" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileViewerUrl} alt="Invoice" className="max-w-full max-h-[70vh] rounded object-contain" />
            )
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No se pudo cargar el archivo.</p>
          )}
        </div>
      </Modal>

      <AddInvoiceModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={() => { setAddModalOpen(false); fetchData(); }}
        restaurantOptions={restaurantOptions}
      />
    </>
  );
}

// ─── Add Invoice Modal ───────────────────────────────────────────────────────
function AddInvoiceModal({
  open,
  onClose,
  onAdded,
  restaurantOptions,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  restaurantOptions: Array<{ value: string; label: string }>;
}) {
  const [restaurant,    setRestaurant]    = useState("");
  const [supplier,      setSupplier]      = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate,   setInvoiceDate]   = useState(new Date().toISOString().slice(0, 10));
  const [importe,       setImporte]       = useState("");
  const [iva,           setIva]           = useState("");
  const [total,         setTotal]         = useState("");
  const [concepto,      setConcepto]      = useState("");
  const [cuentaPnl,     setCuentaPnl]     = useState("");
  const [comments,      setComments]      = useState("");
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");

  async function handleAdd() {
    if (!supplier.trim() || !invoiceDate || !total) {
      setError("Proveedor, fecha y total son requeridos");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/compras/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant,
          supplier: supplier.trim(),
          invoiceNumber: invoiceNumber.trim() || undefined,
          invoiceDate,
          importe: parseFloat(importe) || 0,
          iva: parseFloat(iva) || 0,
          total: parseFloat(total),
          concepto: concepto || undefined,
          cuentaPnl: cuentaPnl || undefined,
          comments: comments.trim() || undefined,
        }),
      });
      if (!res.ok) { setError("Error al guardar"); return; }
      setSupplier(""); setInvoiceNumber(""); setImporte(""); setIva(""); setTotal("");
      setConcepto(""); setCuentaPnl(""); setComments("");
      onAdded();
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar factura">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Proveedor *</label>
            <input type="text" value={supplier} placeholder="Nombre del proveedor..."
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setSupplier(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Restaurante</label>
            <div className="relative mt-1">
              <select value={restaurant}
                className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                onChange={(e) => setRestaurant(e.target.value)}>
                {restaurantOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Nº Factura</label>
            <input type="text" value={invoiceNumber} placeholder="Opcional"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Fecha *</label>
            <input type="date" value={invoiceDate}
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Importe</label>
            <input type="number" value={importe} step="0.01" placeholder="$0"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setImporte(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>IVA</label>
            <input type="number" value={iva} step="0.01" placeholder="$0"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setIva(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total *</label>
            <input type="number" value={total} step="0.01" placeholder="$0"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setTotal(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Concepto</label>
            <div className="relative mt-1">
              <select value={concepto}
                className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: concepto ? "var(--text)" : "var(--text-dim)" }}
                onChange={(e) => setConcepto(e.target.value)}>
                <option value="">Seleccionar...</option>
                {(dropdownOptions.concepto as string[]).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Cuenta P&L</label>
            <div className="relative mt-1">
              <select value={cuentaPnl}
                className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: cuentaPnl ? "var(--text)" : "var(--text-dim)" }}
                onChange={(e) => setCuentaPnl(e.target.value)}>
                <option value="">Seleccionar...</option>
                {(dropdownOptions.cuentaPnl as string[]).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Comentarios</label>
          <input type="text" value={comments} placeholder="Opcional"
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
            onChange={(e) => setComments(e.target.value)} />
        </div>
        {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" loading={saving} onClick={handleAdd}>Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}
