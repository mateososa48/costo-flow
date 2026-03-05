"use client";

import React from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import type { DuplicateMatch } from "@/types";

interface DuplicateWarningModalProps {
  open: boolean;
  matches: Array<{ invoiceId: string; supplier: string; duplicates: DuplicateMatch[] }>;
  onCancel: () => void;
  onProceed: () => void;
}

export default function DuplicateWarningModal({
  open,
  matches,
  onCancel,
  onProceed,
}: DuplicateWarningModalProps) {
  return (
    <Modal open={open} title="Posible duplicado detectado" onClose={onCancel}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-[var(--radius-sm)] bg-[var(--warning-dim)] border border-[var(--warning)]/30">
          <svg
            className="flex-shrink-0 mt-0.5 text-[var(--warning)]"
            width="16" height="16" viewBox="0 0 16 16" fill="none"
          >
            <path d="M8 1.5L14.5 14H1.5L8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M8 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
          </svg>
          <p className="text-sm text-[var(--warning)] leading-relaxed">
            Se encontraron filas que podrían coincidir con{" "}
            {matches.length === 1 ? "esta factura" : "estas facturas"} en la hoja de destino.
            Revisa antes de continuar.
          </p>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {matches.map(({ invoiceId, supplier, duplicates }) => (
            <div key={invoiceId} className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                {supplier}
              </p>
              {duplicates.map((dup, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border)]"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm text-[var(--text)]">
                      {dup.supplier}
                      {dup.invoiceNumber && (
                        <span className="ml-2 text-xs text-[var(--text-muted)] font-mono">
                          #{dup.invoiceNumber}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{dup.invoiceDate}</p>
                  </div>
                  <span className="text-sm font-medium text-[var(--warning)]">
                    ${dup.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Cancelar y revisar
          </Button>
          <Button variant="danger" className="flex-1" onClick={onProceed}>
            Proceder de todas formas
          </Button>
        </div>
      </div>
    </Modal>
  );
}
