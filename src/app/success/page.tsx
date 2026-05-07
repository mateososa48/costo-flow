"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import StepIndicator from "@/components/StepIndicator";
import Button from "@/components/ui/Button";
import type { SubmitApiResponse, SubmitResult } from "@/types";

function SheetBadge({ result }: { result: SubmitResult }) {
  if (!result.sheetSyncStatus || result.sheetSyncStatus === "skipped") return null;

  if (result.sheetSyncStatus === "synced") {
    return (
      <a
        href={result.sheetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-80"
        style={{ background: "var(--success-dim)", color: "var(--success)" }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <rect x="0.5" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1"/>
          <path d="M0.5 3.5h9M3.5 3.5v6" stroke="currentColor" strokeWidth="1"/>
        </svg>
        Google Sheets
      </a>
    );
  }

  if (result.sheetSyncStatus === "failed") {
    return (
      <button
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer transition-opacity hover:opacity-80"
        style={{ background: "var(--warning-dim, #fef3c7)", color: "var(--warning)" }}
        onClick={async () => {
          try {
            await fetch(`/api/invoices/${result.invoiceId}/sync-sheet`, { method: "POST" });
            window.location.reload();
          } catch { /* ignore */ }
        }}
      >
        ⚠ Sheets: reintentar
      </button>
    );
  }

  return null;
}

export default function SuccessPage() {
  const router = useRouter();
  const [result, setResult] = useState<SubmitApiResponse | null>(null);

  useEffect(() => {
    document.title = "Facturas registradas — CostoFlow";
    const raw = sessionStorage.getItem("submitResult");
    if (!raw) { router.push("/upload"); return; }
    try { setResult(JSON.parse(raw) as SubmitApiResponse); }
    catch { router.push("/upload"); }
  }, [router]);

  if (!result) {
    return (
      <Shell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
        </div>
      </Shell>
    );
  }

  const saved  = result.results.filter((r) => r.status === "saved");
  const errors = result.results.filter((r) => r.status === "error");
  const syncedCount = saved.filter((r) => r.sheetSyncStatus === "synced").length;
  const failedSyncCount = saved.filter((r) => r.sheetSyncStatus === "failed").length;

  return (
    <Shell>
      <div className="max-w-xl mx-auto px-4 py-12 md:py-16 space-y-6 animate-fade-up">
        <StepIndicator currentPath="/success" />

        {/* Success icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center border"
            style={{ borderColor: "var(--success)", background: "var(--success-dim)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: "var(--success)" }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <div className="text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold" style={{ color: "var(--text)" }}>
            {saved.length === 1 ? "Factura registrada" : "Facturas registradas"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {saved.length} factura{saved.length !== 1 ? "s" : ""} guardada{saved.length !== 1 ? "s" : ""} correctamente
          </p>
        </div>

        {/* Per-invoice results */}
        {saved.length > 0 && (
          <div className="rounded-[var(--radius-lg)] border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {saved.map((r, i) => (
              <div
                key={r.invoiceId}
                className="flex items-center justify-between gap-3 px-4 py-3"
                style={{
                  background: "var(--surface)",
                  borderBottom: i < saved.length - 1 ? `1px solid var(--border)` : undefined,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "var(--success)", flexShrink: 0 }}>
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M4.5 7l1.8 1.8L9.5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-sm font-mono truncate" style={{ color: "var(--text-muted)" }}>
                    {r.invoiceId.slice(0, 8)}…
                  </span>
                </div>
                <SheetBadge result={r} />
              </div>
            ))}
          </div>
        )}

        {/* Sheet sync summary (only if at least one synced or failed) */}
        {(syncedCount > 0 || failedSyncCount > 0) && (
          <div className="rounded-[var(--radius)] border px-4 py-3 flex items-center gap-3"
            style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
              <rect x="1" y="1" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M1 5.5h14M5.5 5.5v9.5" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {syncedCount > 0 && `${syncedCount} sincronizada${syncedCount !== 1 ? "s" : ""} con Google Sheets`}
              {syncedCount > 0 && failedSyncCount > 0 && " · "}
              {failedSyncCount > 0 && `${failedSyncCount} no se pudo${failedSyncCount !== 1 ? "n" : ""} sincronizar (usa Reintentar arriba)`}
            </p>
          </div>
        )}

        {/* Hard errors */}
        {errors.length > 0 && (
          <div className="rounded-[var(--radius)] border overflow-hidden" style={{ borderColor: "var(--danger)" }}>
            <div className="px-4 py-2.5" style={{ background: "var(--danger)" }}>
              <p className="text-sm font-semibold text-white">
                {errors.length} factura{errors.length !== 1 ? "s" : ""} con error
              </p>
            </div>
            {errors.map((r) => (
              <div key={r.invoiceId} className="px-4 py-3 space-y-1" style={{ background: "var(--danger-dim)" }}>
                <p className="text-xs font-medium" style={{ color: "var(--danger)" }}>¿Cómo solucionarlo?</p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--danger)" }}>{r.error}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="secondary" size="lg" className="flex-1"
            onClick={() => { sessionStorage.removeItem("submitResult"); router.push("/upload"); }}>
            Subir más facturas
          </Button>
          <Button variant="ghost" size="lg" className="flex-1 sm:flex-none" onClick={() => router.push("/history")}>
            Ver historial
          </Button>
        </div>
      </div>
    </Shell>
  );
}
