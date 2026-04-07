"use client";

import React from "react";
import Button from "@/components/ui/Button";
import { getMonthOptions, getWeekOptions } from "../types";

interface FilterPanelProps {
  showFilters: boolean;
  search: string;
  setSearch: (v: string) => void;
  restaurant: string;
  setRestaurant: (v: string) => void;
  supplier: string;
  setSupplier: (v: string) => void;
  supplierList: string[];
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  selectedMonth: string;
  selectedWeek: string;
  activePreset: string;
  hasFilters: boolean;
  onMonthSelect: (v: string) => void;
  onWeekSelect: (v: string) => void;
  onApplyPreset: (preset: string) => void;
  onResetFilters: () => void;
}

function ChevronDown() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M2 4l3.5 3.5L9 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1 5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="1.5" y="2" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 11V7.5h3V11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 4.5h1M7.5 4.5h1M3.5 6.5h1M7.5 6.5h1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M1 3h7v5.5H1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 4.5h1.5L11 6.5V8.5H8V4.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="3" cy="9.5" r="1" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="9.5" cy="9.5" r="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export default function FilterPanel({
  showFilters,
  search,
  setSearch,
  restaurant,
  setRestaurant,
  supplier,
  setSupplier,
  supplierList,
  selectedMonth,
  selectedWeek,
  hasFilters,
  onMonthSelect,
  onWeekSelect,
  onResetFilters,
}: FilterPanelProps) {
  const inputBase = "w-full h-9 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--blue)_30%,transparent)] transition-colors";
  const iconColor = "var(--text-muted)";

  return (
    <div className={`pt-3 ${showFilters ? "" : "hidden"}`}>
      <div className="flex flex-wrap gap-2 items-center">

        {/* Search */}
        <div className="relative flex-[2] min-w-[180px]">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: iconColor }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            placeholder="Buscar artículo..."
            className={`${inputBase} pl-8 pr-3`}
            style={{ background: "var(--surface)", borderColor: search ? "var(--blue)" : "var(--border)", color: "var(--text)" }}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
              style={{ color: iconColor }}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Restaurant */}
        <div className="relative flex-1 min-w-[160px]">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: iconColor }}>
            <BuildingIcon />
          </span>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: iconColor }}>
            <ChevronDown />
          </span>
          <select
            value={restaurant}
            className={`${inputBase} appearance-none pl-8 pr-7 cursor-pointer`}
            style={{ background: "var(--surface)", borderColor: restaurant ? "var(--blue)" : "var(--border)", color: restaurant ? "var(--text)" : "var(--text-dim)" }}
            onChange={(e) => setRestaurant(e.target.value)}
          >
            <option value="">Todos los restaurantes</option>
            <option value="motin_juarez">Motín Juárez</option>
            <option value="motin_roma">Motín Roma</option>
            <option value="queseria">Quesería</option>
          </select>
        </div>

        {/* Supplier */}
        <div className="relative flex-1 min-w-[160px]">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: iconColor }}>
            <TruckIcon />
          </span>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: iconColor }}>
            <ChevronDown />
          </span>
          <select
            value={supplier}
            className={`${inputBase} appearance-none pl-8 pr-7 cursor-pointer`}
            style={{ background: "var(--surface)", borderColor: supplier ? "var(--blue)" : "var(--border)", color: supplier ? "var(--text)" : "var(--text-dim)" }}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">Todos los proveedores</option>
            {supplierList.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Month */}
        <div className="relative min-w-[130px]">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: iconColor }}>
            <CalendarIcon />
          </span>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: iconColor }}>
            <ChevronDown />
          </span>
          <select
            value={selectedMonth}
            className={`${inputBase} appearance-none pl-8 pr-7 cursor-pointer`}
            style={{ background: "var(--surface)", borderColor: selectedMonth ? "var(--blue)" : "var(--border)", color: selectedMonth ? "var(--text)" : "var(--text-dim)" }}
            onChange={(e) => onMonthSelect(e.target.value)}
          >
            <option value="">Mes</option>
            {getMonthOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Week */}
        <div className="relative min-w-[130px]">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: iconColor }}>
            <CalendarIcon />
          </span>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: iconColor }}>
            <ChevronDown />
          </span>
          <select
            value={selectedWeek}
            className={`${inputBase} appearance-none pl-8 pr-7 cursor-pointer`}
            style={{ background: "var(--surface)", borderColor: selectedWeek ? "var(--blue)" : "var(--border)", color: selectedWeek ? "var(--text)" : "var(--text-dim)" }}
            onChange={(e) => onWeekSelect(e.target.value)}
          >
            <option value="">Semana</option>
            {getWeekOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onResetFilters}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}
