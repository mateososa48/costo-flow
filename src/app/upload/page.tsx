"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UploadZone from "@/components/UploadZone";
import Button from "@/components/ui/Button";
import type { DropdownsResponse, Restaurant, ParseApiResponse } from "@/types";

interface UploadFile {
  file: File;
  id: string;
}

const RESTAURANT_OPTIONS: Array<{ value: Restaurant; label: string }> = [
  { value: "motin_juarez", label: "Motín Juárez" },
  { value: "motin_roma", label: "Motín Roma" },
  { value: "queseria", label: "Quesería" },
];

function NavBar({ user }: { user?: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <h1
          className="font-display text-xl font-light text-[var(--text)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Aventura <span className="text-[var(--gold)]">·</span> Facturas
        </h1>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-[var(--text-muted)] hidden sm:block">{user}</span>
          )}
          <button
            onClick={handleLogout}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-150 px-2 py-1 rounded-md hover:bg-[var(--surface-raised)]"
          >
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const [user, setUser] = useState<string>();
  const [restaurant, setRestaurant] = useState<Restaurant>("motin_juarez");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parseErrors, setParseErrors] = useState<Array<{ filename: string; error: string }>>([]);

  useEffect(() => {
    fetch("/api/config/dropdowns")
      .then((r) => r.json())
      .then((data: DropdownsResponse) => {})
      .catch(() => {});
    // Get user from session — we just show what's in the cookie name via a separate check
    // For simplicity, show nothing if not available
  }, []);

  async function handleProcess() {
    if (files.length === 0) {
      setError("Agrega al menos una factura");
      return;
    }
    setLoading(true);
    setError("");
    setParseErrors([]);

    try {
      const formData = new FormData();
      formData.append("restaurant", restaurant);
      for (const { file } of files) {
        formData.append("files", file);
      }

      const res = await fetch("/api/invoices/parse", {
        method: "POST",
        body: formData,
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data: ParseApiResponse = await res.json();

      if (!res.ok) {
        setError((data as unknown as { error: string }).error ?? "Error al procesar");
        return;
      }

      if (data.errors && data.errors.length > 0) {
        setParseErrors(data.errors);
      }

      if (data.invoices.length === 0) {
        setError("No se pudieron extraer datos de ningún archivo");
        return;
      }

      // Store in sessionStorage and navigate to review
      sessionStorage.setItem("invoices", JSON.stringify(data.invoices));

      // If some files failed, stay on page so user sees the errors.
      // The "Continue" button (shown when parseErrors exist) will navigate.
      if (data.errors && data.errors.length > 0) return;

      router.push("/review");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <NavBar user={user} />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="animate-fade-up">
          <h2
            className="font-display text-3xl font-light tracking-tight text-[var(--text)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Subir facturas
          </h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Arrastra PDFs o fotografías de facturas para procesarlas con IA
          </p>
        </div>

        {/* Restaurant selector */}
        <div className="animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Restaurante
            </p>
            <div className="flex flex-wrap gap-2">
              {RESTAURANT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRestaurant(opt.value)}
                  className={[
                    "px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium",
                    "border transition-all duration-150 active:scale-[0.97]",
                    restaurant === opt.value
                      ? "bg-[var(--navy)] border-[var(--navy-bright)] text-[var(--gold)]"
                      : "bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border)]",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Upload zone */}
        <div className="animate-fade-up" style={{ animationDelay: "0.10s" }}>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Archivos
            </p>
            <UploadZone files={files} onChange={setFiles} />
          </div>
        </div>

        {/* Parse errors */}
        {parseErrors.length > 0 && (
          <div className="rounded-[var(--radius)] border border-red-800/40 bg-[var(--danger-dim)] p-4 space-y-3 animate-fade-up">
            <p className="text-sm font-medium text-red-400">
              {parseErrors.length} archivo{parseErrors.length !== 1 ? "s" : ""} no se pudo procesar:
            </p>
            {parseErrors.map((e) => (
              <p key={e.filename} className="text-xs text-red-300">
                <span className="font-mono">{e.filename}</span>: {e.error}
              </p>
            ))}
            <button
              onClick={() => router.push("/review")}
              className="text-xs text-[var(--gold)] underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              Continuar con las facturas extraídas →
            </button>
          </div>
        )}

        {/* General error */}
        {error && (
          <p className="text-sm text-red-400 animate-fade-up">{error}</p>
        )}

        {/* Submit */}
        <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <Button
            size="lg"
            className="w-full"
            loading={loading}
            disabled={files.length === 0}
            onClick={handleProcess}
          >
            {loading
              ? `Procesando ${files.length} factura${files.length !== 1 ? "s" : ""}...`
              : `Procesar ${files.length > 0 ? files.length : ""} factura${files.length !== 1 ? "s" : ""}`}
          </Button>

          {loading && (
            <p className="text-center text-xs text-[var(--text-muted)] mt-3">
              Extrayendo datos con IA, puede tomar unos segundos por factura...
            </p>
          )}
        </div>
      </main>
    </>
  );
}
