"use client";

import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export default function Select({
  label,
  error,
  hint,
  options,
  placeholder,
  className = "",
  id,
  ...props
}: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={[
            "w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] appearance-none",
            "bg-[var(--surface-raised)] border text-sm",
            "transition-colors duration-150 cursor-pointer",
            props.value === "" || props.value === undefined
              ? "text-[var(--text-dim)]"
              : "text-[var(--text)]",
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
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#1e1b18] text-[var(--text)]">
              {opt.label}
            </option>
          ))}
        </select>
        {/* Chevron */}
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--text-dim)]">{hint}</p>}
    </div>
  );
}
