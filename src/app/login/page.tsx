"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DropdownsResponse } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const [adminNames, setAdminNames] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/config/dropdowns")
      .then((r) => r.json())
      .then((data: DropdownsResponse) => setAdminNames(data.adminNames))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !password) {
      setError("Selecciona tu nombre e ingresa la contraseña");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        return;
      }
      router.push("/upload");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background radial glows */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #c8a882 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #1b2a4a 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        {/* Logo / wordmark */}
        <div className="text-center mb-8">
          <h1
            className="font-display text-5xl font-light tracking-[-0.03em] text-[var(--text)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Aventura
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1 tracking-widest uppercase font-medium">
            Gourmet · Facturas
          </p>
          {/* Gold divider */}
          <div className="mt-4 mx-auto w-12 h-px bg-[var(--gold)]" style={{ opacity: 0.6 }} />
        </div>

        {/* Login card */}
        <div
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5"
          style={{ boxShadow: "var(--shadow-elevated)" }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Admin selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                ¿Quién eres?
              </label>
              <div className="relative">
                <select
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={[
                    "w-full px-3 py-2.5 pr-8 rounded-[var(--radius-sm)] appearance-none",
                    "bg-[var(--surface-raised)] border border-[var(--border)]",
                    "text-sm focus:outline-none focus:border-[var(--gold-dim)] focus:ring-1 focus:ring-[var(--gold-dim)]/30",
                    "transition-colors duration-150",
                    name ? "text-[var(--text)]" : "text-[var(--text-dim)]",
                  ].join(" ")}
                  required
                >
                  <option value="" disabled>Selecciona tu nombre</option>
                  {adminNames.map((n) => (
                    <option key={n} value={n} className="bg-[#1e1b18] text-[var(--text)]">
                      {n}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-3 py-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text)] text-sm placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--gold-dim)] focus:ring-1 focus:ring-[var(--gold-dim)]/30 transition-colors duration-150"
                required
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-[var(--radius-sm)] bg-[var(--gold)] text-[#1a1714] font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-[#1a1714] border-t-transparent rounded-full animate-spin" />
              ) : null}
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>

        <p className="text-center text-[var(--text-dim)] text-xs mt-6">
          Solo para uso interno de Aventura Gourmet
        </p>
      </div>
    </main>
  );
}
