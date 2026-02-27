"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import type { SubmitApiResponse, SubmitResult } from "@/types";

export default function SuccessPage() {
  const router = useRouter();
  const [result, setResult] = useState<SubmitApiResponse | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("submitResult");
    if (!raw) {
      router.push("/upload");
      return;
    }
    try {
      setResult(JSON.parse(raw) as SubmitApiResponse);
    } catch {
      router.push("/upload");
    }
  }, [router]);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const appended = result.results.filter((r) => r.status === "appended");
  const errors = result.results.filter((r) => r.status === "error");

  // Unique spreadsheet URLs
  const urlSet = new Set<string>();
  for (const r of appended) {
    if (r.spreadsheetUrl) urlSet.add(r.spreadsheetUrl);
  }
  const uniqueUrls = Array.from(urlSet);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-10"
          style={{ background: "radial-gradient(ellipse, #3d9970 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-up space-y-6">
        {/* Success icon */}
        <div className="flex justify-center">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(61,153,112,0.25) 0%, transparent 70%)",
                animation: "pulse-ring 2s ease-out infinite",
              }}
            />
            <div className="w-16 h-16 rounded-full bg-[#3d9970]/15 border border-[#3d9970]/40 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3d9970" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </div>

        {/* Heading */}
        <div className="text-center">
          <h1
            className="font-display text-4xl font-light tracking-tight text-[var(--text)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {appended.length === 1 ? "Factura enviada" : "Facturas enviadas"}
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {appended.length} fila{appended.length !== 1 ? "s" : ""} agregada{appended.length !== 1 ? "s" : ""} a Google Sheets
          </p>
        </div>

        {/* Sheet links */}
        {uniqueUrls.length > 0 && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {uniqueUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--surface-raised)] transition-colors duration-150 group first:rounded-t-[var(--radius-lg)] last:rounded-b-[var(--radius-lg)]"
              >
                {/* Sheets icon */}
                <div className="flex-shrink-0 w-8 h-8 rounded-md bg-[#3d9970]/15 border border-[#3d9970]/30 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="12" height="12" rx="2" stroke="#3d9970" strokeWidth="1.2" />
                    <path d="M1 5h12M5 5v8" stroke="#3d9970" strokeWidth="1.2" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text)] truncate">Ver hoja de cálculo</p>
                  <p className="text-xs text-[var(--text-muted)] truncate font-mono">{url.replace("https://docs.google.com/spreadsheets/d/", "").substring(0, 20)}...</p>
                </div>
                <svg className="flex-shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors duration-150" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7H11.5M7.5 3L11.5 7L7.5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ))}
          </div>
        )}

        {/* Errors (if any) */}
        {errors.length > 0 && (
          <div className="rounded-[var(--radius)] border border-red-800/40 bg-[var(--danger-dim)] p-4 space-y-1">
            <p className="text-sm font-medium text-red-400">
              {errors.length} factura{errors.length !== 1 ? "s" : ""} con error:
            </p>
            {errors.map((r) => (
              <p key={r.invoiceId} className="text-xs text-red-300">{r.error}</p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={() => {
              sessionStorage.removeItem("submitResult");
              router.push("/upload");
            }}
          >
            Subir más facturas
          </Button>
        </div>
      </div>
    </main>
  );
}
