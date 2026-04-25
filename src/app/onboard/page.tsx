"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/* ─── Types ───────────────────────────────────────────────────────────── */

interface RestaurantRow {
  id: string;
  label: string;
  slug: string;
}

interface MeResponse {
  user?: string;
  email?: string;
}

/* ─── Step indicator ──────────────────────────────────────────────────── */

function StepBar({ step }: { step: number }) {
  const steps = ["Grupo", "Sucursales", "Cuenta"];
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((label, i) => {
        const num = i + 1;
        const done = num < step;
        const active = num === step;
        return (
          <React.Fragment key={num}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300"
                style={{
                  background: done ? "var(--text)" : active ? "var(--blue)" : "var(--surface)",
                  color: done || active ? "white" : "var(--text-dim)",
                  border: done || active ? "none" : "1.5px solid var(--border)",
                }}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : num}
              </div>
              <span
                className="text-[10px] font-medium tracking-wide uppercase"
                style={{ color: active ? "var(--text)" : "var(--text-dim)" }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="w-12 h-px mx-1 mb-5 transition-all duration-300"
                style={{ background: num < step ? "var(--text)" : "var(--border)" }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─── Shared input style ──────────────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
      {hint && <div className="text-xs" style={{ color: "var(--text-dim)" }}>{hint}</div>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      className="w-full py-2.5 px-3.5 rounded-[var(--radius-sm)] text-sm border outline-none transition-all disabled:opacity-50"
      style={{
        background: "var(--surface)",
        borderColor: focused ? "var(--blue)" : "var(--border)",
        color: "var(--text)",
        ...(props.style ?? {}),
      }}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
    />
  );
}

/* ─── Dark primary button ─────────────────────────────────────────────── */

function PrimaryBtn({
  children,
  onClick,
  disabled,
  loading,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-2.5 px-4 rounded-[var(--radius-sm)] text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: "var(--text)", color: "var(--bg)" }}
    >
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

/* ─── Step 1 — Grupo ──────────────────────────────────────────────────── */

function Step1({
  groupName, setGroupName,
  groupSlug, setGroupSlug,
  slugAvailable, setSlugAvailable,
  onNext,
}: {
  groupName: string; setGroupName: (v: string) => void;
  groupSlug: string; setGroupSlug: (v: string) => void;
  slugAvailable: boolean | null; setSlugAvailable: (v: boolean | null) => void;
  onNext: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkSlug = useCallback(async (s: string) => {
    if (!s) { setSlugAvailable(null); return; }
    setChecking(true);
    try {
      const res = await fetch(`/api/onboard/check-slug?slug=${encodeURIComponent(s)}`);
      const data = await res.json() as { available?: boolean };
      setSlugAvailable(data.available ?? null);
    } catch {
      setSlugAvailable(null);
    } finally {
      setChecking(false);
    }
  }, [setSlugAvailable]);

  function handleNameChange(v: string) {
    setGroupName(v);
    if (!slugEdited) {
      const auto = slugify(v);
      setGroupSlug(auto);
      setSlugAvailable(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => checkSlug(auto), 400);
    }
  }

  function handleSlugChange(v: string) {
    setSlugEdited(true);
    const cleaned = v.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");
    setGroupSlug(cleaned);
    setSlugAvailable(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkSlug(cleaned), 400);
  }

  const slugOk = slugAvailable === true && groupSlug.length > 0;
  const canContinue = groupName.trim().length > 0 && slugOk;

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text)" }}>
          Tu grupo de restaurantes
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Crea el perfil de tu empresa. Puedes cambiarlo después.
        </p>
      </div>

      <Field label="Nombre del grupo">
        <Input
          type="text"
          value={groupName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Ej. Grupo Gastronómico Pérez"
          autoFocus
        />
      </Field>

      <Field
        label="Slug (identificador único)"
        hint={
          groupSlug ? (
            <span>
              Tu URL de acceso:{" "}
              <span className="font-mono" style={{ color: "var(--text-muted)" }}>
                boh-saas.vercel.app/login?tenant=
              </span>
              <span className="font-mono font-medium" style={{ color: "var(--text)" }}>
                {groupSlug || "…"}
              </span>
            </span>
          ) : null
        }
      >
        <div className="relative">
          <Input
            type="text"
            value={groupSlug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="mi-grupo"
          />
          {groupSlug && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
              {checking ? (
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "var(--text-dim)" }} />
              ) : slugAvailable === true ? (
                <span className="text-xs font-medium" style={{ color: "var(--success)" }}>✓ disponible</span>
              ) : slugAvailable === false ? (
                <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>✗ en uso</span>
              ) : null}
            </div>
          )}
        </div>
      </Field>

      <div className="pt-2">
        <PrimaryBtn onClick={onNext} disabled={!canContinue}>
          Continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}

/* ─── Step 2 — Sucursales ─────────────────────────────────────────────── */

function Step2({
  restaurants, setRestaurants,
  onNext, onBack,
}: {
  restaurants: RestaurantRow[];
  setRestaurants: React.Dispatch<React.SetStateAction<RestaurantRow[]>>;
  onNext: () => void;
  onBack: () => void;
}) {
  function updateRow(id: string, field: "label" | "slug", value: string) {
    setRestaurants((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === "label") {
          return { ...r, label: value, slug: slugify(value) };
        }
        return { ...r, slug: value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-") };
      })
    );
  }

  function addRow() {
    setRestaurants((prev) => [...prev, { id: crypto.randomUUID(), label: "", slug: "" }]);
  }

  function removeRow(id: string) {
    setRestaurants((prev) => prev.filter((r) => r.id !== id));
  }

  const canContinue = restaurants.every((r) => r.label.trim().length > 0) && restaurants.length > 0;

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text)" }}>
          Tus sucursales
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Agrega las ubicaciones de tu grupo. Puedes añadir más después.
        </p>
      </div>

      <div className="space-y-3">
        {restaurants.map((row, idx) => (
          <div
            key={row.id}
            className="rounded-[var(--radius)] p-4 space-y-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                Sucursal {idx + 1}
              </span>
              {restaurants.length > 1 && (
                <button
                  onClick={() => removeRow(row.id)}
                  className="text-xs transition-opacity hover:opacity-70"
                  style={{ color: "var(--text-dim)" }}
                >
                  Eliminar
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre visible">
                <Input
                  type="text"
                  value={row.label}
                  onChange={(e) => updateRow(row.id, "label", e.target.value)}
                  placeholder="Ej. Sucursal Centro"
                  autoFocus={idx === restaurants.length - 1 && row.label === ""}
                />
              </Field>
              <Field label="Slug interno">
                <Input
                  type="text"
                  value={row.slug}
                  onChange={(e) => updateRow(row.id, "slug", e.target.value)}
                  placeholder="sucursal-centro"
                />
              </Field>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="w-full py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-all hover:opacity-80 border border-dashed"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        + Agregar sucursal
      </button>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-none py-2.5 px-4 rounded-[var(--radius-sm)] text-sm font-medium border transition-all hover:opacity-80"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          ← Atrás
        </button>
        <PrimaryBtn onClick={onNext} disabled={!canContinue}>
          Continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}

/* ─── Step 3 — Cuenta ─────────────────────────────────────────────────── */

function Step3({
  onBack,
  groupName,
  groupSlug,
  restaurants,
}: {
  onBack: () => void;
  groupName: string;
  groupSlug: string;
  restaurants: RestaurantRow[];
}) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: MeResponse) => setMe(d))
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleCreate() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          slug: groupSlug,
          restaurants: restaurants.map((r) => ({ label: r.label, slug: r.slug })),
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Ocurrió un error. Intenta de nuevo.");
        setSubmitting(false);
      } else {
        window.location.href = "/upload";
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setSubmitting(false);
    }
  }

  const initial = (me?.user ?? me?.email ?? "?")[0]?.toUpperCase() ?? "?";

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text)" }}>
          Confirma tu cuenta
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Revisá el resumen antes de crear tu grupo.
        </p>
      </div>

      {/* Account card */}
      <div
        className="rounded-[var(--radius)] p-4 flex items-center gap-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: "var(--blue-light)", color: "var(--blue)" }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          {me?.user && (
            <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{me.user}</p>
          )}
          {me?.email && (
            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{me.email}</p>
          )}
          {!me && (
            <div className="h-4 w-32 rounded" style={{ background: "var(--border)" }} />
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs flex-shrink-0 transition-opacity hover:opacity-70"
          style={{ color: "var(--text-dim)" }}
        >
          Cambiar cuenta
        </button>
      </div>

      {/* Summary */}
      <div
        className="rounded-[var(--radius)] p-4 space-y-3 text-sm"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text-muted)" }}>Grupo</span>
          <span className="font-medium" style={{ color: "var(--text)" }}>{groupName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text-muted)" }}>Slug</span>
          <span className="font-mono text-xs" style={{ color: "var(--text)" }}>{groupSlug}</span>
        </div>
        <div className="h-px" style={{ background: "var(--border-subtle)" }} />
        <div>
          <span style={{ color: "var(--text-muted)" }}>Sucursales</span>
          <ul className="mt-1.5 space-y-1">
            {restaurants.map((r) => (
              <li key={r.id} className="flex items-center justify-between">
                <span style={{ color: "var(--text)" }}>{r.label}</span>
                <span className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>{r.slug}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {error && (
        <p className="text-sm px-3 py-2 rounded-[var(--radius-sm)]" style={{ color: "var(--danger)", background: "var(--danger-dim)" }}>
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex-none py-2.5 px-4 rounded-[var(--radius-sm)] text-sm font-medium border transition-all hover:opacity-80 disabled:opacity-40"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          ← Atrás
        </button>
        <PrimaryBtn onClick={handleCreate} loading={submitting}>
          {submitting ? "Creando cuenta..." : "Crear cuenta"}
        </PrimaryBtn>
      </div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────── */

export default function OnboardPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [groupName, setGroupName] = useState("");
  const [groupSlug, setGroupSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([
    { id: crypto.randomUUID(), label: "", slug: "" },
  ]);

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <p className="font-display text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}>
          BOH
        </p>
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>Crea tu cuenta gratuita</p>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <StepBar step={step} />

          {step === 1 && (
            <Step1
              groupName={groupName} setGroupName={setGroupName}
              groupSlug={groupSlug} setGroupSlug={setGroupSlug}
              slugAvailable={slugAvailable} setSlugAvailable={setSlugAvailable}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step2
              restaurants={restaurants}
              setRestaurants={setRestaurants}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3
              groupName={groupName}
              groupSlug={groupSlug}
              restaurants={restaurants}
              onBack={() => setStep(2)}
            />
          )}
        </div>
      </div>
    </main>
  );
}
