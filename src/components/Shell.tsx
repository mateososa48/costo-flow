"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import TutorialOverlay from "./TutorialOverlay";
import ErrorBoundary from "./ErrorBoundary";

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

function ComprasIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function GastosIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
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
const NAV_TOP = [
  { href: "/upload",   label: "Subir",     Icon: UploadIcon },
  { href: "/history",  label: "Historial", Icon: HistoryIcon },
];
const GASTOS_CHILDREN = [
  { href: "/compras", label: "Alimentos",  Icon: ComprasIcon },
  { href: "/gastos",  label: "Operativos", Icon: GastosIcon },
];
const NAV_BOTTOM = [
  { href: "/settings", label: "Config", Icon: SettingsIcon },
];

// ─── Shell ────────────────────────────────────────────────────────────
export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<string>("");
  const [hasUnmatched, setHasUnmatched] = useState(false);
  const gastosActive = pathname.startsWith("/compras") || pathname.startsWith("/gastos");
  const [gastosOpen, setGastosOpen] = useState(gastosActive);

  useEffect(() => {
    fetch("/api/compras?view=normalize")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.unmatched?.length > 0) setHasUnmatched(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const cached = sessionStorage.getItem("boh_user_name");
    if (cached) {
      setUser(cached);
      return;
    }
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          sessionStorage.setItem("boh_user_name", data.user);
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    sessionStorage.removeItem("boh_user_name");
    router.push("/login");
  }

  const initials = user ? user.slice(0, 2).toUpperCase() : "?";
  const [mobileGastosOpen, setMobileGastosOpen] = useState(false);

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
          {NAV_TOP.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== "/upload" && pathname.startsWith(href));
            return (
              <Link key={href} href={href}
                className={[
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm font-medium transition-all duration-150",
                  active ? "bg-[var(--blue)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]",
                ].join(" ")}
              >
                <Icon active={active} />
                {label}
              </Link>
            );
          })}

          {/* Gastos group */}
          <button
            type="button"
            onClick={() => setGastosOpen(o => !o)}
            className={[
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm font-medium transition-all duration-150",
              gastosActive ? "text-[var(--blue)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]",
            ].join(" ")}
          >
            <GastosIcon active={gastosActive} />
            <span className="flex-1 text-left">Gastos</span>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: gastosOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {gastosOpen && (
            <div className="ml-3 pl-3 space-y-0.5" style={{ borderLeft: "1px solid var(--border)" }}>
              {GASTOS_CHILDREN.map(({ href, label, Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link key={href} href={href}
                    className={[
                      "relative flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-all duration-150",
                      active ? "bg-[var(--blue)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]",
                    ].join(" ")}
                  >
                    <Icon active={active} />
                    {label}
                    {href === "/compras" && hasUnmatched && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full"
                        style={{ background: "var(--pink-dark)" }} />
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {NAV_BOTTOM.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={[
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm font-medium transition-all duration-150",
                  active ? "bg-[var(--blue)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]",
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
            className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] text-sm transition-all duration-150 hover-surface"
            style={{ color: "var(--text-muted)" }}
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
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </div>
        {/* Mobile: top bar + bottom nav padding */}
        <div className="md:hidden pt-14 pb-20">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>

      {/* ── Mobile Bottom Nav ────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex"
        style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
        {NAV_TOP.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/upload" && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className="relative flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors duration-150"
              style={{ color: active ? "var(--blue)" : "var(--text-muted)" }}
            >
              <Icon active={active} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
        {/* Gastos: tap to choose sub-page */}
        <button
          type="button"
          className="relative flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors duration-150"
          style={{ color: gastosActive ? "var(--blue)" : "var(--text-muted)" }}
          onClick={() => setMobileGastosOpen(o => !o)}
        >
          <GastosIcon active={gastosActive} />
          <span className="text-[10px] font-medium">Gastos</span>
          {hasUnmatched && (
            <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full translate-x-3"
              style={{ background: "var(--pink-dark)" }} />
          )}
        </button>
        {NAV_BOTTOM.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className="relative flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors duration-150"
              style={{ color: active ? "var(--blue)" : "var(--text-muted)" }}
            >
              <Icon active={active} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}

        {/* Gastos sub-page chooser sheet */}
        {mobileGastosOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMobileGastosOpen(false)}
            />
            {/* Sheet */}
            <div
              className="fixed left-0 right-0 z-50 px-4 pb-2"
              style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)" }}
            >
              <div className="rounded-[var(--radius)] border overflow-hidden"
                style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 -4px 24px rgba(0,0,0,0.12)" }}>
                <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "var(--text-dim)" }}>Gastos</p>
                {GASTOS_CHILDREN.map(({ href, label, Icon }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <Link key={href} href={href}
                      className="flex items-center gap-3 px-4 py-3 border-t transition-colors duration-150"
                      style={{
                        borderColor: "var(--border-subtle)",
                        background: active ? "var(--blue-glow)" : "transparent",
                        color: active ? "var(--blue)" : "var(--text)",
                      }}
                      onClick={() => setMobileGastosOpen(false)}
                    >
                      <Icon active={active} />
                      <span className="text-sm font-medium">{label}</span>
                      {href === "/compras" && hasUnmatched && (
                        <span className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: "var(--pink-dark)" }} />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* ── Tutorial overlay ─────────────────────────────────────────── */}
      <TutorialOverlay />
    </div>
  );
}
