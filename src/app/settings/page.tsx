"use client";

import React, { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import { RESTAURANT_LABELS } from "@/types";
import type { Restaurant, DropdownsResponse } from "@/types";

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function parseRegistryKey(key: string): { restaurant: string; period: string } {
  const parts = key.split("_");
  // Last part = MM, second-to-last = YYYY
  const month = parts[parts.length - 1];
  const year = parts[parts.length - 2];
  const restaurantKey = parts.slice(0, -2).join("_") as Restaurant;
  const restaurant = RESTAURANT_LABELS[restaurantKey] ?? restaurantKey;
  const periodLabel = `${year} · ${month}`;
  return { restaurant, period: periodLabel };
}

/* ─── Section wrapper ─────────────────────────────────────────────────── */

function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</p>
        {description && <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{description}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

/* ─── Theme toggle ────────────────────────────────────────────────────── */

function ThemeSection() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const html = document.documentElement;
    const next = !html.classList.contains("dark");
    html.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
    setIsDark(next);
  }

  return (
    <Section title="Apariencia" description="Cambia entre modo claro y oscuro">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {isDark ? "Modo oscuro" : "Modo claro"}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            La preferencia se guarda en este dispositivo
          </p>
        </div>
        {/* Sun / Moon segmented toggle */}
        <button
          type="button"
          onClick={toggle}
          aria-label="Cambiar modo oscuro"
          role="switch"
          aria-checked={isDark}
          className="relative flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none focus-visible:ring-2"
          style={{ background: isDark ? "#1C1C20" : "#E4E4E7", gap: "2px" }}
        >
          {/* Sun */}
          <span
            className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300"
            style={{
              background: !isDark ? "var(--blue)" : "transparent",
              color: !isDark ? "white" : "var(--text-dim)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </span>
          {/* Moon */}
          <span
            className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300"
            style={{
              background: isDark ? "var(--blue)" : "transparent",
              color: isDark ? "white" : "var(--text-dim)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </span>
        </button>
      </div>
    </Section>
  );
}

/* ─── Sheet registry ──────────────────────────────────────────────────── */

function SheetRegistrySection({ registry }: { registry: Record<string, string> }) {
  const entries = Object.entries(registry);

  if (entries.length === 0) {
    return (
      <Section title="Hojas de cálculo registradas" description="Hojas de Google Sheets configuradas por restaurante y mes">
        <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
          No hay hojas registradas en <span className="font-mono text-xs">SHEET_REGISTRY</span>
        </p>
      </Section>
    );
  }

  return (
    <Section title="Hojas de cálculo registradas" description="Solo lectura — configurado mediante la variable SHEET_REGISTRY">
      <div className="rounded-[var(--radius)] border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {/* Header */}
        <div
          className="grid gap-3 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            background: "var(--surface-raised)",
            color: "var(--text-muted)",
            gridTemplateColumns: "1fr 1fr 1fr auto",
          }}
        >
          <span>Restaurante</span>
          <span>Periodo</span>
          <span>ID de hoja</span>
          <span />
        </div>
        {/* Rows */}
        {entries.map(([key, spreadsheetId], i) => {
          const { restaurant, period } = parseRegistryKey(key);
          const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
          return (
            <div
              key={key}
              className="grid items-center gap-3 px-3 py-2.5"
              style={{
                background: "var(--surface)",
                borderTop: "1px solid var(--border-subtle)",
                gridTemplateColumns: "1fr 1fr 1fr auto",
              }}
            >
              <span className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>
                {restaurant}
              </span>
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                {period}
              </span>
              <span className="text-xs font-mono truncate" style={{ color: "var(--text-dim)" }}>
                {spreadsheetId.substring(0, 20)}…
              </span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded transition-colors duration-150 flex-shrink-0 hover-blue-bg"
                style={{ color: "var(--text-muted)" }}
                title="Abrir hoja de cálculo"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 2h4M11 2v4M11 2L6 7M3.5 5.5H2v5.5h5.5V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const [registry, setRegistry] = useState<Record<string, string>>({});
  const [registryLoaded, setRegistryLoaded] = useState(false);

  const loadRegistry = useCallback(() => {
    fetch("/api/config/dropdowns")
      .then(r => r.json())
      .then((d: DropdownsResponse) => setRegistry(d.sheetRegistry ?? {}))
      .catch(() => {})
      .finally(() => setRegistryLoaded(true));
  }, []);

  useEffect(() => {
    document.title = "Configuración — Aventura Gourmet";
    loadRegistry();
  }, [loadRegistry]);

  return (
    <Shell>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-6">
        {/* Header */}
        <div className="animate-fade-up">
          <h1
            className="font-display text-3xl md:text-4xl font-bold"
            style={{ color: "var(--text)" }}
          >
            Configuración
          </h1>
          <p className="text-base mt-2" style={{ color: "var(--text-muted)" }}>
            Ajustes del sistema y preferencias
          </p>
        </div>

        <div className="animate-fade-up space-y-4" style={{ animationDelay: "0.05s" }}>
          <Section title="Tutorial" description="Aprende a usar el sistema paso a paso">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Guía interactiva</p>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Repasa todas las funciones del sistema en menos de 2 minutos
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("startTutorial"))}
                className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-semibold text-white transition-colors duration-150 active:scale-[0.97] flex-shrink-0"
                style={{ background: "var(--blue)" }}
              >
                <span>✨</span>
                Iniciar tutorial
              </button>
            </div>
          </Section>
          <ThemeSection />
          {registryLoaded && <SheetRegistrySection registry={registry} />}
        </div>
      </div>
    </Shell>
  );
}
