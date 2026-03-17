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

export default function FilterPanel({
  showFilters,
  search,
  setSearch,
  restaurant,
  setRestaurant,
  supplier,
  setSupplier,
  supplierList,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  selectedMonth,
  selectedWeek,
  activePreset,
  hasFilters,
  onMonthSelect,
  onWeekSelect,
  onApplyPreset,
  onResetFilters,
}: FilterPanelProps) {
  return (
    <div className={`flex flex-col gap-2 pt-3 ${showFilters ? "" : "hidden"}`}>
      {/* Row 1: search + restaurant + supplier */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        <div className="sm:col-span-2 md:col-span-2">
          <input
            type="text"
            value={search}
            placeholder="Buscar artículo..."
            className="w-full px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={restaurant}
          className="w-full px-3 py-2 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: restaurant ? "var(--text)" : "var(--text-dim)" }}
          onChange={(e) => setRestaurant(e.target.value)}
        >
          <option value="">Todos los restaurantes</option>
          <option value="motin_juarez">Motín Juárez</option>
          <option value="motin_roma">Motín Roma</option>
          <option value="queseria">Quesería</option>
        </select>
        <select
          value={supplier}
          className="w-full px-3 py-2 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: supplier ? "var(--text)" : "var(--text-dim)" }}
          onChange={(e) => setSupplier(e.target.value)}
        >
          <option value="">Todos los proveedores</option>
          {supplierList.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Row 2: period presets + month + week + desde/hasta + limpiar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Presets */}
        {[
          { key: "thisMonth", label: "Este mes" },
          { key: "lastMonth", label: "Mes pasado" },
          { key: "last30", label: "Últ. 30d" },
          { key: "ytd", label: "YTD" },
        ].map(({ key, label }) => (
          <button key={key} type="button" onClick={() => onApplyPreset(key)}
            className="px-2.5 py-1.5 rounded-[var(--radius-sm)] border text-xs font-medium transition-colors duration-150"
            style={{
              background: activePreset === key ? "var(--blue)" : "var(--surface)",
              color: activePreset === key ? "#fff" : "var(--text-muted)",
              borderColor: activePreset === key ? "var(--blue)" : "var(--border)",
            }}>
            {label}
          </button>
        ))}
        <span className="w-px h-4" style={{ background: "var(--border)" }} />
        <select
          value={selectedMonth}
          className="w-full sm:w-auto sm:min-w-[160px] px-3 py-2 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
          style={{ background: "var(--surface)", borderColor: selectedMonth ? "var(--blue)" : "var(--border)", color: selectedMonth ? "var(--text)" : "var(--text-dim)" }}
          onChange={(e) => onMonthSelect(e.target.value)}
        >
          <option value="">Mes</option>
          {getMonthOptions().map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={selectedWeek}
          className="w-full sm:w-auto sm:min-w-[160px] px-3 py-2 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
          style={{ background: "var(--surface)", borderColor: selectedWeek ? "var(--blue)" : "var(--border)", color: selectedWeek ? "var(--text)" : "var(--text-dim)" }}
          onChange={(e) => onWeekSelect(e.target.value)}
        >
          <option value="">Semana</option>
          {getWeekOptions().map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Desde</span>
          <input
            type="date"
            value={dateFrom}
            className="px-2 py-1 rounded-[var(--radius-sm)] border text-xs focus:outline-none focus:ring-2"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: dateFrom ? "var(--text)" : "var(--text-dim)" }}
            onChange={(e) => { setDateFrom(e.target.value); }}
          />
          <span className="text-[10px] uppercase tracking-wider font-medium ml-1" style={{ color: "var(--text-muted)" }}>Hasta</span>
          <input
            type="date"
            value={dateTo}
            className="px-2 py-1 rounded-[var(--radius-sm)] border text-xs focus:outline-none focus:ring-2"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: dateTo ? "var(--text)" : "var(--text-dim)" }}
            onChange={(e) => { setDateTo(e.target.value); }}
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onResetFilters}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}
