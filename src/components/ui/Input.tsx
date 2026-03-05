"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function Input({
  label,
  error,
  hint,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          "w-full px-3 py-2 rounded-[var(--radius-sm)] text-sm",
          "bg-[var(--surface)] border",
          "placeholder:text-[var(--text-dim)]",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2",
          error
            ? "border-[var(--danger)] focus:ring-[var(--danger)]/20 text-[var(--text)]"
            : "border-[var(--border)] focus:border-[var(--blue)] focus:ring-[var(--blue)]/15 text-[var(--text)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        ].join(" ")}
        {...props}
      />
      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
      {hint && !error && <p className="text-xs" style={{ color: "var(--text-dim)" }}>{hint}</p>}
    </div>
  );
}
