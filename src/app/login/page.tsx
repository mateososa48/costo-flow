"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DropdownsResponse } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const [adminNames, setAdminNames] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Iniciar sesión — Aventura Gourmet";
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
      sessionStorage.setItem("user", name);
      router.push("/upload");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* Left panel — desktop */}
      <div className="login-panel-gradient hidden lg:flex flex-col justify-between w-96 flex-shrink-0 p-10 relative overflow-hidden">
        <div className="relative z-10">
          <p className="font-display text-3xl font-bold text-white"
            style={{ fontFamily: "var(--font-display)" }}>
            Aventura Gourmet
          </p>
        </div>
        <div className="relative z-10">
          <p className="text-white/50 text-sm">Sistema de procesamiento de facturas</p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Brand logos — centered on mobile, top-right on desktop */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 lg:left-auto lg:right-6 lg:translate-x-0 flex items-center gap-3">
          <img src="/logo-motin.png" alt="Motín" className="h-7 w-auto" />
          <img src="/logo-queseria.png" alt="Quesería" className="h-7 w-auto" />
        </div>

        <div className="w-full max-w-md animate-fade-up">
          <div className="lg:hidden text-center mb-8">
            <p className="font-display text-2xl font-bold"
              style={{ color: "var(--text)" }}>
              Aventura Gourmet
            </p>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>Iniciar sesión</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Selecciona tu nombre e ingresa tu contraseña
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                ¿Quién eres?
              </label>
              <div className="relative">
                <select
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 pr-8 rounded-[var(--radius-sm)] appearance-none text-sm transition-colors duration-150 focus:outline-none"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: name ? "var(--text)" : "var(--text-dim)",
                  }}
                >
                  <option value="" disabled>Selecciona tu nombre</option>
                  {adminNames.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full px-3 py-2.5 pr-9 rounded-[var(--radius-sm)] text-sm transition-colors duration-150 focus:outline-none"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors duration-150"
                  style={{ color: "var(--text-dim)" }}
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-[var(--radius-sm)] text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--blue)" }}
            >
              {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <p className="text-center text-xs mt-8" style={{ color: "var(--text-dim)" }}>
            Solo para uso interno de Aventura Gourmet
          </p>
        </div>
      </div>
    </main>
  );
}
