"use client";

import React, { useState, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { DbInvoice, formatCurrency, formatDate, restaurantLabel } from "../types";
import dropdownOptions from "../../../../data/dropdown_options.json";

interface InvoicesViewProps {
  invoices: DbInvoice[];
  setInvoices: React.Dispatch<React.SetStateAction<DbInvoice[]>>;
  fetchStats: () => void;
}

export default function InvoicesView({
  invoices,
  setInvoices,
  fetchStats,
}: InvoicesViewProps) {
  const [invoiceSelectMode, setInvoiceSelectMode] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [confirmDeleteInvoices, setConfirmDeleteInvoices] = useState(false);
  const [reclassifyingId, setReclassifyingId] = useState<string | null>(null);
  const [reclassifyValue, setReclassifyValue] = useState("");
  const [reclassifyingSaving, setReclassifyingSaving] = useState(false);
  const [fileViewerUrl, setFileViewerUrl] = useState<string | null>(null);
  const [fileViewerLoading, setFileViewerLoading] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceSortMode, setInvoiceSortMode] = useState<"recent" | "date" | "alpha">("date");

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

  async function confirmDeleteInvoice() {
    if (!deleteInvoiceId) return;
    setDeletingInvoice(true);
    try {
      await fetch(`/api/compras/invoices/${deleteInvoiceId}`, { method: "DELETE" });
      setInvoices((prev) => prev.filter((i) => i.id !== deleteInvoiceId));
      fetchStats();
    } catch { /* ignore */ }
    finally {
      setDeletingInvoice(false);
      setDeleteInvoiceId(null);
    }
  }

  async function deleteSelectedInvoices() {
    setDeletingInvoice(true);
    try {
      await Promise.all(
        Array.from(selectedInvoiceIds).map((id) =>
          fetch(`/api/compras/invoices/${id}`, { method: "DELETE" })
        )
      );
      setInvoices((prev) => prev.filter((i) => !selectedInvoiceIds.has(i.id)));
      setSelectedInvoiceIds(new Set());
      setInvoiceSelectMode(false);
      fetchStats();
    } catch { /* ignore */ }
    finally {
      setDeletingInvoice(false);
      setConfirmDeleteInvoices(false);
    }
  }

  if (invoices.length === 0) return null;

  const q = invoiceSearch.trim().toLowerCase();
  const filtered = invoices
    .filter((inv) => !q || inv.supplier.toLowerCase().includes(q) || (inv.invoice_number ?? "").toLowerCase().includes(q))
    .slice()
    .sort((a, b) => {
      if (invoiceSortMode === "recent") return (b.submitted_at ?? "").localeCompare(a.submitted_at ?? "");
      if (invoiceSortMode === "alpha") return a.supplier.localeCompare(b.supplier, "es");
      return (b.invoice_date ?? "").localeCompare(a.invoice_date ?? "");
    });

  return (
    <>
      <div className="space-y-2">
        {/* Search + sort bar */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="relative flex-1 min-w-[180px]">
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
        </div>

        {/* Select mode toolbar */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
            {invoiceSelectMode && selectedInvoiceIds.size > 0
              ? `${selectedInvoiceIds.size} seleccionada${selectedInvoiceIds.size !== 1 ? "s" : ""}`
              : ""}
          </span>
          <div className="flex items-center gap-2">
            {invoiceSelectMode && selectedInvoiceIds.size > 0 && (
              <button type="button"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors"
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
            </button>
          </div>
        </div>

        {filtered.map((inv) => {
          const isExpanded = expandedInvoices.has(inv.id);
          const isSelected = selectedInvoiceIds.has(inv.id);
          return (
            <div key={inv.id} className="rounded-[var(--radius)] border overflow-hidden"
              style={{ borderColor: isSelected ? "var(--blue)" : "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center">
                {/* Checkbox in select mode */}
                <div className="pl-4 flex-shrink-0"
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
                  {invoiceSelectMode ? (
                    <div className="w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer"
                      style={{ borderColor: isSelected ? "var(--blue)" : "var(--border)", background: isSelected ? "var(--blue)" : "transparent" }}>
                      {isSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  ) : null}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{inv.supplier}</span>
                      {inv.invoice_number && (
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>#{inv.invoice_number}</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--pink-glow)", color: "var(--pink-dark)" }}>
                        {restaurantLabel(inv.restaurant)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>{formatDate(inv.invoice_date)}</span>
                      <span className="font-semibold" style={{ color: "var(--blue)" }}>{formatCurrency(inv.total)}</span>
                      <span>{inv.lineItems.length} artículo{inv.lineItems.length !== 1 ? "s" : ""}</span>
                      {inv.cuenta_pnl && !invoiceSelectMode && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: "var(--surface-raised)", color: "var(--text-dim)", border: "1px solid var(--border-subtle)" }}>
                          {inv.cuenta_pnl}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
              {isExpanded && !invoiceSelectMode && (
                <div className="border-t px-4 py-3 space-y-1.5" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)" }}>
                  {/* Actions bar: view file + reclassify */}
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
                  </div>
                  {/* Reclassify cuentaPnl */}
                  <div className="flex items-center gap-2 pb-2 mb-1 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Cuenta P&L</span>
                    {reclassifyingId === inv.id ? (
                      <span className="flex items-center gap-1">
                        <select
                          autoFocus
                          value={reclassifyValue}
                          className="px-1.5 py-0.5 rounded border text-[10px] appearance-none focus:outline-none focus:ring-1"
                          style={{ background: "var(--surface)", borderColor: "var(--blue)", color: "var(--text)" }}
                          onChange={(e) => setReclassifyValue(e.target.value)}
                        >
                          {(dropdownOptions.cuentaPnl as string[]).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <button type="button"
                          disabled={reclassifyingSaving}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ background: "var(--blue)", color: "#fff" }}
                          onClick={async () => {
                            setReclassifyingSaving(true);
                            try {
                              const res = await fetch(`/api/compras/invoices/${inv.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ cuentaPnl: reclassifyValue }),
                              });
                              if (res.ok) {
                                setInvoices((prev) => prev.map((i) =>
                                  i.id === inv.id ? { ...i, cuenta_pnl: reclassifyValue } : i
                                ));
                                setReclassifyingId(null);
                              }
                            } finally { setReclassifyingSaving(false); }
                          }}
                        >
                          {reclassifyingSaving ? "..." : "✓"}
                        </button>
                        <button type="button"
                          className="text-[10px]"
                          style={{ color: "var(--text-muted)" }}
                          onClick={() => setReclassifyingId(null)}
                        >✕</button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-[10px] px-1.5 py-0.5 rounded-full transition-colors"
                        style={{ background: "var(--surface)", color: "var(--text-dim)", border: "1px solid var(--border-subtle)" }}
                        onClick={() => { setReclassifyingId(inv.id); setReclassifyValue(inv.cuenta_pnl ?? ""); }}
                      >
                        {inv.cuenta_pnl ?? "Sin categoría"} ✎
                      </button>
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
      </div>

      {/* Delete invoice confirmation modal */}
      <Modal
        open={!!deleteInvoiceId}
        onClose={() => setDeleteInvoiceId(null)}
        title="Eliminar factura"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            ¿Eliminar esta factura y todos sus artículos? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteInvoiceId(null)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" loading={deletingInvoice} onClick={confirmDeleteInvoice}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk delete invoices confirmation modal */}
      <Modal
        open={confirmDeleteInvoices}
        onClose={() => setConfirmDeleteInvoices(false)}
        title="Eliminar facturas"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            ¿Eliminar <span className="font-medium" style={{ color: "var(--text)" }}>{selectedInvoiceIds.size} factura{selectedInvoiceIds.size !== 1 ? "s" : ""}</span> y todos sus artículos? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteInvoices(false)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" loading={deletingInvoice} onClick={deleteSelectedInvoices}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* File viewer modal */}
      <Modal
        open={fileViewerUrl !== null || fileViewerLoading}
        onClose={() => { setFileViewerUrl(null); setFileViewerLoading(false); }}
        title="Archivo original"
        maxWidth="max-w-3xl"
      >
        <div className="min-h-[300px] flex items-center justify-center">
          {fileViewerLoading ? (
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
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
    </>
  );
}
