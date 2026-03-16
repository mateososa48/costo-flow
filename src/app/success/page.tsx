"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import StepIndicator from "@/components/StepIndicator";
import Button from "@/components/ui/Button";
import type { SubmitApiResponse } from "@/types";

export default function SuccessPage() {
  const router = useRouter();
  const [result, setResult] = useState<SubmitApiResponse | null>(null);

  useEffect(() => {
    document.title = "Facturas enviadas — Aventura Gourmet";
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

  const appended  = result.results.filter((r) => r.status === "appended");
  const errors    = result.results.filter((r) => r.status === "error");
  const urlSet    = new Set<string>();
  for (const r of appended) if (r.spreadsheetUrl) urlSet.add(r.spreadsheetUrl);
  const uniqueUrls = Array.from(urlSet);

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
          <h1 className="font-display text-4xl md:text-5xl font-bold"
            style={{ color: "var(--text)" }}>
            {appended.length === 1 ? "Factura enviada" : "Facturas enviadas"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {appended.length} fila{appended.length !== 1 ? "s" : ""} agregada{appended.length !== 1 ? "s" : ""} a Google Sheets
          </p>
        </div>

        {/* Sheet links */}
        {uniqueUrls.length > 0 && (
          <div className="rounded-[var(--radius-lg)] border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {uniqueUrls.map((url, i) => (
              <a
                key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover-surface"
                style={{
                  background: "var(--surface)",
                  borderBottom: i < uniqueUrls.length - 1 ? `1px solid var(--border)` : undefined,
                }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center border"
                  style={{ borderColor: "var(--success)", background: "var(--success-dim)" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "var(--success)" }}>
                    <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M1 5h12M5 5v8" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Ver hoja de cálculo</p>
                  <p className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>
                    {url.replace("https://docs.google.com/spreadsheets/d/", "").substring(0, 24)}...
                  </p>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "var(--text-muted)" }}>
                  <path d="M2.5 7H11.5M7.5 3L11.5 7L7.5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ))}
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded-[var(--radius)] border overflow-hidden"
            style={{ borderColor: "var(--danger)" }}>
            <div className="px-4 py-2.5" style={{ background: "var(--danger)", }}>
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
