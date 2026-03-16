"use client";

import React from "react";

interface FilterChip {
  label: string;
  onRemove: () => void;
}

interface FilterChipsProps {
  chips: FilterChip[];
  onClearAll: () => void;
}

export default function FilterChips({ chips, onClearAll }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors duration-150"
          style={{ background: "var(--blue-glow)", color: "var(--blue)" }}
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            className="ml-0.5 rounded-full p-0.5 transition-colors duration-150 hover:opacity-70"
            aria-label={`Quitar filtro: ${chip.label}`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-[11px] font-medium px-1.5 py-0.5 rounded transition-colors duration-150"
          style={{ color: "var(--text-muted)" }}
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}
