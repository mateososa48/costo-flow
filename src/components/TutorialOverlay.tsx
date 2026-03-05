"use client";

import React, { useEffect, useState } from "react";

const STEPS = [
  {
    emoji: "👋",
    bg: "linear-gradient(135deg, #0350A9 0%, #3B82F6 100%)",
    title: "¡Bienvenido al sistema!",
    body: "Te damos la bienvenida al gestor de facturas de **Aventura Gourmet**. En menos de un minuto aprenderás a usar cada función del sistema.",
  },
  {
    emoji: "📤",
    bg: "linear-gradient(135deg, #C97F7E 0%, #ECB8B7 100%)",
    title: "Sube tus facturas",
    body: "Ve a **Subir** y elige el restaurante. Luego arrastra tus **PDFs o fotografías** al área de carga — o toma una foto directo desde tu celular. Puedes subir varias a la vez 🗂️",
  },
  {
    emoji: "🤖",
    bg: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
    title: "La IA hace el trabajo",
    body: "El sistema analiza cada documento y extrae automáticamente: **proveedor, fecha, folio, importe, IVA y total**. Solo revisa y corrige si algo no quedó bien ✨",
  },
  {
    emoji: "✏️",
    bg: "linear-gradient(135deg, #D97706 0%, #F59E0B 100%)",
    title: "Revisa los datos",
    body: "En la pantalla de revisión verás todas las facturas. las facturas con aviso naranja necesitan tu atención 🔶",
  },
  {
    emoji: "📊",
    bg: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
    title: "Envía a Google Sheets",
    body: "Cuando todo esté correcto, haz clic en **Enviar**. Los datos van directo a la hoja del restaurante y mes correspondiente. El sistema detecta **duplicados** automáticamente 🛡️",
  },
  {
    emoji: "🗂️",
    bg: "linear-gradient(135deg, #0EA5E9 0%, #0350A9 100%)",
    title: "Consulta el historial",
    body: "Cada envío queda registrado en **Historial**. Puedes ver proveedor, monto, fecha y el enlace directo a la hoja de cálculo en cualquier momento 🔍",
  },
  {
    emoji: "⚙️",
    bg: "linear-gradient(135deg, #374151 0%, #6B7280 100%)",
    title: "Configura el sistema",
    body: "En **Configuración** cambia entre modo claro y oscuro 🌙, actualiza la contraseña compartida, y gestiona qué usuarios pueden iniciar sesión.",
  },
  {
    emoji: "🎉",
    bg: "linear-gradient(135deg, #EC4899 0%, #F97316 100%)",
    title: "¡Ya lo tienes todo!",
    body: "Eso es todo lo que necesitas saber. Si en algún momento quieres repasar alguna función, puedes **relanzar este tutorial** desde Configuración. ¡Mucho éxito! 🚀",
  },
];

export default function TutorialOverlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    function handleStart() {
      setStep(0);
      setOpen(true);
    }
    window.addEventListener("startTutorial", handleStart);
    try {
      if (!localStorage.getItem("tutorial_seen")) {
        setStep(0);
        setOpen(true);
      }
    } catch {}
    return () => window.removeEventListener("startTutorial", handleStart);
  }, []);

  function dismiss() {
    setOpen(false);
    try { localStorage.setItem("tutorial_seen", "1"); } catch {}
  }

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div
        className="relative w-full sm:max-w-md rounded-t-[1.5rem] sm:rounded-[1.25rem] overflow-hidden animate-fade-up"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-elevated)" }}
      >
        {/* Gradient illustration area */}
        <div
          className="h-48 flex flex-col items-center justify-center relative overflow-hidden"
          style={{ background: current.bg }}
        >
          {/* Decorative blobs */}
          <div className="absolute inset-0 opacity-25" style={{
            backgroundImage: "radial-gradient(circle at 15% 85%, white 0%, transparent 50%), radial-gradient(circle at 85% 15%, white 0%, transparent 50%)",
          }} />
          {/* Step counter */}
          <span
            className="absolute top-4 left-4 text-xs font-semibold px-2 py-1 rounded-full z-10"
            style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)" }}
          >
            {step + 1} / {STEPS.length}
          </span>
          {/* Skip */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors duration-150 z-10"
            style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)" }}
          >
            Omitir
          </button>
          {/* Emoji */}
          <span className="relative z-10 select-none" style={{ fontSize: "72px", lineHeight: 1, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }} role="img">
            {current.emoji}
          </span>
        </div>

        {/* Text content */}
        <div className="px-6 pt-5 pb-3">
          <h2
            className="font-display text-xl font-bold mb-2"
            style={{ color: "var(--text)", fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
          >
            {current.title}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {current.body.split(/\*\*(.*?)\*\*/g).map((part, i) =>
              i % 2 === 0
                ? part
                : <strong key={i} style={{ color: "var(--text)", fontWeight: 600 }}>{part}</strong>
            )}
          </p>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-1 pb-2">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${progress}%`, background: "var(--blue)", transition: "width 0.35s cubic-bezier(0.16,1,0.3,1)" }}
            />
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 py-1">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Ir al paso ${i + 1}`}
              style={{
                width: i === step ? "20px" : "6px",
                height: "6px",
                borderRadius: "999px",
                background: i === step ? "var(--blue)" : "var(--border)",
                transition: "width 0.25s cubic-bezier(0.16,1,0.3,1), background 0.2s",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-6 pb-6 pt-3">
          {!isFirst && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-2.5 rounded-[var(--radius-sm)] text-sm font-medium transition-colors duration-150 active:scale-[0.98]"
              style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}
            >
              ← Anterior
            </button>
          )}
          <button
            onClick={isLast ? dismiss : () => setStep(s => s + 1)}
            className="flex-1 py-2.5 rounded-[var(--radius-sm)] text-sm font-semibold text-white transition-colors duration-150 active:scale-[0.98]"
            style={{ background: "var(--blue)" }}
          >
            {isLast ? "¡Empezar! 🚀" : "Siguiente →"}
          </button>
        </div>
      </div>
    </div>
  );
}
