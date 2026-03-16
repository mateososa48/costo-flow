"use client";

import React, { useEffect, useState } from "react";
import { useToast } from "@/contexts/ToastContext";

const ICONS: Record<string, string> = {
  success: "✓",
  error: "✕",
  warning: "!",
};

const COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: "var(--success-dim)",
    border: "var(--success)",
    text: "var(--text)",
    icon: "var(--success)",
  },
  error: {
    bg: "var(--danger-dim)",
    border: "var(--danger)",
    text: "var(--text)",
    icon: "var(--danger)",
  },
  warning: {
    bg: "var(--warning-dim)",
    border: "var(--warning)",
    text: "var(--text)",
    icon: "var(--warning)",
  },
};

function ToastItem({
  id,
  type,
  message,
  onDismiss,
}: {
  id: string;
  type: string;
  message: string;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const colors = COLORS[type] || COLORS.success;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  function handleDismiss() {
    setVisible(false);
    setTimeout(() => onDismiss(id), 200);
  }

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
        borderRadius: "var(--radius-sm)",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        fontSize: "14px",
        fontFamily: "var(--font-body)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        transform: visible ? "translateY(0)" : "translateY(-8px)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.2s ease, opacity 0.2s ease",
        maxWidth: "420px",
        width: "100%",
        pointerEvents: "auto",
      }}
    >
      <span
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: 700,
          color: "white",
          background: colors.icon,
          flexShrink: 0,
        }}
      >
        {ICONS[type]}
      </span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
      <button
        onClick={handleDismiss}
        aria-label="Cerrar"
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          padding: "2px",
          fontSize: "16px",
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        pointerEvents: "none",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
