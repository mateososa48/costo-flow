"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InvoiceCard from "@/components/InvoiceCard";
import DuplicateWarningModal from "@/components/DuplicateWarningModal";
import Button from "@/components/ui/Button";
import type {
  ExtractedInvoice,
  DropdownsResponse,
  SubmitApiBody,
  SubmitApiResponse,
  DuplicateMatch,
} from "@/types";

interface DuplicateWarning {
  invoiceId: string;
  supplier: string;
  duplicates: DuplicateMatch[];
}

export default function ReviewPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
  const [dropdowns, setDropdowns] = useState<DropdownsResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);

  useEffect(() => {
    // Load invoices from sessionStorage
    const raw = sessionStorage.getItem("invoices");
    if (!raw) {
      router.push("/upload");
      return;
    }
    try {
      setInvoices(JSON.parse(raw) as ExtractedInvoice[]);
    } catch {
      router.push("/upload");
    }

    // Load dropdown options
    fetch("/api/config/dropdowns")
      .then((r) => r.json())
      .then((data: DropdownsResponse) => setDropdowns(data))
      .catch(() => {});
  }, [router]);

  const updateInvoice = useCallback((index: number, updated: ExtractedInvoice) => {
    setInvoices((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }, []);

  const removeInvoice = useCallback((index: number) => {
    setInvoices((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const allValid = invoices.every((inv) => inv.concepto && inv.cuentaPnl);

  async function doSubmit(bypass = false) {
    setSubmitting(true);
    setSubmitError("");
    try {
      const body: SubmitApiBody = { invoices, bypassDuplicates: bypass };
      const res = await fetch("/api/invoices/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data: SubmitApiResponse = await res.json();

      if (!res.ok) {
        setSubmitError((data as unknown as { error: string }).error ?? "Error al enviar");
        return;
      }

      // Check for duplicate warnings in results
      const warnings: DuplicateWarning[] = [];
      for (const result of data.results) {
        if (result.status === "duplicate_warning" && result.duplicateMatches) {
          const inv = invoices.find((i) => i.id === result.invoiceId);
          if (inv) {
            warnings.push({
              invoiceId: result.invoiceId,
              supplier: inv.supplier,
              duplicates: result.duplicateMatches,
            });
          }
        }
      }

      if (warnings.length > 0 && !bypass) {
        setDuplicateWarnings(warnings);
        return;
      }

      // Store results and navigate to success
      sessionStorage.setItem("submitResult", JSON.stringify(data));
      sessionStorage.removeItem("invoices");
      router.push("/success");
    } catch {
      setSubmitError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  const conceitoOptions = (dropdowns?.concepto ?? []).map((v) => ({ value: v, label: v }));
  const cuentaPnlOptions = (dropdowns?.cuentaPnl ?? []).map((v) => ({ value: v, label: v }));

  if (invoices.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingCount = invoices.filter((inv) => !inv.concepto || !inv.cuentaPnl).length;

  return (
    <>
      {/* Sticky nav */}
      <nav className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/upload")}
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-150 flex-shrink-0"
              aria-label="Volver"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12.5 4L7 10l5.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span
              className="font-display text-xl font-light text-[var(--text)] truncate"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Revisar facturas
            </span>
            <span className="flex-shrink-0 text-xs text-[var(--text-muted)] bg-[var(--surface-raised)] border border-[var(--border)] rounded-full px-2 py-0.5">
              {invoices.length}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {pendingCount > 0 && (
              <span className="text-xs text-amber-400 hidden sm:block">
                {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
              </span>
            )}
            <Button
              size="sm"
              disabled={!allValid || submitting}
              loading={submitting}
              onClick={() => doSubmit(false)}
            >
              Enviar todo
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Stats bar */}
        <div className="flex items-center gap-4 text-sm text-[var(--text-muted)] animate-fade-up">
          <span>{invoices.length} factura{invoices.length !== 1 ? "s" : ""}</span>
          <span className="w-px h-4 bg-[var(--border)]" />
          <span>
            Total:{" "}
            <span className="text-[var(--gold)] font-medium">
              {new Intl.NumberFormat("es-MX", {
                style: "currency",
                currency: "MXN",
              }).format(invoices.reduce((sum, inv) => sum + inv.total, 0))}
            </span>
          </span>
          {pendingCount > 0 && (
            <>
              <span className="w-px h-4 bg-[var(--border)]" />
              <span className="text-amber-400">{pendingCount} sin categoría</span>
            </>
          )}
        </div>

        {/* Invoice cards */}
        <div className="space-y-3 stagger">
          {invoices.map((invoice, index) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              index={index}
              conceitoOptions={conceitoOptions}
              cuentaPnlOptions={cuentaPnlOptions}
              onChange={(updated) => updateInvoice(index, updated)}
              onRemove={invoices.length > 1 ? () => removeInvoice(index) : undefined}
            />
          ))}
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="p-4 rounded-[var(--radius)] border border-red-800/40 bg-[var(--danger-dim)] animate-fade-up">
            <p className="text-sm text-red-400">{submitError}</p>
          </div>
        )}

        {/* Bottom submit */}
        {!allValid && (
          <p className="text-sm text-amber-400 text-center animate-fade-up">
            Selecciona Concepto y Cuenta P&L para todas las facturas antes de enviar
          </p>
        )}

        <Button
          size="lg"
          className="w-full animate-fade-up"
          disabled={!allValid || submitting}
          loading={submitting}
          onClick={() => doSubmit(false)}
        >
          Enviar {invoices.length} factura{invoices.length !== 1 ? "s" : ""} a Google Sheets
        </Button>
      </main>

      {/* Duplicate warning modal */}
      <DuplicateWarningModal
        open={duplicateWarnings.length > 0}
        matches={duplicateWarnings}
        onCancel={() => setDuplicateWarnings([])}
        onProceed={() => {
          setDuplicateWarnings([]);
          doSubmit(true);
        }}
      />
    </>
  );
}
