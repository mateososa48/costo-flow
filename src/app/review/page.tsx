"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import InvoiceCard from "@/components/InvoiceCard";
import DuplicateWarningModal from "@/components/DuplicateWarningModal";
import StepIndicator from "@/components/StepIndicator";
import Button from "@/components/ui/Button";
import type {
  ExtractedInvoice,
  DropdownsResponse,
  SubmitApiBody,
  SubmitApiResponse,
  DuplicateMatch,
  Restaurant,
} from "@/types";


interface DuplicateWarning {
  invoiceId: string;
  supplier: string;
  duplicates: DuplicateMatch[];
}

function saveDraft(invoices: ExtractedInvoice[]) {
  if (invoices.length === 0) return;
  try {
    const existing: Array<{ id: string; invoices: ExtractedInvoice[]; savedAt: string }> =
      JSON.parse(localStorage.getItem("invoiceDrafts") ?? "[]");
    const draft = { id: crypto.randomUUID(), invoices, savedAt: new Date().toISOString() };
    // Keep at most 5 most recent drafts
    localStorage.setItem("invoiceDrafts", JSON.stringify([draft, ...existing].slice(0, 5)));
  } catch { /* ignore */ }
}

function appendToHistory(invoices: ExtractedInvoice[], results: SubmitApiResponse) {
  try {
    const existing = JSON.parse(localStorage.getItem("invoiceHistory") ?? "[]");
    const newEntries = results.results
      .filter((r) => r.status === "saved")
      .map((r) => {
        const inv = invoices.find((i) => i.id === r.invoiceId);
        return {
          supplier: inv?.supplier ?? "—",
          restaurant: inv?.restaurant ?? "—",
          total: inv?.total ?? 0,
          invoiceDate: inv?.invoiceDate ?? "—",
          submittedAt: new Date().toISOString(),
          sheetUrl: r.sheetUrl ?? null,
        };
      });
    localStorage.setItem("invoiceHistory", JSON.stringify([...newEntries, ...existing]));
  } catch { /* ignore */ }
}

export default function ReviewPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [dropdowns, setDropdowns] = useState<DropdownsResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant>("");

  function updateRestaurant(r: Restaurant) {
    setRestaurant(r);
    setInvoices((prev) => prev.map((inv) => ({ ...inv, restaurant: r })));
  }

  useEffect(() => {
    document.title = "Revisar facturas — CostoFlow";
    const raw = sessionStorage.getItem("invoices");
    if (!raw) { router.push("/upload"); return; }
    try {
      const parsed = JSON.parse(raw) as ExtractedInvoice[];
      setInvoices(parsed);
      if (parsed[0]?.restaurant) setRestaurant(parsed[0].restaurant as Restaurant);
    } catch {
      router.push("/upload");
    }
    fetch("/api/config/dropdowns")
      .then((r) => r.json())
      .then((data: DropdownsResponse) => {
        setDropdowns(data);
        setRestaurant((prev) => prev || data.restaurants?.[0]?.value || "");
      })
      .catch(() => {});
  }, [router]);

  const updateInvoice = useCallback((index: number, updated: ExtractedInvoice) => {
    setInvoices((prev) => { const next = [...prev]; next[index] = updated; return next; });
  }, []);

  const removeInvoice = useCallback((id: string) => {
    setRemovingIds((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      setRemovingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 250);
  }, []);

  const validConceptoSet = new Set((dropdowns?.concepto ?? []) as string[]);
  const validCuentaPnlSet = new Set((dropdowns?.cuentaPnl ?? []) as string[]);
  const isInvoiceValid = (inv: ExtractedInvoice) =>
    validConceptoSet.size > 0
      ? validConceptoSet.has(inv.concepto) && validCuentaPnlSet.has(inv.cuentaPnl)
      : inv.concepto && inv.cuentaPnl;
  const allValid = invoices.every(isInvoiceValid);
  const pendingCount = invoices.filter((inv) => !isInvoiceValid(inv)).length;

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
      if (res.status === 401) { router.push("/login"); return; }
      const data: SubmitApiResponse = await res.json();
      if (!res.ok) { setSubmitError((data as unknown as { error: string }).error ?? "Error al enviar"); return; }

      const warnings: DuplicateWarning[] = [];
      for (const result of data.results) {
        if (result.status === "duplicate_warning" && result.duplicateMatches) {
          const inv = invoices.find((i) => i.id === result.invoiceId);
          if (inv) warnings.push({ invoiceId: result.invoiceId, supplier: inv.supplier, duplicates: result.duplicateMatches });
        }
      }
      if (warnings.length > 0 && !bypass) { setDuplicateWarnings(warnings); return; }

      // Surface hard failures (Supabase write errors) — sheet sync failures are non-blocking
      const failed = data.results.filter((r) => r.status === "error");
      if (failed.length > 0) {
        const msg = failed.map((r) => r.error ?? "Error desconocido").join("\n");
        setSubmitError(msg);
        return;
      }

      appendToHistory(invoices, data);
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
      <Shell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Sticky review header */}
      <div className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between gap-4"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => { saveDraft(invoices); router.push("/upload"); }}
            className="flex-shrink-0 p-1.5 rounded-md transition-colors duration-150"
            style={{ color: "var(--text-muted)" }}
            aria-label="Volver"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 4L7 10l5.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="font-display text-xl font-bold" style={{ color: "var(--text)" }}>
            Revisar facturas
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {pendingCount > 0 && (
            <span className="text-xs hidden sm:block" style={{ color: "var(--warning)" }}>
              {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
            </span>
          )}
          <Button size="sm" disabled={!allValid || submitting} loading={submitting} onClick={() => doSubmit(false)}>
            Enviar todo
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Step indicator */}
        <StepIndicator currentPath="/review" />
        {/* Stats */}
        <div className="flex items-center justify-between gap-2 text-sm animate-fade-up">
          <div className="flex flex-wrap items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <span>{invoices.length} factura{invoices.length !== 1 ? "s" : ""}</span>
            <span className="w-px h-4 hidden sm:block" style={{ background: "var(--border)" }} />
            <span className="flex items-center gap-1.5">
              Total:
              <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-sm font-bold"
                style={{ background: "var(--blue-light)", color: "var(--blue)" }}>
                {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
                  invoices.reduce((sum, inv) => sum + inv.total, 0)
                )}
              </span>
            </span>
            {pendingCount > 0 && (
              <span style={{ color: "var(--warning)" }}>{pendingCount} sin categoría</span>
            )}
          </div>
          {/* Restaurant selector */}
          <select
            value={restaurant}
            onChange={(e) => updateRestaurant(e.target.value as Restaurant)}
            className="flex-shrink-0 text-[11px] font-medium px-2 py-1 rounded-[var(--radius-sm)] border appearance-none cursor-pointer transition-colors duration-150 focus:outline-none focus:ring-2 max-w-[110px]"
            style={{
              background: "var(--blue-light)",
              borderColor: "var(--blue-light)",
              color: "var(--blue)",
            }}
          >
            {(dropdowns?.restaurants ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Cards */}
        <div className="space-y-3 stagger">
          {invoices.map((invoice, index) => (
            <div
              key={invoice.id}
              style={{
                transition: "opacity 0.25s ease, transform 0.25s ease, max-height 0.25s ease, margin 0.25s ease",
                opacity: removingIds.has(invoice.id) ? 0 : 1,
                transform: removingIds.has(invoice.id) ? "translateX(-10px) scale(0.99)" : "translateX(0) scale(1)",
                maxHeight: removingIds.has(invoice.id) ? "0" : "2000px",
                overflow: "hidden",
                marginBottom: removingIds.has(invoice.id) ? "0" : undefined,
              }}
            >
              <InvoiceCard
                invoice={invoice}
                index={index}
                conceitoOptions={conceitoOptions}
                cuentaPnlOptions={cuentaPnlOptions}
                onChange={(updated) => updateInvoice(index, updated)}
                onRemove={invoices.length > 1 ? () => removeInvoice(invoice.id) : undefined}
              />
            </div>
          ))}
        </div>

        {submitError && (
          <div className="p-4 rounded-[var(--radius)] border animate-fade-up"
            style={{ borderColor: "var(--danger)", background: "var(--danger-dim)" }}>
            <p className="text-sm" style={{ color: "var(--danger)" }}>{submitError}</p>
          </div>
        )}

        {!allValid && (
          <p className="text-sm text-center animate-fade-up" style={{ color: "var(--warning)" }}>
            Selecciona Concepto y Cuenta P&L para todas las facturas antes de enviar
          </p>
        )}

        <div className="border-t pt-4 animate-fade-up" style={{ borderColor: "var(--border)" }}>
          <Button
            size="lg"
            className="w-full"
            disabled={!allValid || submitting}
            loading={submitting}
            onClick={() => doSubmit(false)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="flex-shrink-0" style={{ opacity: 0.85 }}>
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Registrar {invoices.length} factura{invoices.length !== 1 ? "s" : ""}
            {restaurant && <span className="hidden sm:inline"> — {dropdowns?.restaurants?.find((r) => r.value === restaurant)?.label ?? restaurant}</span>}
          </Button>
        </div>
      </div>

      <DuplicateWarningModal
        open={duplicateWarnings.length > 0}
        matches={duplicateWarnings}
        onCancel={() => setDuplicateWarnings([])}
        onProceed={() => { setDuplicateWarnings([]); doSubmit(true); }}
      />
    </Shell>
  );
}
