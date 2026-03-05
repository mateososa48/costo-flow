"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import TutorialOverlay from "./TutorialOverlay";

// ─── Icons ────────────────────────────────────────────────────────────
function UploadIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function HistoryIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SettingsIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ─── Nav items config ─────────────────────────────────────────────────
const NAV = [
  { href: "/upload",   label: "Subir",          Icon: UploadIcon },
  { href: "/history",  label: "Historial",      Icon: HistoryIcon },
  { href: "/settings", label: "Configuración",  Icon: SettingsIcon },
];

// ─── Shell ────────────────────────────────────────────────────────────
export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<string>("");

  useEffect(() => {
    const u = sessionStorage.getItem("user") ?? "";
    setUser(u);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    sessionStorage.removeItem("user");
    router.push("/login");
  }

  const initials = user ? user.slice(0, 2).toUpperCase() : "?";

  return (
    <div className="min-h-screen flex">

      {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-full z-30"
        style={{ width: "var(--sidebar-width)", borderRight: "1px solid var(--border)", background: "var(--surface)" }}>

        {/* Wordmark */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="font-display text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text)", letterSpacing: "-0.03em" }}>
            Aventura Gourmet
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="badge-ai">⚡ AI</span>
            <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>Facturas</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== "/upload" && pathname.startsWith(href));
            return (
              <Link key={href} href={href}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-[var(--blue)] text-white"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]",
                ].join(" ")}
              >
                <Icon active={active} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="px-3 pb-5 space-y-1 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
              style={{ background: "var(--pink-dark)" }}>
              {initials}
            </div>
            <span className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{user || "—"}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] text-sm transition-all duration-150"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface-raised)"; (e.currentTarget as HTMLElement).style.color = "var(--text)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Salir
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Bar ───────────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <p className="font-display text-base font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text)", letterSpacing: "-0.03em" }}>
          Aventura Gourmet
        </p>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
            style={{ background: "var(--pink-dark)" }}>
            {initials}
          </div>
          <button
            onClick={handleLogout}
            aria-label="Salir"
            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-150"
            style={{ color: "var(--text-muted)" }}
            onTouchStart={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface-raised)"; }}
            onTouchEnd={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main
        className="flex-1 min-h-screen min-w-0"
        style={{ paddingLeft: undefined }}
      >
        {/* Desktop offset */}
        <div className="hidden md:block" style={{ paddingLeft: "var(--sidebar-width)" }}>
          <div className="min-h-screen">
            {children}
          </div>
        </div>
        {/* Mobile: top bar + bottom nav padding */}
        <div className="md:hidden pt-14 pb-20">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex"
        style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/upload" && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors duration-150"
              style={{ color: active ? "var(--blue)" : "var(--text-muted)" }}
            >
              <Icon active={active} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Tutorial overlay ─────────────────────────────────────────── */}
      <TutorialOverlay />
    </div>
  );
}
