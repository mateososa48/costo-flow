"use client";

import React, { useState } from "react";
import type { ExtractedInvoice } from "@/types";
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
  const color =
    pct >= 80 ? "text-emerald-400 bg-emerald-900/20 border-emerald-800/40" :
    pct >= 50 ? "text-amber-400 bg-amber-900/20 border-amber-800/40" :
                "text-red-400 bg-red-900/20 border-red-800/40";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
      {pct}% confianza
    </span>
  );
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(val);
}

export default function InvoiceCard({
  invoice,
  index,
  conceitoOptions,
  cuentaPnlOptions,
  onChange,
  onRemove,
}: InvoiceCardProps) {
  const [expanded, setExpanded] = useState(true);

  const update = (fields: Partial<ExtractedInvoice>) => {
    onChange({ ...invoice, ...fields });
  };

  const needsConcepto = !invoice.concepto;
  const needsCuentaPnl = !invoice.cuentaPnl;
  const hasRequiredGaps = needsConcepto || needsCuentaPnl;

  return (
    <div
      className={[
        "rounded-[var(--radius-lg)] border bg-[var(--surface)]",
        "shadow-[var(--shadow-card)]",
        "transition-all duration-200",
        hasRequiredGaps
          ? "border-amber-700/40"
          : "border-[var(--border)]",
      ].join(" ")}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Number badge */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--navy)] text-[var(--gold)] text-xs font-semibold flex items-center justify-center">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--text)] truncate">
              {invoice.supplier || "Proveedor desconocido"}
            </span>
            {invoice.invoiceNumber && (
              <span className="text-xs text-[var(--text-muted)] font-mono">
                #{invoice.invoiceNumber}
              </span>
            )}
            {hasRequiredGaps && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-700/40 bg-amber-900/15 text-[10px] font-medium text-amber-400">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                  <path d="M4 0L0 8h8L4 0zm0 6.5a.5.5 0 110 1 .5.5 0 010-1zm-.5-3h1v2.5h-1V3.5z" />
                </svg>
                Requiere selección
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-[var(--text-muted)]">{invoice.invoiceDate}</span>
            <span className="text-xs font-medium text-[var(--gold)]">
              {formatCurrency(invoice.total)}
            </span>
            <ConfidenceBadge confidence={invoice.extractionConfidence} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 hover:bg-red-900/20 transition-all duration-150"
              aria-label="Eliminar factura"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 2l9 9M11 2L2 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-raised)] transition-all duration-150"
            aria-label={expanded ? "Colapsar" : "Expandir"}
            onClick={() => setExpanded((v) => !v)}
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

      {/* Card body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--border-subtle)]">
          {/* Row 1: Date + Supplier + Invoice # */}
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

          {/* Comments */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Comentarios adicionales
            </label>
            <textarea
              value={invoice.comments ?? ""}
              placeholder="Notas opcionales..."
              rows={2}
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text)] text-sm placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--gold-dim)] focus:ring-1 focus:ring-[var(--gold-dim)]/30 resize-none transition-colors duration-150"
              onChange={(e) => update({ comments: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
