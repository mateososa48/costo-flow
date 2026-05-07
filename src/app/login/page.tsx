"use client";

import React, { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type Screen = "form" | "email_sent";

export default function LoginPage() {
  const [screen, setScreen] = useState<Screen>("form");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/api/auth/callback` },
      });
      if (oauthError) {
        setError("Error al iniciar sesión con Google. Intenta de nuevo.");
        setGoogleLoading(false);
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setGoogleLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setEmailLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
      });
      if (otpError) {
        setError("Error al enviar el correo. Verifica la dirección e intenta de nuevo.");
        setEmailLoading(false);
      } else {
        setSentTo(email.trim());
        setScreen("email_sent");
        setEmailLoading(false);
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setEmailLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* Left panel — desktop only */}
      <div className="login-panel-gradient hidden lg:flex flex-col justify-between w-96 flex-shrink-0 p-10 relative overflow-hidden">
        <div className="relative z-10">
          <p className="font-display text-3xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            CostoFlow
          </p>
        </div>
        <div className="relative z-10">
          <p className="text-white/50 text-sm">Control de costos para restaurantes</p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {screen === "form" ? (
          <div className="w-full max-w-sm animate-fade-up">
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <p className="font-display text-2xl font-bold" style={{ color: "var(--text)" }}>CostoFlow</p>
            </div>

            <div className="mb-7">
              <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>Iniciar sesión</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Accede a tu cuenta de CostoFlow
              </p>
            </div>

            {error && (
              <p className="text-sm mb-4 px-3 py-2 rounded-[var(--radius-sm)]" style={{ color: "var(--danger)", background: "var(--danger-dim)" }}>
                {error}
              </p>
            )}

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || emailLoading}
              className="w-full py-2.5 px-4 rounded-[var(--radius-sm)] text-sm font-medium flex items-center justify-center gap-3 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed border"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              {googleLoading ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>o</span>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            </div>

            {/* Email */}
            <form onSubmit={handleEmailLogin} className="space-y-2.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                disabled={emailLoading || googleLoading}
                className="w-full py-2.5 px-3.5 rounded-[var(--radius-sm)] text-sm border outline-none transition-all disabled:opacity-50"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--blue)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              <button
                type="submit"
                disabled={emailLoading || googleLoading || !email.trim()}
                className="w-full py-2.5 px-4 rounded-[var(--radius-sm)] text-sm font-medium flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--text)", color: "var(--bg)" }}
              >
                {emailLoading ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : "Continuar con correo"}
              </button>
            </form>

            <p className="text-center text-xs mt-8" style={{ color: "var(--text-dim)" }}>
              Solo para equipos con acceso autorizado
            </p>
          </div>
        ) : (
          <div className="w-full max-w-sm text-center animate-fade-up">
            {/* Email icon */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--blue-light)" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>

            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text)" }}>
              Revisa tu correo
            </h2>
            <p className="text-sm leading-relaxed mb-1" style={{ color: "var(--text-muted)" }}>
              Enviamos un enlace de acceso a
            </p>
            <p className="text-sm font-medium mb-6" style={{ color: "var(--text)" }}>{sentTo}</p>
            <p className="text-xs mb-6" style={{ color: "var(--text-dim)" }}>
              Haz clic en el enlace del correo para acceder. Puede tardar un minuto.
            </p>
            <button
              onClick={() => { setScreen("form"); setError(""); }}
              className="text-sm transition-opacity hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
              ← Volver
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
