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
          className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          "w-full px-3 py-2 rounded-[var(--radius-sm)]",
          "bg-[var(--surface-raised)] border text-[var(--text)] text-sm",
          "placeholder:text-[var(--text-dim)]",
          "transition-colors duration-150",
          error
            ? "border-red-700/60 focus:border-red-500"
            : "border-[var(--border)] focus:border-[var(--gold-dim)]",
          "focus:outline-none focus:ring-1",
          error
            ? "focus:ring-red-700/40"
            : "focus:ring-[var(--gold-dim)]/30",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        ].join(" ")}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-[var(--text-dim)]">{hint}</p>
      )}
    </div>
  );
}
