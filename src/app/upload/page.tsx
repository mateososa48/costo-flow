"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import UploadZone from "@/components/UploadZone";
import StepIndicator from "@/components/StepIndicator";
import Button from "@/components/ui/Button";
import type { Restaurant, ParseApiResponse, ExtractedInvoice, DropdownsResponse } from "@/types";

interface UploadFile {
  file: File;
  id: string;
}

interface InvoiceDraft {
  id: string;
  invoices: ExtractedInvoice[];
  savedAt: string;
}


export default function UploadPage() {
  const router = useRouter();
  const [restaurantOptions, setRestaurantOptions] = useState<Array<{ value: Restaurant; label: string }>>([]);
  const [restaurant, setRestaurant] = useState<Restaurant>("");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parseErrors, setParseErrors] = useState<Array<{ filename: string; error: string }>>([]);
  const [drafts, setDrafts] = useState<InvoiceDraft[]>([]);

  useEffect(() => {
    document.title = "Subir facturas — CostoFlow";
    try {
      const raw = localStorage.getItem("invoiceDrafts");
      if (raw) setDrafts(JSON.parse(raw));
    } catch { /* ignore */ }
    fetch("/api/config/dropdowns")
      .then((r) => r.json())
      .then((d: DropdownsResponse) => {
        if (d.restaurants?.length) {
          setRestaurantOptions(d.restaurants);
          setRestaurant(d.restaurants[0].value);
        }
      })
      .catch(() => {});
  }, []);

  function resumeDraft(draft: InvoiceDraft) {
    try {
      sessionStorage.setItem("invoices", JSON.stringify(draft.invoices));
      // Remove this draft from the list
      const updated = drafts.filter((d) => d.id !== draft.id);
      setDrafts(updated);
      localStorage.setItem("invoiceDrafts", JSON.stringify(updated));
    } catch { /* ignore */ }
    router.push("/review");
  }

  function deleteDraft(id: string) {
    const updated = drafts.filter((d) => d.id !== id);
    setDrafts(updated);
    try { localStorage.setItem("invoiceDrafts", JSON.stringify(updated)); } catch { /* ignore */ }
  }

  async function handleProcess() {
    if (files.length === 0) { setError("Agrega al menos una factura"); return; }
    setLoading(true);
    setError("");
    setParseErrors([]);
    try {
      const formData = new FormData();
      formData.append("restaurant", restaurant);
      for (const { file } of files) formData.append("files", file);

      const res = await fetch("/api/invoices/parse", { method: "POST", body: formData });
      if (res.status === 401) { router.push("/login"); return; }

      const data: ParseApiResponse = await res.json();
      if (!res.ok) { setError((data as unknown as { error: string }).error ?? "Error al procesar"); return; }

      if (data.errors && data.errors.length > 0) setParseErrors(data.errors);
      if (data.invoices.length === 0) { setError("No se pudieron extraer datos de ningún archivo"); return; }

      sessionStorage.setItem("invoices", JSON.stringify(data.invoices));
      if (data.errors && data.errors.length > 0) return;
      router.push("/review");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 space-y-7">
        <StepIndicator currentPath="/upload" />
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="font-display text-3xl md:text-4xl font-bold"
            style={{ color: "var(--text)" }}>
            Subir facturas
          </h1>
          <p className="text-base mt-2" style={{ color: "var(--text-muted)" }}>
            Arrastra PDFs o fotografías — la IA extrae los datos automáticamente
          </p>
        </div>

        {/* Restaurant selector */}
        <div className="animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <p className="text-sm font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Restaurante
          </p>
          <div className="flex flex-wrap gap-2">
            {restaurantOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRestaurant(opt.value)}
                className="px-5 py-2.5 rounded-[var(--radius-sm)] text-sm font-medium border transition-all duration-150 active:scale-[0.97]"
                style={restaurant === opt.value
                  ? { background: "var(--blue)", color: "white", borderColor: "var(--blue)" }
                  : { background: "var(--surface)", color: "var(--text-muted)", borderColor: "var(--border)" }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload zone */}
        <div className="animate-fade-up" style={{ animationDelay: "0.10s" }}>
          <UploadZone files={files} onChange={setFiles} />
        </div>

        {/* Parse errors */}
        {parseErrors.length > 0 && (
          <div className="rounded-[var(--radius)] border p-4 space-y-2 animate-fade-up"
            style={{ borderColor: "var(--danger)", background: "var(--danger-dim)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>
              {parseErrors.length} archivo{parseErrors.length !== 1 ? "s" : ""} no se pudo procesar:
            </p>
            {parseErrors.map((e) => (
              <p key={e.filename} className="text-xs" style={{ color: "var(--danger)" }}>
                <span className="font-mono">{e.filename}</span>: {e.error}
              </p>
            ))}
            <button
              onClick={() => router.push("/review")}
              className="text-xs underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: "var(--blue)" }}
            >
              Continuar con las facturas extraídas →
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm animate-fade-up" style={{ color: "var(--danger)" }}>{error}</p>
        )}

        {/* Submit */}
        <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <Button size="lg" className="w-full" loading={loading} disabled={files.length === 0} onClick={handleProcess}>
            {loading
              ? `Procesando ${files.length} factura${files.length !== 1 ? "s" : ""}...`
              : `Procesar ${files.length > 0 ? files.length : ""} factura${files.length !== 1 ? "s" : ""}`}
          </Button>
          {loading && (
            <p className="text-center text-sm mt-3" style={{ color: "var(--text-muted)" }}>
              Extrayendo datos con IA, puede tomar unos segundos por factura...
            </p>
          )}
        </div>

        {/* Drafts section */}
        {drafts.length > 0 && (
          <div className="animate-fade-up space-y-2" style={{ animationDelay: "0.20s" }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Borradores sin enviar
            </p>
            {drafts.map((draft) => {
              const restaurantKey = draft.invoices[0]?.restaurant;
              const restaurantLabel = restaurantKey
                ? (restaurantOptions.find((r) => r.value === restaurantKey)?.label ?? restaurantKey)
                : "—";
              const date = new Date(draft.savedAt).toLocaleDateString("es-MX", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              });
              return (
                <div key={draft.id} className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius)] border"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      {draft.invoices.length} factura{draft.invoices.length !== 1 ? "s" : ""} · {restaurantLabel}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Guardado el {date}</p>
                  </div>
                  <button
                    onClick={() => resumeDraft(draft)}
                    className="text-xs font-medium px-3 py-1.5 rounded-[var(--radius-sm)] transition-colors duration-150 flex-shrink-0"
                    style={{ color: "var(--blue)", background: "var(--blue-light)" }}
                  >
                    Continuar →
                  </button>
                  <button
                    onClick={() => deleteDraft(draft.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-md flex-shrink-0 transition-colors duration-150 hover-danger"
                    style={{ color: "var(--text-dim)" }}
                    aria-label="Eliminar borrador"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
