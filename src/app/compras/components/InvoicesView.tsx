"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { DbInvoice, formatCurrency, formatDate } from "../types";
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

const GRID = "28px 1fr 96px 116px 140px 112px 60px";

const COL_HEADER: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-muted)",
  padding: "0 12px",
};

function RestaurantPill({ name }: { name: string }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: "0.01em",
      background: "var(--blue-light)",
      color: "var(--blue)",
      border: "1px solid color-mix(in srgb, var(--blue) 22%, transparent)",
      whiteSpace: "nowrap",
      lineHeight: 1.6,
    }}>
      {name}
    </span>
  );
}

const ROW_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.045, duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
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
  const [invoiceSelectMode,     setInvoiceSelectMode]     = useState(false);
  const [selectedInvoiceIds,    setSelectedInvoiceIds]    = useState<Set<string>>(new Set());
  const [expandedInvoices,      setExpandedInvoices]      = useState<Set<string>>(new Set());
  const [deleteInvoiceId,       setDeleteInvoiceId]       = useState<string | null>(null);
  const [deletingInvoice,       setDeletingInvoice]       = useState(false);
  const [confirmDeleteInvoices, setConfirmDeleteInvoices] = useState(false);
  const [fileViewerUrl,         setFileViewerUrl]         = useState<string | null>(null);
  const [fileViewerLoading,     setFileViewerLoading]     = useState(false);
  const [invoiceSearch,         setInvoiceSearch]         = useState("");
  const [invoiceSortMode,       setInvoiceSortMode]       = useState<"recent" | "date" | "alpha">("date");

  const [editDrawerId,       setEditDrawerId]       = useState<string | null>(null);
  const [editConcepto,       setEditConcepto]       = useState("");
  const [editCuentaPnl,      setEditCuentaPnl]      = useState("");
  const [editComments,       setEditComments]       = useState("");
  const [editSaving,         setEditSaving]         = useState(false);
  const [editHistory,        setEditHistory]        = useState<EditHistory[]>([]);
  const [editHistoryLoading, setEditHistoryLoading] = useState(false);

  const [showPapelera,    setShowPapelera]    = useState(false);
  const [deletedInvoices, setDeletedInvoices] = useState<DbInvoice[]>([]);
  const [papeleraLoading, setPapeleraLoading] = useState(false);
  const [restoringId,     setRestoringId]     = useState<string | null>(null);

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

  function closeEditDrawer() { setEditDrawerId(null); }

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
      if (res.ok) setDeletedInvoices((prev) => prev.filter((i) => i.id !== id));
    } catch { /* ignore */ }
    finally { setRestoringId(null); }
  }

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
      <style>{`
        @keyframes boh-slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes boh-backdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .inv-row-actions { opacity: 0; transition: opacity 100ms ease; }
        .inv-row:hover .inv-row-actions,
        .inv-row-actions.always-visible { opacity: 1; }
        .inv-row:hover { background: var(--surface-raised) !important; }
        .inv-action-btn { transition: background 100ms ease, color 100ms ease; }
        .drawer-field select, .drawer-field textarea {
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .drawer-field select:focus, .drawer-field textarea:focus {
          border-color: var(--blue) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 12%, transparent);
          outline: none;
        }
      `}</style>

      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="relative w-full">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: "var(--text-muted)" }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={invoiceSearch}
            onChange={(e) => setInvoiceSearch(e.target.value)}
            placeholder="Buscar proveedor o número..."
            className="w-full pl-8 pr-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none"
            style={{
              background: "var(--surface)",
              borderColor: invoiceSearch ? "var(--blue)" : "var(--border)",
              color: "var(--text)",
              boxShadow: invoiceSearch ? "0 0 0 3px color-mix(in srgb, var(--blue) 12%, transparent)" : "none",
              transition: "border-color 120ms ease, box-shadow 120ms ease",
            }}
          />
          {invoiceSearch && (
            <button type="button" onClick={() => setInvoiceSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded"
              style={{ color: "var(--text-muted)" }}>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 p-0.5 rounded-[var(--radius-sm)]" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}>
            {([["recent", "Recientes"], ["date", "Fecha"], ["alpha", "A–Z"]] as [typeof invoiceSortMode, string][]).map(([mode, label]) => (
              <button key={mode} type="button"
                className="text-[11px] px-2.5 py-1 rounded transition-all duration-100"
                style={{
                  background: invoiceSortMode === mode ? "var(--surface)" : "transparent",
                  color: invoiceSortMode === mode ? "var(--text)" : "var(--text-muted)",
                  fontWeight: invoiceSortMode === mode ? 600 : 400,
                  boxShadow: invoiceSortMode === mode ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
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
              onClick={() => setConfirmDeleteInvoices(true)}>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M6 2h4M2 5h12M4.5 5l1 9a.5.5 0 00.5.5h4a.5.5 0 00.5-.5l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Eliminar ({selectedInvoiceIds.size})
            </button>
          )}

          <button type="button"
            className="px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-all duration-100"
            style={{
              background: invoiceSelectMode ? "var(--surface-raised)" : "transparent",
              color: invoiceSelectMode ? "var(--text)" : "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
            }}
            onClick={() => { setInvoiceSelectMode((m) => !m); setSelectedInvoiceIds(new Set()); }}>
            {invoiceSelectMode ? "Cancelar" : "Seleccionar"}
            {invoiceSelectMode && selectedInvoiceIds.size > 0 && <span className="ml-1 font-semibold">({selectedInvoiceIds.size})</span>}
          </button>

          <button type="button"
            className="ml-auto px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-all duration-100"
            style={{
              background: showPapelera ? "var(--surface-raised)" : "transparent",
              color: "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
            }}
            onClick={() => setShowPapelera((v) => !v)}>
            Papelera{deletedInvoices.length > 0 && !showPapelera ? ` (${deletedInvoices.length})` : ""}
          </button>
        </div>
      </div>

      {/* ── Invoices table ── */}
      <div>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", height: 36, borderBottom: "1px solid var(--border)", background: "var(--surface-raised)", padding: "0 4px 0 0" }}>
          <span />
          <span style={{ ...COL_HEADER, paddingLeft: 8 }}>Proveedor</span>
          <span style={{ ...COL_HEADER, textAlign: "right" }}>Factura</span>
          <span style={{ ...COL_HEADER, textAlign: "right" }}>Fecha</span>
          <span style={{ ...COL_HEADER, textAlign: "right" }}>Sucursal</span>
          <span style={{ ...COL_HEADER, textAlign: "right" }}>Total</span>
          <span />
        </div>

        {filtered.map((inv, i) => {
          const isExpanded = expandedInvoices.has(inv.id);
          const isSelected = selectedInvoiceIds.has(inv.id);

          function toggleExpand() {
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
          }

          return (
            <motion.div key={inv.id} custom={i} initial="hidden" animate="visible" variants={ROW_VARIANTS}>
              {/* Main row */}
              <div
                className="inv-row"
                onClick={toggleExpand}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  alignItems: "center",
                  height: 50,
                  padding: "0 4px 0 0",
                  borderBottom: isExpanded ? "none" : "1px solid var(--border)",
                  background: isSelected
                    ? "color-mix(in srgb, var(--blue) 6%, var(--surface))"
                    : isExpanded
                    ? "var(--surface-raised)"
                    : "var(--surface)",
                  cursor: "pointer",
                  transition: "background 100ms ease",
                  borderLeft: isSelected ? "2px solid var(--blue)" : "2px solid transparent",
                }}
              >
                {/* Chevron / checkbox */}
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "var(--text-dim)" }}>
                  {invoiceSelectMode ? (
                    <div style={{
                      width: 14, height: 14, borderRadius: 4, border: `2px solid ${isSelected ? "var(--blue)" : "var(--border)"}`,
                      background: isSelected ? "var(--blue)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                      style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 180ms ease" }}>
                      <path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Supplier */}
                <div style={{ padding: "0 12px 0 8px", overflow: "hidden", display: "flex", alignItems: "center" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.015em" }}>
                    {inv.supplier}
                  </span>
                </div>

                {/* Invoice # */}
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-muted)", textAlign: "right", padding: "0 12px" }}>
                  {inv.invoice_number ? `#${inv.invoice_number}` : "—"}
                </span>

                {/* Date */}
                <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right", padding: "0 12px" }}>
                  {formatDate(inv.invoice_date)}
                </span>

                {/* Sucursal */}
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 12px" }}>
                  <RestaurantPill name={inv.restaurant} />
                </div>

                {/* Total */}
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", textAlign: "right", padding: "0 12px", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em" }}>
                  {formatCurrency(inv.total)}
                </span>

                {/* Actions */}
                <div className={`inv-row-actions${isExpanded ? " always-visible" : ""}`}
                  style={{ display: "flex", justifyContent: "flex-end", gap: 2, padding: "0 8px" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditDrawer(inv); }}
                    className="inv-action-btn"
                    style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-dim)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-raised)"; e.currentTarget.style.color = "var(--text)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5a2.121 2.121 0 013 3L5 15H2v-3L11.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteInvoiceId(inv.id); }}
                    className="inv-action-btn"
                    style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-dim)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-dim)"; e.currentTarget.style.color = "var(--danger)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 2h4M2 5h12M4.5 5l1 9a.5.5 0 00.5.5h4a.5.5 0 00.5-.5l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              </div>

              {/* Expanded: line items */}
              <AnimatePresence>
                {isExpanded && !invoiceSelectMode && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ background: "var(--surface-raised)", borderBottom: "1px solid var(--border)", borderTop: "1px solid var(--border)" }}>
                      {/* File / notes strip */}
                      {(inv.file_url || inv.concepto || inv.comments) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 20px 6px 44px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                          {inv.file_url && (
                            <button type="button"
                              onClick={() => openFileViewer(inv.file_url!)}
                              style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 99, background: "var(--blue-glow)", color: "var(--blue)", border: "1px solid color-mix(in srgb, var(--blue) 20%, transparent)", cursor: "pointer" }}>
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                              </svg>
                              Ver archivo
                            </button>
                          )}
                          {inv.concepto && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{inv.concepto}</span>}
                          {inv.comments && <span style={{ fontSize: 11, fontStyle: "italic", color: "var(--text-muted)" }}>"{inv.comments}"</span>}
                        </div>
                      )}

                      {/* Line items */}
                      {inv.lineItems.length === 0 ? (
                        <p style={{ fontSize: 12, color: "var(--text-dim)", padding: "10px 20px 10px 44px" }}>Sin artículos individuales</p>
                      ) : (
                        <>
                          {/* Mini header */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px 96px", padding: "7px 20px 5px 44px" }}>
                            {["Artículo", "Cantidad", "Unidad", "Total"].map((h, idx) => (
                              <span key={h} style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-dim)", textAlign: idx > 0 ? "right" : "left" }}>{h}</span>
                            ))}
                          </div>
                          {inv.lineItems.map((item, idx) => (
                            <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px 96px", padding: "5px 20px", paddingLeft: 44, borderTop: "1px solid var(--border)" }}>
                              <span style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</span>
                              <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.quantity ?? "—"}</span>
                              <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>{item.unit_normalized ?? item.unit ?? "—"}</span>
                              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(item.total)}</span>
                            </div>
                          ))}
                          {/* Total row */}
                          <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 20px 7px", borderTop: "2px solid var(--border)" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{formatCurrency(inv.total)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* ── Papelera ── */}
      {showPapelera && (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Papelera</p>
          {papeleraLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
            </div>
          ) : deletedInvoices.length === 0 ? (
            <p className="text-xs py-3 text-center" style={{ color: "var(--text-dim)" }}>Papelera vacía</p>
          ) : (
            <div className="space-y-1">
              {deletedInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius)] border"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)", opacity: 0.7 }}>
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-medium truncate block" style={{ color: "var(--text)", textDecoration: "line-through", textDecorationColor: "var(--text-dim)" }}>{inv.supplier}</span>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{formatDate(inv.invoice_date)} · {formatCurrency(inv.total)}</span>
                  </div>
                  <button type="button" disabled={restoringId === inv.id}
                    className="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-[var(--radius-sm)] font-medium"
                    style={{ background: "var(--surface)", color: "var(--blue)", border: "1px solid color-mix(in srgb, var(--blue) 25%, transparent)" }}
                    onClick={() => restoreInvoice(inv.id)}>
                    {restoringId === inv.id ? "..." : "Restaurar"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Edit drawer ── */}
      {editDrawerId && (
        <div className="fixed inset-0 z-50 flex justify-end"
          style={{ background: "rgba(0,0,0,0.48)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", animation: "boh-backdropIn 0.2s ease" }}
          onClick={closeEditDrawer}>
          <div className="relative h-full flex flex-col"
            style={{ width: "min(380px, 92vw)", background: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "-24px 0 64px rgba(0,0,0,0.18)", animation: "boh-slideInRight 0.28s cubic-bezier(0.32,0.72,0,1)" }}
            onClick={(e) => e.stopPropagation()}>
            {/* Drawer header */}
            <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-snug truncate" style={{ color: "var(--text)", letterSpacing: "-0.012em" }}>
                    {editingInvoice?.supplier ?? "Editar factura"}
                  </p>
                  {editingInvoice && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{formatDate(editingInvoice.invoice_date)}</span>
                      <span style={{ color: "var(--border)", fontSize: "10px" }}>·</span>
                      <span className="text-[12px] font-semibold" style={{ color: "var(--blue)", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(editingInvoice.total)}</span>
                    </div>
                  )}
                </div>
                <button type="button" onClick={closeEditDrawer} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1.5 1.5l11 11M12.5 1.5l-11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
              </div>
            </div>

            {/* Drawer form */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <div className="drawer-field">
                <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Concepto</label>
                <div className="relative">
                  <select value={editConcepto} className="w-full px-3 py-2.5 pr-9 rounded-[var(--radius-sm)] border text-sm appearance-none"
                    style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: editConcepto ? "var(--text)" : "var(--text-dim)" }}
                    onChange={(e) => setEditConcepto(e.target.value)}>
                    <option value="">Sin concepto</option>
                    {(dropdownOptions.concepto as string[]).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <div className="drawer-field">
                <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Cuenta P&L</label>
                <div className="relative">
                  <select value={editCuentaPnl} className="w-full px-3 py-2.5 pr-9 rounded-[var(--radius-sm)] border text-sm appearance-none"
                    style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: editCuentaPnl ? "var(--text)" : "var(--text-dim)" }}
                    onChange={(e) => setEditCuentaPnl(e.target.value)}>
                    <option value="">Sin categoría</option>
                    {(dropdownOptions.cuentaPnl as string[]).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <div className="drawer-field">
                <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--text-muted)" }}>Comentarios</label>
                <textarea value={editComments} rows={3} placeholder="Notas opcionales..."
                  className="w-full px-3 py-2.5 rounded-[var(--radius-sm)] border text-sm resize-none"
                  style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: "var(--text)", lineHeight: "1.5" }}
                  onChange={(e) => setEditComments(e.target.value)} />
              </div>

              {/* Edit history */}
              <div className="pt-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Historial</span>
                  <div className="flex-1 border-t" style={{ borderColor: "var(--border-subtle)" }} />
                </div>
                {editHistoryLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
                    <span className="text-xs" style={{ color: "var(--text-dim)" }}>Cargando...</span>
                  </div>
                ) : editHistory.length === 0 ? (
                  <p className="text-[12px]" style={{ color: "var(--text-dim)" }}>Sin ediciones anteriores</p>
                ) : (
                  <div className="space-y-2">
                    {editHistory.map((h, idx) => (
                      <div key={h.id} className="relative pl-4">
                        <div className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full" style={{ background: idx === 0 ? "var(--blue)" : "var(--border)" }} />
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-medium" style={{ color: "var(--text)" }}>{h.edited_by}</span>
                          <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                            {new Date(h.edited_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {Object.entries(h.changes).map(([field, { from, to }]) => (
                            <p key={field} className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                              <span className="font-medium">{FIELD_LABELS[field] ?? field}: </span>
                              <span style={{ textDecoration: "line-through", opacity: 0.55 }}>{String(from ?? "—")}</span>
                              {" → "}
                              <span style={{ color: "var(--text)" }}>{String(to ?? "—")}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)" }}>
              <Button variant="secondary" size="sm" onClick={closeEditDrawer}>Cancelar</Button>
              <Button size="sm" loading={editSaving} onClick={saveEdit}>Guardar cambios</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      <Modal open={!!deleteInvoiceId} onClose={() => setDeleteInvoiceId(null)} title="Eliminar factura" maxWidth="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>¿Mover esta factura a la papelera? Podrás restaurarla desde ahí.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteInvoiceId(null)}>Cancelar</Button>
            <Button variant="danger" size="sm" loading={deletingInvoice} onClick={confirmDeleteInvoice}>Eliminar</Button>
          </div>
        </div>
      </Modal>

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

      <Modal open={fileViewerUrl !== null || fileViewerLoading} onClose={() => { setFileViewerUrl(null); setFileViewerLoading(false); }} title="Archivo original" maxWidth="max-w-3xl">
        <div className="min-h-[300px] flex items-center justify-center">
          {fileViewerLoading ? (
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
          ) : fileViewerUrl ? (
            fileViewerUrl.includes(".pdf")
              ? <iframe src={fileViewerUrl} className="w-full h-[70vh] rounded" title="Invoice PDF" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={fileViewerUrl} alt="Invoice" className="max-w-full max-h-[70vh] rounded object-contain" />
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

// ─── Add Invoice Modal ─────────────────────────────────────────────────────────
function AddInvoiceModal({
  open, onClose, onAdded, restaurantOptions,
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
    if (!supplier.trim() || !invoiceDate || !total) { setError("Proveedor, fecha y total son requeridos"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/compras/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant, supplier: supplier.trim(),
          invoiceNumber: invoiceNumber.trim() || undefined, invoiceDate,
          importe: parseFloat(importe) || 0, iva: parseFloat(iva) || 0, total: parseFloat(total),
          concepto: concepto || undefined, cuentaPnl: cuentaPnl || undefined,
          comments: comments.trim() || undefined,
        }),
      });
      if (!res.ok) { setError("Error al guardar"); return; }
      setSupplier(""); setInvoiceNumber(""); setImporte(""); setIva(""); setTotal("");
      setConcepto(""); setCuentaPnl(""); setComments(""); onAdded();
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  const fieldClass = "w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none";
  const fieldStyle = { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <Modal open={open} onClose={onClose} title="Agregar factura">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Proveedor *</label>
            <input type="text" value={supplier} placeholder="Nombre del proveedor..."
              className={fieldClass} style={fieldStyle} onChange={(e) => setSupplier(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Restaurante</label>
            <div className="relative mt-1">
              <select value={restaurant} className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none"
                style={fieldStyle} onChange={(e) => setRestaurant(e.target.value)}>
                {restaurantOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Nº Factura</label>
            <input type="text" value={invoiceNumber} placeholder="Opcional"
              className={fieldClass} style={fieldStyle} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Fecha *</label>
            <input type="date" value={invoiceDate}
              className={fieldClass} style={fieldStyle} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[["Importe", importe, setImporte], ["IVA", iva, setIva], ["Total *", total, setTotal]].map(([lbl, val, setter]) => (
            <div key={String(lbl)}>
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{String(lbl)}</label>
              <input type="number" value={String(val)} step="0.01" placeholder="$0"
                className={fieldClass} style={fieldStyle} onChange={(e) => (setter as (v: string) => void)(e.target.value)} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[["Concepto", concepto, setConcepto, dropdownOptions.concepto as string[]], ["Cuenta P&L", cuentaPnl, setCuentaPnl, dropdownOptions.cuentaPnl as string[]]].map(([lbl, val, setter, opts]) => (
            <div key={String(lbl)}>
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{String(lbl)}</label>
              <div className="relative mt-1">
                <select value={String(val)}
                  className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none"
                  style={{ ...fieldStyle, color: val ? "var(--text)" : "var(--text-dim)" }}
                  onChange={(e) => (setter as (v: string) => void)(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {(opts as string[]).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Comentarios</label>
          <input type="text" value={comments} placeholder="Opcional"
            className={fieldClass} style={fieldStyle} onChange={(e) => setComments(e.target.value)} />
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
