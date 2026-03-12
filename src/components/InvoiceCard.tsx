"use client";

import React, { useState } from "react";
import type { ExtractedInvoice, LineItem } from "@/types";
import Input from "./ui/Input";
import Select from "./ui/Select";

interface InvoiceCardProps {
  invoice: ExtractedInvoice;
  index: number;
  conceitoOptions: Array<{ value: string; label: string }>;
  cuentaPnlOptions: Array<{ value: string; label: string }>;
  onChange: (updated: ExtractedInvoice) => void;
  onRemove?: () => void;
}

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  const style =
    pct >= 80
      ? { color: "var(--success)", background: "var(--success-dim)", border: "1px solid rgba(22,163,74,0.2)" }
      : pct >= 50
      ? { color: "var(--warning)", background: "var(--warning-dim)", border: "1px solid rgba(217,119,6,0.2)" }
      : { color: "var(--danger)", background: "var(--danger-dim)", border: "1px solid rgba(220,38,38,0.2)" };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={style}>
      <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
      {pct}% confianza
    </span>
  );
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(val);
}


export default function InvoiceCard({
  invoice,
  index,
  conceitoOptions,
  cuentaPnlOptions,
  onChange,
  onRemove,
}: InvoiceCardProps) {
  const needsConcepto   = !invoice.concepto;
  const needsCuentaPnl  = !invoice.cuentaPnl;
  const hasRequiredGaps = needsConcepto || needsCuentaPnl;

  const [expanded, setExpanded] = useState(hasRequiredGaps);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const update = (fields: Partial<ExtractedInvoice>) => onChange({ ...invoice, ...fields });

  return (
    <div
      className="rounded-[var(--radius)] border transition-all duration-200"
      style={{
        background: "var(--surface)",
        borderColor: hasRequiredGaps ? "var(--warning)" : "var(--border)",
        boxShadow: "var(--shadow-card)",
        animationDelay: `${index * 0.05}s`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Number badge */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
          style={{ background: "var(--pink-dark)" }}>
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
              {invoice.supplier || "Proveedor desconocido"}
            </span>
            {invoice.invoiceNumber && (
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                #{invoice.invoiceNumber}
              </span>
            )}
            {hasRequiredGaps && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ color: "var(--warning)", background: "var(--warning-dim)", border: "1px solid rgba(217,119,6,0.2)" }}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                  <path d="M4 0L0 8h8L4 0zm0 6.5a.5.5 0 110 1 .5.5 0 010-1zm-.5-3h1v2.5h-1V3.5z" />
                </svg>
                Requiere selección
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{invoice.invoiceDate}</span>
            <span className="text-xs font-semibold" style={{ color: "var(--blue)" }}>
              {formatCurrency(invoice.total)}
            </span>
            <ConfidenceBadge confidence={invoice.extractionConfidence} />
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {onRemove && !confirmingRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmingRemove(true); }}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150"
              style={{ color: "var(--text-dim)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--danger)"; (e.currentTarget as HTMLElement).style.background = "var(--danger-dim)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-dim)"; (e.currentTarget as HTMLElement).style.background = ""; }}
              aria-label="Eliminar factura"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 2l9 9M11 2L2 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {onRemove && confirmingRemove && (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>¿Eliminar?</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="text-xs font-medium px-2 py-1 rounded transition-all duration-150"
                style={{ background: "var(--danger)", color: "white" }}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setConfirmingRemove(false); }}
                className="text-xs font-medium px-2 py-1 rounded transition-all duration-150"
                style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}
              >
                No
              </button>
            </div>
          )}
          <button
            type="button"
            className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150"
            style={{ color: "var(--text-muted)" }}
            aria-label={expanded ? "Colapsar" : "Expandir"}
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          >
            <svg
              width="13" height="13" viewBox="0 0 13 13" fill="none"
              className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M2.5 5L6.5 9L10.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Fecha de factura"
              type="date"
              value={invoice.invoiceDate}
              onChange={(e) => update({ invoiceDate: e.target.value })}
            />
            <div className="sm:col-span-2">
              <Input
                label="Proveedor"
                type="text"
                value={invoice.supplier}
                placeholder="Nombre del proveedor"
                onChange={(e) => update({ supplier: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Nº de factura"
              type="text"
              value={invoice.invoiceNumber ?? ""}
              placeholder="Folio (opcional)"
              onChange={(e) => update({ invoiceNumber: e.target.value || undefined })}
            />
            <Input
              label="Importe (sin IVA)"
              type="number"
              value={invoice.importe}
              min={0}
              step="0.01"
              onChange={(e) => update({ importe: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="IVA"
              type="number"
              value={invoice.iva}
              min={0}
              step="0.01"
              onChange={(e) => update({ iva: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {invoice.mathWarning && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-[var(--radius-sm)] text-xs"
              style={{ background: "var(--warning-dim, rgba(234,179,8,0.12))", border: "1px solid var(--warning, #ca8a04)", color: "var(--warning, #ca8a04)" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
                <path d="M8 2L1.5 13.5h13L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <line x1="8" y1="6.5" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
              </svg>
              <span>Los números no cuadran: Importe + IVA ≠ Total. Verifica los valores antes de enviar.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Total"
              type="number"
              value={invoice.total}
              min={0}
              step="0.01"
              onChange={(e) => update({ total: parseFloat(e.target.value) || 0 })}
            />
            <Select
              label="Concepto"
              value={invoice.concepto}
              options={conceitoOptions}
              placeholder="Selecciona concepto..."
              error={needsConcepto ? "Requerido" : undefined}
              onChange={(e) => update({ concepto: e.target.value })}
            />
            <Select
              label="Cuenta P&L"
              value={invoice.cuentaPnl}
              options={cuentaPnlOptions}
              placeholder="Selecciona cuenta..."
              error={needsCuentaPnl ? "Requerido" : undefined}
              onChange={(e) => update({ cuentaPnl: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Comentarios adicionales
            </label>
            <textarea
              value={invoice.comments ?? ""}
              placeholder="Notas opcionales..."
              rows={2}
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border text-sm resize-none transition-colors duration-150 focus:outline-none focus:ring-2"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              onChange={(e) => update({ comments: e.target.value })}
            />
          </div>

          {/* Line Items Section */}
          <LineItemsSection
            items={invoice.lineItems ?? []}
            onChange={(items) => update({ lineItems: items })}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Line Items Sub-section ─────────────────────────────────────── */

function LineItemsSection({
  items,
  onChange,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}) {
  const [showItems, setShowItems] = useState(false);

  const updateItem = (idx: number, fields: Partial<LineItem>) => {
    const updated = items.map((item, i) => (i === idx ? { ...item, ...fields } : item));
    onChange(updated);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    onChange([...items, { description: "", quantity: null, unit: null, unitNormalized: null, unitPrice: null, total: 0, category: null }]);
    setShowItems(true);
  };

  return (
    <div className="border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left group"
        onClick={() => setShowItems((v) => !v)}
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`transition-transform duration-200 ${showItems ? "rotate-90" : ""}`}
          style={{ color: "var(--text-muted)" }}
        >
          <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Artículos extraídos
        </span>
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold"
          style={{ background: "var(--blue-light)", color: "var(--blue)" }}
        >
          {items.length}
        </span>
      </button>

      {showItems && (
        <div className="mt-3 space-y-2">
          {items.length > 0 && (
            <div className="hidden sm:grid grid-cols-[1fr_auto] gap-2 px-2.5 pb-1">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2">
                {["Descripción", "Cantidad", "Unidad", "P. Unit.", "Total"].map((h) => (
                  <span key={h} className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</span>
                ))}
              </div>
            </div>
          )}
          {items.length === 0 && (
            <p className="text-xs py-2" style={{ color: "var(--text-dim)" }}>
              No se detectaron artículos individuales.
            </p>
          )}

          {items.map((item, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_auto] gap-2 p-2.5 rounded-[var(--radius-sm)] border"
              style={{ background: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 items-center">
                <input
                  type="text"
                  value={item.description}
                  placeholder="Descripción"
                  className="w-full px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)", focusRingColor: "var(--blue)" } as React.CSSProperties}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                />
                <input
                  type="number"
                  value={item.quantity ?? ""}
                  placeholder="Cant."
                  step="any"
                  className="w-full px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                  onChange={(e) => updateItem(idx, { quantity: e.target.value ? parseFloat(e.target.value) : null })}
                />
                <input
                  type="text"
                  value={item.unit ?? ""}
                  placeholder="Unidad"
                  className="w-full px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                  onChange={(e) => updateItem(idx, { unit: e.target.value || null })}
                />
                <input
                  type="number"
                  value={item.unitPrice ?? ""}
                  placeholder="P. Unit."
                  step="0.01"
                  className="w-full px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                  onChange={(e) => updateItem(idx, { unitPrice: e.target.value ? parseFloat(e.target.value) : null })}
                />
                <input
                  type="number"
                  value={item.total}
                  placeholder="Total"
                  step="0.01"
                  className="w-full px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                  onChange={(e) => updateItem(idx, { total: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <button
                type="button"
                className="self-center w-6 h-6 rounded flex items-center justify-center transition-colors duration-150"
                style={{ color: "var(--text-dim)" }}
                onClick={() => removeItem(idx)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--danger)"; (e.currentTarget as HTMLElement).style.background = "var(--danger-dim)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-dim)"; (e.currentTarget as HTMLElement).style.background = ""; }}
                aria-label="Eliminar artículo"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}

          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors duration-150"
            style={{ color: "var(--blue)", background: "var(--blue-light)" }}
            onClick={addItem}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--blue)"; (e.currentTarget as HTMLElement).style.color = "white"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--blue-light)"; (e.currentTarget as HTMLElement).style.color = "var(--blue)"; }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Agregar artículo
          </button>
        </div>
      )}
    </div>
  );
}
