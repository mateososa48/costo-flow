"use client";

import React, { useState } from "react";
import { DbLineItem, SupplierGroup, formatCurrency, formatDate } from "../types";
import dropdownOptions from "../../../../data/dropdown_options.json";

interface SuppliersViewProps {
  suppliers: SupplierGroup[];
  supplierTags: Record<string, string>;
  setSupplierTags: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function SuppliersView({
  suppliers,
  supplierTags,
  setSupplierTags,
}: SuppliersViewProps) {
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierSortMode, setSupplierSortMode] = useState<"spend" | "count" | "alpha">("alpha");
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [editingSupplierTag, setEditingSupplierTag] = useState<string | null>(null);

  const q = supplierSearch.trim().toLowerCase();
  const filtered = suppliers
    .filter((g) => !q || g.supplier.toLowerCase().includes(q))
    .slice()
    .sort((a, b) => {
      if (supplierSortMode === "count") return b.itemCount - a.itemCount;
      if (supplierSortMode === "alpha") return a.supplier.localeCompare(b.supplier, "es");
      return b.totalSpend - a.totalSpend;
    });

  const renderCard = (group: SupplierGroup) => {
    const isExpanded = expandedSuppliers.has(group.supplier);
    const currentTag = supplierTags[group.supplier] ?? "";
    const isEditingTag = editingSupplierTag === group.supplier;
    return (
      <div key={group.supplier}
        className="rounded-[var(--radius)] border overflow-hidden"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <span className="text-base font-semibold leading-tight truncate" style={{ color: "var(--text)" }} title={group.supplier}>
              {group.supplier}
            </span>
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {isEditingTag ? (
                <select
                  autoFocus
                  value={currentTag}
                  className="px-2 py-0.5 rounded-[var(--radius-sm)] border text-[11px] appearance-none focus:outline-none focus:ring-1"
                  style={{ background: "var(--surface)", borderColor: "var(--blue)", color: "var(--text)" }}
                  onBlur={() => setEditingSupplierTag(null)}
                  onChange={async (e) => {
                    const supplyType = e.target.value;
                    setSupplierTags((prev) => ({ ...prev, [group.supplier]: supplyType }));
                    setEditingSupplierTag(null);
                    await fetch("/api/compras/suppliers/tags", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ supplier: group.supplier, supplyType }),
                    });
                  }}
                >
                  <option value="">Sin clasificar</option>
                  {(dropdownOptions.cuentaPnl as string[]).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  title="Clasificar proveedor"
                  className="text-[10px] px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                  style={{
                    background: currentTag ? "var(--blue-glow)" : "var(--surface-raised)",
                    color: currentTag ? "var(--blue)" : "var(--text-dim)",
                    border: `1px solid ${currentTag ? "color-mix(in srgb, var(--blue) 25%, transparent)" : "var(--border-subtle)"}`,
                  }}
                  onClick={() => setEditingSupplierTag(group.supplier)}
                >
                  {currentTag || "Clasificar ✎"}
                </button>
              )}
            </div>
          </div>
          <p className="text-lg font-bold mb-1"
            style={{ fontFamily: "var(--font-display)", color: "var(--blue)", letterSpacing: "-0.02em" }}>
            {formatCurrency(group.totalSpend)}
          </p>
          <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
            {group.itemCount} artículo{group.itemCount !== 1 ? "s" : ""}
          </p>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
            style={{ color: isExpanded ? "var(--blue)" : "var(--text-dim)" }}
            onClick={() => setExpandedSuppliers((prev) => {
              const next = new Set(prev);
              isExpanded ? next.delete(group.supplier) : next.add(group.supplier);
              return next;
            })}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"
              className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
              <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Ver artículos
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateRows: isExpanded ? "1fr" : "0fr", transition: "grid-template-rows 0.25s ease" }}>
          <div style={{ overflow: "hidden", minHeight: 0 }}>
            <div className="border-t px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)" }}>
              {group.items.map((item: DbLineItem) => (
                <div key={item.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0 text-xs"
                  style={{ borderColor: "var(--border-subtle)" }}>
                  <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{item.description}</span>
                  <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>{formatDate(item.invoice_date)}</span>
                  <span className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    {item.quantity != null ? `${item.quantity} ${item.unit_normalized ?? item.unit ?? ""}` : ""}
                  </span>
                  <span className="flex-shrink-0 font-semibold" style={{ color: "var(--blue)" }}>{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: "var(--text-muted)" }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
            placeholder="Buscar proveedor..."
            className="w-full pl-8 pr-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--surface)", borderColor: supplierSearch ? "var(--blue)" : "var(--border)", color: "var(--text)" }}
          />
          {supplierSearch && (
            <button type="button" onClick={() => setSupplierSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
              style={{ color: "var(--text-muted)" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-[var(--radius-sm)]" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}>
          {([["spend", "Mayor gasto"], ["count", "Más artículos"], ["alpha", "A–Z"]] as [typeof supplierSortMode, string][]).map(([mode, label]) => (
            <button key={mode} type="button"
              className="text-[11px] px-2.5 py-1 rounded transition-colors"
              style={{
                background: supplierSortMode === mode ? "var(--surface)" : "transparent",
                color: supplierSortMode === mode ? "var(--text)" : "var(--text-muted)",
                fontWeight: supplierSortMode === mode ? 600 : 400,
                boxShadow: supplierSortMode === mode ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
              onClick={() => setSupplierSortMode(mode)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-[var(--radius-sm)]"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="font-semibold" style={{ color: "var(--text)" }}>{filtered.length}</span> proveedor{filtered.length !== 1 ? "es" : ""}
          </span>
          <span className="text-xs font-semibold" style={{ color: "var(--blue)" }}>
            {formatCurrency(filtered.reduce((s, g) => s + g.totalSpend, 0))} total
          </span>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
          {supplierSearch ? `Sin resultados para "${supplierSearch}"` : "No hay proveedores para este período."}
        </p>
      )}

      {/* Two independent columns */}
      <>
        {/* Desktop: two truly independent columns */}
        <div className="hidden md:flex gap-3 items-start w-full">
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {filtered.filter((_, i) => i % 2 === 0).map(renderCard)}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {filtered.filter((_, i) => i % 2 !== 0).map(renderCard)}
          </div>
        </div>
        {/* Mobile: single column */}
        <div className="flex flex-col gap-3 md:hidden">
          {filtered.map(renderCard)}
        </div>
      </>
    </div>
  );
}
