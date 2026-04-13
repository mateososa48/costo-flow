"use client";

import React, { useState, useRef } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Ingredient, UnmatchedGroup, AISuggestion, NORMALIZED_UNITS_LIST } from "../types";
import dropdownOptions from "../../../../data/dropdown_options.json";

interface NormalizeViewProps {
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  unmatched: UnmatchedGroup[];
  unmatchedCount: number;
  normalizeLoading: boolean;
  fetchNormalize: () => void;
}

export default function NormalizeView({
  ingredients,
  setIngredients,
  unmatched,
  unmatchedCount,
  normalizeLoading,
  fetchNormalize,
}: NormalizeViewProps) {
  const [normalizeMode, setNormalizeMode] = useState<"list" | "identify">("list");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [ingredientCategoryFilter, setIngredientCategoryFilter] = useState("");
  const [ingredientEditMode, setIngredientEditMode] = useState(false);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<Set<string>>(new Set());
  const [confirmDeleteIngredients, setConfirmDeleteIngredients] = useState(false);
  const [deletingIngredients, setDeletingIngredients] = useState(false);
  const [expandedIngredientId, setExpandedIngredientId] = useState<string | null>(null);
  const [createIngredientFor, setCreateIngredientFor] = useState<string | null>(null);
  const [normalizeSaving, setNormalizeSaving] = useState(false);
  const [editModalIngredient, setEditModalIngredient] = useState<Ingredient | null>(null);
  const [mergeFor, setMergeFor] = useState<string | null>(null);
  const [mergingIntoId, setMergingIntoId] = useState("");
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeHighlight, setMergeHighlight] = useState(-1);

  // AI suggestion state
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiChecked, setAiChecked] = useState<Set<number>>(new Set());
  const [aiConfirming, setAiConfirming] = useState(false);

  async function deleteSelectedIngredients() {
    setDeletingIngredients(true);
    try {
      await Promise.all(
        Array.from(selectedIngredientIds).map((id) =>
          fetch(`/api/compras/ingredients/${id}`, { method: "DELETE" })
        )
      );
      setIngredients((prev) => prev.filter((i) => !selectedIngredientIds.has(i.id)));
      setSelectedIngredientIds(new Set());
      setIngredientEditMode(false);
      fetchNormalize();
    } catch { /* ignore */ }
    finally {
      setDeletingIngredients(false);
      setConfirmDeleteIngredients(false);
    }
  }

  return (
    <div>
      <style>{`
        .ing-row {
          transition: background 0.15s ease;
          cursor: pointer;
        }
        .ing-row:hover {
          background: var(--surface-raised) !important;
        }
        .ing-row-expand {
          display: grid;
          transition: grid-template-rows 0.22s ease;
        }
        .ing-row-expand > div { overflow: hidden; min-height: 0; }
        .ing-chevron {
          transition: transform 0.2s ease;
        }
        .ing-grid { grid-template-columns: 1fr 28px; }
        @media (min-width: 640px) { .ing-grid { grid-template-columns: 1fr 130px 56px 28px; } }
      `}</style>

      {normalizeLoading && (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
        </div>
      )}

      {!normalizeLoading && normalizeMode === "list" && (() => {
        const q = ingredientSearch.trim().toLowerCase();
        const filteredIngredients = ingredients.filter(i => {
          const matchesSearch = !q ||
            i.canonical_name.toLowerCase().includes(q) ||
            i.aliases.some(a => a.toLowerCase().includes(q));
          const matchesCat = !ingredientCategoryFilter || i.category === ingredientCategoryFilter;
          return matchesSearch && matchesCat;
        });
        const uniqueCategories = Array.from(new Set(
          ingredients.map(i => i.category).filter(Boolean)
        )).sort() as string[];

        return (
          <>
            {/* Toolbar */}
            <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:flex-wrap sm:items-center">
              {/* Search */}
              <div className="relative w-full sm:flex-1 sm:min-w-[180px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "var(--text-muted)" }}>
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar ingrediente o alias…"
                  value={ingredientSearch}
                  onChange={e => setIngredientSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-sm rounded-[var(--radius-sm)] border focus:outline-none"
                  style={{
                    background: "var(--surface)",
                    borderColor: ingredientSearch ? "var(--blue)" : "var(--border)",
                    color: "var(--text)",
                    transition: "border-color 0.15s ease",
                  }}
                />
                {ingredientSearch && (
                  <button type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                    onClick={() => setIngredientSearch("")}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M1 1l9 9M10 1L1 10" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Category filter */}
              {uniqueCategories.length > 0 && (
                <div className="relative">
                  <select
                    value={ingredientCategoryFilter}
                    onChange={e => setIngredientCategoryFilter(e.target.value)}
                    className="pl-3 pr-7 py-1.5 text-xs rounded-[var(--radius-sm)] border appearance-none cursor-pointer focus:outline-none"
                    style={{
                      background: "var(--surface)",
                      borderColor: ingredientCategoryFilter ? "var(--blue)" : "var(--border)",
                      color: ingredientCategoryFilter ? "var(--text)" : "var(--text-muted)",
                      transition: "border-color 0.15s ease",
                    }}>
                    <option value="">Categoría</option>
                    {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: "var(--text-dim)" }}>
                    <path d="M1.5 3.5l3.5 3 3.5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1 min-w-0" />

              {/* Count */}
              <span className="text-[10px] flex-shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                {filteredIngredients.length}{(q || ingredientCategoryFilter) ? ` / ${ingredients.length}` : ""} ingrediente{ingredients.length !== 1 ? "s" : ""}
              </span>

              {/* Identify mode button */}
              {unmatchedCount > 0 && (
                <button type="button"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium flex-shrink-0"
                  style={{ background: "var(--blue-glow)", color: "var(--blue)", border: "1px solid color-mix(in srgb, var(--blue) 25%, transparent)" }}
                  onClick={() => setNormalizeMode("identify")}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Identificar {unmatchedCount}
                </button>
              )}

              {/* Edit mode controls */}
              {ingredients.length > 0 && (
                <>
                  {ingredientEditMode && selectedIngredientIds.size > 0 && (
                    <button type="button"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium flex-shrink-0"
                      style={{ background: "#fee2e2", color: "#b91c1c" }}
                      onClick={() => setConfirmDeleteIngredients(true)}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                        <path d="M6 2h4M2 5h12M4.5 5l1 9a.5.5 0 00.5.5h4a.5.5 0 00.5-.5l1-9M6.5 8v4M9.5 8v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Eliminar ({selectedIngredientIds.size})
                    </button>
                  )}
                  <button type="button"
                    className="px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium flex-shrink-0"
                    style={{
                      background: ingredientEditMode ? "var(--surface)" : "var(--surface-raised)",
                      color: ingredientEditMode ? "var(--text)" : "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }}
                    onClick={() => { setIngredientEditMode(m => !m); setSelectedIngredientIds(new Set()); setExpandedIngredientId(null); }}>
                    {ingredientEditMode ? "Cancelar" : "Editar"}
                  </button>
                </>
              )}
            </div>

            {/* Ingredient list table */}
            {ingredients.length === 0 ? (
              <div className="rounded-[var(--radius)] border py-14 text-center"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <p className="text-sm" style={{ color: "var(--text-dim)" }}>Ningún ingrediente registrado aún</p>
              </div>
            ) : filteredIngredients.length === 0 ? (
              <div className="rounded-[var(--radius)] border py-10 text-center"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <p className="text-sm" style={{ color: "var(--text-dim)" }}>Sin resultados</p>
                <button type="button" className="mt-2 text-xs underline" style={{ color: "var(--text-muted)" }}
                  onClick={() => { setIngredientSearch(""); setIngredientCategoryFilter(""); }}>
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="rounded-[var(--radius)] border overflow-hidden"
                style={{ borderColor: "var(--border)" }}>
                {/* Column headers */}
                <div className="ing-grid grid px-4 py-2 border-b select-none"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface-raised)",
                  }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Ingrediente</span>
                  <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Categoría</span>
                  <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Unidad</span>
                  <span />
                </div>

                {/* Rows */}
                <div style={{ background: "var(--surface)" }}>
                  {filteredIngredients.map((ing) => {
                    const isExpanded = expandedIngredientId === ing.id && !ingredientEditMode;
                    const isChecked = selectedIngredientIds.has(ing.id);
                    return (
                      <div key={ing.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                        {/* Row */}
                        <div
                          className="ing-row ing-grid grid px-4 py-2.5"
                          style={{
                            background: isChecked ? "var(--blue-glow)" : isExpanded ? "var(--surface-raised)" : undefined,
                          }}
                          onClick={() => {
                            if (ingredientEditMode) {
                              setSelectedIngredientIds(prev => {
                                const next = new Set(prev);
                                isChecked ? next.delete(ing.id) : next.add(ing.id);
                                return next;
                              });
                            } else {
                              setExpandedIngredientId(isExpanded ? null : ing.id);
                            }
                          }}>
                          {/* Name + aliases */}
                          <div className="min-w-0 flex items-center gap-2 pr-3">
                            {ingredientEditMode && (
                              <input type="checkbox" readOnly checked={isChecked}
                                className="flex-shrink-0 accent-[#0450A9]" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                                {ing.canonical_name}
                              </p>
                              {ing.aliases.length > 0 && (
                                <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                                  {ing.aliases.join(" · ")}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Category */}
                          <div className="hidden sm:flex items-center">
                            {ing.category && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full truncate max-w-full"
                                style={{ background: "var(--blue-glow)", color: "var(--blue)" }}>
                                {ing.category}
                              </span>
                            )}
                          </div>

                          {/* Unit */}
                          <div className="hidden sm:flex items-center">
                            {ing.default_unit && (
                              <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                                {ing.default_unit}
                              </span>
                            )}
                          </div>

                          {/* Chevron */}
                          {!ingredientEditMode && (
                            <div className="flex items-center justify-center">
                              <svg className="ing-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"
                                style={{ color: "var(--text-dim)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Inline edit (expand) */}
                        <div className="ing-row-expand" style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
                          <div>
                            <div className="border-t" style={{ borderColor: "var(--border-subtle)", background: "var(--surface)" }}>
                              <div className="p-5">
                                <IngredientEditRow
                                  ingredient={ing}
                                  onClose={() => setExpandedIngredientId(null)}
                                  onSaved={(updated) => {
                                    setIngredients(prev => prev.map(i => i.id === updated.id ? updated : i));
                                    setExpandedIngredientId(null);
                                  }}
                                  onDeleted={(id) => {
                                    setIngredients(prev => prev.filter(i => i.id !== id));
                                    setExpandedIngredientId(null);
                                    fetchNormalize();
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {!normalizeLoading && normalizeMode === "identify" && (() => {
        const identifySearch = ingredientSearch.trim().toLowerCase();
        const identifyFiltered = identifySearch
          ? ingredients.filter(i =>
              i.canonical_name.toLowerCase().includes(identifySearch) ||
              i.aliases.some(a => a.toLowerCase().includes(identifySearch))
            )
          : ingredients;

        return (
          <div>
            {/* Identify mode header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <button type="button"
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-[var(--radius-sm)]"
                  style={{ background: "var(--surface-raised)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  onClick={() => { setNormalizeMode("list"); setIngredientSearch(""); }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M7.5 2L3 6l4.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Salir
                </button>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Modo identificar</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: "var(--blue-glow)", color: "var(--blue)" }}>
                  {unmatched.length} sin identificar
                </span>
              </div>
            </div>

            {/* AI loading bar */}
            {aiLoading && (
              <div className="mb-3 px-4 py-2.5 rounded-[var(--radius-sm)] border"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Analizando con IA…</span>
                  <span className="text-xs font-medium" style={{ color: "var(--blue)" }}>{aiProgress}%</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${aiProgress}%`, background: "var(--blue)", transition: "width 0.4s ease-out" }} />
                </div>
              </div>
            )}

            {/* 50/50 split — stacked on mobile, side-by-side on md+ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ minHeight: 500 }}>

              {/* Left: unidentified */}
              <div className="rounded-[var(--radius)] border overflow-hidden flex flex-col"
                style={{ borderColor: "var(--border)", height: "clamp(480px, 70vh, 900px)" }}>
                <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0"
                  style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>Sin identificar</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                      style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      {unmatched.length}
                    </span>
                  </div>
                  {!aiSuggestions && unmatched.length > 0 && (
                    <button type="button"
                      disabled={aiLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium"
                      style={{ background: "var(--blue-glow)", color: "var(--blue)", border: "1px solid color-mix(in srgb, var(--blue) 25%, transparent)", opacity: aiLoading ? 0.6 : 1 }}
                      onClick={async () => {
                        setAiLoading(true); setAiProgress(0);
                        const startTime = Date.now();
                        const progressInterval = setInterval(() => {
                          const elapsed = (Date.now() - startTime) / 1000;
                          setAiProgress(Math.min(85, Math.round(85 * (1 - Math.exp(-elapsed / 20)))));
                        }, 300);
                        try {
                          const res = await fetch("/api/compras/ingredients/suggest-batch", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ items: unmatched, existingIngredients: ingredients }),
                          });
                          let data: { suggestions?: AISuggestion[]; error?: string };
                          try { data = await res.json(); } catch { alert("Error: respuesta no válida"); return; }
                          if (res.ok) {
                            setAiProgress(100);
                            const suggestions = data.suggestions ?? [];
                            if (suggestions.length === 0) { alert("La IA no devolvió sugerencias."); }
                            else { setAiSuggestions(suggestions); setAiChecked(new Set(suggestions.map((_: AISuggestion, i: number) => i))); }
                          } else { alert(`Error ${res.status}: ${data.error ?? "Error desconocido"}`); }
                        } catch (err: unknown) {
                          alert(`Error de red: ${err instanceof Error ? err.message : String(err)}`);
                        } finally { clearInterval(progressInterval); setAiLoading(false); setAiProgress(0); }
                      }}>
                      {aiLoading ? (
                        <><div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />Analizando...</>
                      ) : (
                        <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" /></svg>Sugerir con IA</>
                      )}
                    </button>
                  )}
                  {aiSuggestions && (
                    <button type="button"
                      className="text-xs px-2 py-1 rounded"
                      style={{ color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--border)" }}
                      onClick={() => { setAiSuggestions(null); setAiChecked(new Set()); }}>
                      Volver
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1" style={{ background: "var(--surface)" }}>
                  {aiSuggestions ? (
                    (() => {
                      const merges = aiSuggestions.filter(s => s.action === "merge");
                      const creates = aiSuggestions.filter(s => s.action === "create");
                      return (
                        <>
                          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                            {/* Merge section */}
                            {merges.length > 0 && (
                              <>
                                <div className="px-4 py-2 flex-shrink-0" style={{ background: "var(--surface-raised)" }}>
                                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                                    Unir con existentes ({merges.length})
                                  </span>
                                </div>
                                {merges.map((s, i) => {
                                  const idx = aiSuggestions.indexOf(s);
                                  const checked = aiChecked.has(idx);
                                  return (
                                    <div key={i}
                                      className="px-4 py-2.5 cursor-pointer transition-colors duration-100"
                                      style={{ background: checked ? "color-mix(in srgb, var(--blue) 8%, transparent)" : undefined }}
                                      onClick={() => setAiChecked(prev => {
                                        const next = new Set(prev);
                                        checked ? next.delete(idx) : next.add(idx); return next;
                                      })}>
                                      <div className="flex items-start gap-2">
                                        <input type="checkbox" readOnly checked={checked} className="mt-0.5 flex-shrink-0 accent-[#0450A9]" />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[10px] px-1.5 py-px rounded font-medium flex-shrink-0"
                                              style={{ background: "color-mix(in srgb, var(--blue) 12%, transparent)", color: "var(--blue)" }}>→ {s.canonicalName}</span>
                                            <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-dim)" }}>{s.matchCount} art.</span>
                                          </div>
                                          <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>{s.aliases.join(" · ")}</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            )}
                            {/* Create section */}
                            {creates.length > 0 && (
                              <>
                                <div className="px-4 py-2 flex-shrink-0" style={{ background: "var(--surface-raised)" }}>
                                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                                    Crear nuevos ({creates.length})
                                  </span>
                                </div>
                                {creates.map((s, i) => {
                                  const idx = aiSuggestions.indexOf(s);
                                  const checked = aiChecked.has(idx);
                                  return (
                                    <div key={i}
                                      className="px-4 py-2.5 cursor-pointer transition-colors duration-100"
                                      style={{ background: checked ? "var(--blue-glow)" : undefined }}
                                      onClick={() => setAiChecked(prev => {
                                        const next = new Set(prev);
                                        checked ? next.delete(idx) : next.add(idx); return next;
                                      })}>
                                      <div className="flex items-start gap-2">
                                        <input type="checkbox" readOnly checked={checked} className="mt-0.5 flex-shrink-0 accent-[#0450A9]" />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{s.canonicalName}</p>
                                            <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-dim)" }}>{s.matchCount} art.</span>
                                          </div>
                                          {s.category && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.category}</p>}
                                          <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-dim)" }}>{s.aliases.join(" · ")}</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                          <div className="sticky bottom-0 px-4 py-3 border-t flex items-center justify-between gap-3"
                            style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{aiChecked.size} / {aiSuggestions.length}</span>
                            <Button size="sm" loading={aiConfirming} disabled={aiChecked.size === 0}
                              onClick={async () => {
                                setAiConfirming(true);
                                try {
                                  const selected = aiSuggestions.filter((_, i) => aiChecked.has(i));
                                  for (const s of selected) {
                                    if (s.action === "merge" && s.existingId) {
                                      // Add each alias to the existing ingredient (and propagate to line_items)
                                      const existing = ingredients.find(ing => ing.id === s.existingId);
                                      const existingAliasSet = new Set(existing?.aliases ?? []);
                                      for (const alias of s.aliases) {
                                        if (!existingAliasSet.has(alias)) {
                                          await fetch(`/api/compras/ingredients/${s.existingId}`, {
                                            method: "PUT", headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ addAlias: alias }),
                                          });
                                        }
                                      }
                                    } else if (s.action === "create") {
                                      await fetch("/api/compras/ingredients", {
                                        method: "POST", headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ canonicalName: s.canonicalName, aliases: s.aliases, category: s.category || null }),
                                      });
                                    }
                                  }
                                  setAiSuggestions(null); setAiChecked(new Set()); fetchNormalize();
                                } finally { setAiConfirming(false); }
                              }}>
                              Confirmar ({aiChecked.size})
                            </Button>
                          </div>
                        </>
                      );
                    })()
                  ) : unmatched.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm" style={{ color: "var(--text-dim)" }}>Todo identificado ✓</p>
                    </div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                      {unmatched.map((u) => (
                        <div key={u.description} className="flex items-center justify-between gap-3 px-4 py-2.5"
                          style={{ transition: "background 0.1s ease" }}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate" style={{ color: "var(--text)" }}>{u.description}</p>
                            <div className="flex items-center gap-1 flex-wrap mt-0.5">
                              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{u.count} artículo{u.count !== 1 ? "s" : ""}</p>
                              {(u.suppliers ?? []).slice(0, 2).map((s) => (
                                <span key={s} className="text-[9px] px-1.5 py-px rounded"
                                  style={{ background: "var(--surface-raised)", color: "var(--text-dim)", border: "1px solid var(--border-subtle)" }}>
                                  {s}
                                </span>
                              ))}
                              {(u.suppliers ?? []).length > 2 && (
                                <span className="text-[9px] px-1 py-px" style={{ color: "var(--text-dim)" }}>
                                  +{u.suppliers.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button type="button"
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ background: "var(--blue-glow)", color: "var(--blue)" }}
                              onClick={() => { setCreateIngredientFor(u.description); setMergeFor(null); }}>
                              Nuevo
                            </button>
                            <button type="button"
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ background: "var(--surface-raised)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                              onClick={() => { setMergeFor(u.description); setCreateIngredientFor(null); setMergingIntoId(""); }}>
                              Unir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: ingredients reference */}
              <div className="rounded-[var(--radius)] border overflow-hidden flex flex-col"
                style={{ borderColor: "var(--border)", height: "clamp(480px, 70vh, 900px)" }}>
                <div className="px-4 py-3 border-b flex-shrink-0"
                  style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "var(--text-muted)" }}>
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    <input type="text" placeholder="Buscar ingrediente…"
                      value={ingredientSearch}
                      onChange={e => setIngredientSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-sm rounded-[var(--radius-sm)] border focus:outline-none"
                      style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 divide-y" style={{ borderColor: "var(--border-subtle)", background: "var(--surface)" }}>
                  {identifyFiltered.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm" style={{ color: "var(--text-dim)" }}>Sin resultados</p>
                    </div>
                  ) : identifyFiltered.map((ing) => (
                    <div key={ing.id} className="px-4 py-2.5">
                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{ing.canonical_name}</p>
                      {ing.category && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{ing.category}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create Ingredient Modal */}
      <Modal
        open={!!createIngredientFor}
        onClose={() => setCreateIngredientFor(null)}
        title="Crear ingrediente"
        maxWidth="max-w-sm"
      >
        <CreateIngredientForm
          initialName={createIngredientFor ?? ""}
          onSave={async (canonicalName, category) => {
            setNormalizeSaving(true);
            try {
              const res = await fetch("/api/compras/ingredients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ canonicalName, aliases: [createIngredientFor], category: category || null }),
              });
              if (res.ok) { setCreateIngredientFor(null); fetchNormalize(); }
            } finally { setNormalizeSaving(false); }
          }}
          onClose={() => setCreateIngredientFor(null)}
          saving={normalizeSaving}
        />
      </Modal>

      {/* Edit Ingredient Modal */}
      <Modal
        open={!!editModalIngredient}
        onClose={() => setEditModalIngredient(null)}
        title="Editar ingrediente"
        maxWidth="max-w-sm"
      >
        {editModalIngredient && (
          <IngredientEditRow
            ingredient={editModalIngredient}
            onClose={() => setEditModalIngredient(null)}
            onSaved={(updated) => {
              setIngredients((prev) => prev.map((i) => i.id === updated.id ? updated : i));
              setEditModalIngredient(null);
            }}
            onDeleted={(id) => {
              setIngredients((prev) => prev.filter((i) => i.id !== id));
              setEditModalIngredient(null);
              fetchNormalize();
            }}
          />
        )}
      </Modal>

      {/* Merge Modal */}
      <Modal
        open={!!mergeFor}
        onClose={() => { setMergeFor(null); setMergeQuery(""); setMergeOpen(false); setMergeHighlight(-1); }}
        title="Unir con ingrediente existente"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Agregar <span className="font-medium" style={{ color: "var(--text)" }}>"{mergeFor}"</span> como alias de:
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Seleccionar ingrediente..."
              value={mergeOpen ? mergeQuery : (ingredients.find((i) => i.id === mergingIntoId)?.canonical_name ?? "")}
              className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: mergingIntoId && !mergeOpen ? "var(--text)" : "var(--text-dim)" }}
              onFocus={() => { setMergeOpen(true); setMergeQuery(""); }}
              onChange={(e) => { setMergeQuery(e.target.value); setMergeHighlight(-1); }}
              onBlur={() => setTimeout(() => setMergeOpen(false), 150)}
              onKeyDown={(e) => {
                const filtered = mergeQuery.trim()
                  ? ingredients.filter((i) => i.canonical_name.toLowerCase().includes(mergeQuery.toLowerCase()))
                  : ingredients;
                if (e.key === "ArrowDown") { e.preventDefault(); setMergeHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setMergeHighlight((h) => Math.max(h - 1, 0)); }
                else if (e.key === "Enter") { e.preventDefault(); if (mergeHighlight >= 0 && filtered[mergeHighlight]) { setMergingIntoId(filtered[mergeHighlight].id); setMergeQuery(""); setMergeOpen(false); setMergeHighlight(-1); } }
                else if (e.key === "Escape") setMergeOpen(false);
              }}
            />
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {mergeOpen && (() => {
              const filtered = mergeQuery.trim()
                ? ingredients.filter((i) => i.canonical_name.toLowerCase().includes(mergeQuery.toLowerCase()))
                : ingredients;
              return (
                <div className="absolute z-50 w-full mt-1 rounded-[var(--radius-sm)] border shadow-lg overflow-y-auto"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", maxHeight: 200 }}>
                  {filtered.length === 0 ? (
                    <div className="px-3 py-2 text-xs" style={{ color: "var(--text-dim)" }}>Sin resultados</div>
                  ) : filtered.map((ing, i) => (
                    <button key={ing.id} type="button"
                      className="w-full text-left px-3 py-2 text-sm"
                      style={{ background: i === mergeHighlight ? "var(--blue-glow)" : "transparent", color: i === mergeHighlight ? "var(--blue)" : "var(--text)" }}
                      onMouseDown={() => { setMergingIntoId(ing.id); setMergeQuery(""); setMergeOpen(false); setMergeHighlight(-1); }}
                      onMouseEnter={() => setMergeHighlight(i)}
                    >
                      {ing.canonical_name}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setMergeFor(null); setMergeQuery(""); setMergeOpen(false); setMergeHighlight(-1); }}>Cancelar</Button>
            <Button size="sm" loading={normalizeSaving} disabled={!mergingIntoId}
              onClick={async () => {
                if (!mergeFor || !mergingIntoId) return;
                setNormalizeSaving(true);
                try {
                  const res = await fetch(`/api/compras/ingredients/${mergingIntoId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ addAlias: mergeFor }),
                  });
                  if (res.ok) { setMergeFor(null); setMergingIntoId(""); setMergeQuery(""); setMergeOpen(false); setMergeHighlight(-1); fetchNormalize(); }
                } finally { setNormalizeSaving(false); }
              }}
            >
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete ingredients confirmation modal */}
      <Modal
        open={confirmDeleteIngredients}
        onClose={() => setConfirmDeleteIngredients(false)}
        title="Eliminar ingredientes"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            ¿Eliminar <span className="font-medium" style={{ color: "var(--text)" }}>{selectedIngredientIds.size} ingrediente{selectedIngredientIds.size !== 1 ? "s" : ""}</span>? Los artículos vinculados quedarán sin asignar. Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteIngredients(false)}>Cancelar</Button>
            <Button variant="danger" size="sm" loading={deletingIngredients} onClick={deleteSelectedIngredients}>Eliminar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Create Ingredient Form ────────────────────────────────────────
function CreateIngredientForm({
  initialName,
  onSave,
  onClose,
  saving,
}: {
  initialName: string;
  onSave: (canonicalName: string, category: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState("");
  const [catQuery, setCatQuery] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [catHighlight, setCatHighlight] = useState(-1);

  const allCats = ["Sin categoría", ...(dropdownOptions.concepto as string[])];
  const filteredCats = catQuery.trim()
    ? allCats.filter((c) => c.toLowerCase().includes(catQuery.toLowerCase()))
    : allCats;

  function selectCat(val: string) {
    setCategory(val === "Sin categoría" ? "" : val);
    setCatQuery("");
    setCatOpen(false);
    setCatHighlight(-1);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Nombre canónico *</label>
        <input type="text" value={name}
          className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          onChange={(e) => setName(e.target.value)} />
        <p className="text-[10px] mt-1" style={{ color: "var(--text-dim)" }}>
          El alias "{initialName}" se agrega automáticamente.
        </p>
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Categoría</label>
        <div className="relative mt-1">
          <input
            type="text"
            value={catOpen ? catQuery : (category || "")}
            placeholder="Sin categoría"
            className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: category && !catOpen ? "var(--text)" : "var(--text-dim)" }}
            onFocus={() => { setCatOpen(true); setCatQuery(""); }}
            onChange={(e) => { setCatQuery(e.target.value); setCatHighlight(-1); }}
            onBlur={() => setTimeout(() => setCatOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCatHighlight((i) => Math.min(i + 1, filteredCats.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setCatHighlight((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); if (catHighlight >= 0 && filteredCats[catHighlight]) selectCat(filteredCats[catHighlight]); }
              else if (e.key === "Escape") setCatOpen(false);
            }}
          />
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {catOpen && (
            <div className="absolute z-50 w-full mt-1 rounded-[var(--radius-sm)] border shadow-lg overflow-y-auto"
              style={{ background: "var(--surface)", borderColor: "var(--border)", maxHeight: 200 }}>
              {filteredCats.length === 0 ? (
                <div className="px-3 py-2 text-xs" style={{ color: "var(--text-dim)" }}>Sin resultados</div>
              ) : filteredCats.map((c, i) => (
                <button key={c} type="button"
                  className="w-full text-left px-3 py-2 text-sm"
                  style={{
                    background: i === catHighlight ? "var(--blue-glow)" : "transparent",
                    color: i === catHighlight ? "var(--blue)" : "var(--text)",
                  }}
                  onMouseDown={() => selectCat(c)}
                  onMouseEnter={() => setCatHighlight(i)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" loading={saving} disabled={!name.trim()} onClick={() => onSave(name.trim(), category)}>
          Crear
        </Button>
      </div>
    </div>
  );
}

// ─── Ingredient Edit Row ───────────────────────────────────────────
function IngredientEditRow({
  ingredient,
  onClose,
  onSaved,
  onDeleted,
}: {
  ingredient: Ingredient;
  onClose: () => void;
  onSaved: (updated: Ingredient) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(ingredient.canonical_name);
  const [category, setCategory] = useState(ingredient.category ?? "");
  const [defaultUnit, setDefaultUnit] = useState(ingredient.default_unit ?? "");
  const [aliases, setAliases] = useState<string[]>(ingredient.aliases);
  const [newAlias, setNewAlias] = useState("");
  const aliasInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [catQuery, setCatQuery] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [catHighlight, setCatHighlight] = useState(-1);

  const allCats = ["Sin categoría", ...(dropdownOptions.concepto as string[])];
  const filteredCats = catQuery.trim()
    ? allCats.filter((c) => c.toLowerCase().includes(catQuery.toLowerCase()))
    : allCats;

  function selectCat(val: string) {
    setCategory(val === "Sin categoría" ? "" : val);
    setCatQuery("");
    setCatOpen(false);
    setCatHighlight(-1);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/compras/ingredients/${ingredient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalName: name.trim(),
          aliases,
          category: category || null,
          defaultUnit: defaultUnit || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onSaved({ ...ingredient, ...updated, default_unit: updated.default_unit ?? null });
      }
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/compras/ingredients/${ingredient.id}`, { method: "DELETE" });
      onDeleted(ingredient.id);
    } finally { setDeleting(false); }
  }

  function removeAlias(a: string) {
    setAliases((prev) => prev.filter((x) => x !== a));
  }

  function addAlias() {
    const trimmed = newAlias.trim();
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases((prev) => [...prev, trimmed]);
    }
    setNewAlias("");
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
          style={{ color: "var(--text-muted)" }}>Nombre canónico</label>
        <input type="text" value={name}
          className="w-full px-3 py-2.5 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
          style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: "var(--text)" }}
          onChange={(e) => setName(e.target.value)} />
      </div>

      {/* Category + Unit */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: "var(--text-muted)" }}>Categoría</label>
          <div className="relative">
            <input
              type="text"
              value={catOpen ? catQuery : (category || "")}
              placeholder="Sin categoría"
              className="w-full px-3 py-2.5 pr-8 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: category && !catOpen ? "var(--text)" : "var(--text-dim)" }}
              onFocus={() => { setCatOpen(true); setCatQuery(""); }}
              onChange={(e) => { setCatQuery(e.target.value); setCatHighlight(-1); }}
              onBlur={() => setTimeout(() => setCatOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setCatHighlight((i) => Math.min(i + 1, filteredCats.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setCatHighlight((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter") { e.preventDefault(); if (catHighlight >= 0 && filteredCats[catHighlight]) selectCat(filteredCats[catHighlight]); }
                else if (e.key === "Escape") setCatOpen(false);
              }}
            />
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {catOpen && (
              <div className="absolute z-50 w-full mt-1 rounded-[var(--radius-sm)] border shadow-lg overflow-y-auto"
                style={{ background: "var(--surface)", borderColor: "var(--border)", maxHeight: 180 }}>
                {filteredCats.map((c, i) => (
                  <button key={c} type="button"
                    className="w-full text-left px-3 py-2 text-xs"
                    style={{ background: i === catHighlight ? "var(--blue-glow)" : "transparent", color: i === catHighlight ? "var(--blue)" : "var(--text)" }}
                    onMouseDown={() => selectCat(c)}
                    onMouseEnter={() => setCatHighlight(i)}
                  >{c}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: "var(--text-muted)" }}>Unidad</label>
          <div className="relative">
            <select value={defaultUnit}
              className="w-full px-3 py-2.5 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ background: "var(--surface-raised)", borderColor: "var(--border)", color: defaultUnit ? "var(--text)" : "var(--text-dim)" }}
              onChange={(e) => setDefaultUnit(e.target.value)}>
              <option value="">—</option>
              {NORMALIZED_UNITS_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Aliases -- tag input */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
          style={{ color: "var(--text-muted)" }}>Alias</label>
        <div
          className="flex flex-wrap gap-1.5 p-2 rounded-[var(--radius-sm)] border min-h-[44px] cursor-text"
          style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}
          onClick={() => aliasInputRef.current?.focus()}
        >
          {aliases.map((a) => (
            <span key={a} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md flex-shrink-0"
              style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}>
              <span className="max-w-[160px] truncate">{a}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); removeAlias(a); }}
                className="flex-shrink-0 opacity-40 hover:opacity-80 transition-opacity ml-0.5"
                style={{ color: "var(--text-muted)", lineHeight: 1 }}>
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))}
          <input
            ref={aliasInputRef}
            type="text"
            value={newAlias}
            placeholder={aliases.length === 0 ? "Escribe y presiona Enter…" : "Agregar…"}
            className="flex-1 min-w-[120px] text-xs bg-transparent outline-none py-1 px-1"
            style={{ color: "var(--text)" }}
            onChange={(e) => setNewAlias(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addAlias(); }
              if (e.key === "Backspace" && !newAlias && aliases.length > 0) removeAlias(aliases[aliases.length - 1]);
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="pt-1">
        <div className="flex items-center gap-2">
          {/* Delete -- left side */}
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button type="button"
                className="text-xs font-semibold px-2.5 py-2 rounded-[var(--radius-sm)] transition-colors"
                style={{ background: "rgba(var(--danger-rgb,220,38,38),0.12)", color: "var(--danger)" }}
                onClick={handleDelete}>
                {deleting ? "Eliminando…" : "Sí, eliminar"}
              </button>
              <button type="button" className="text-xs px-2 py-2 transition-opacity hover:opacity-60"
                style={{ color: "var(--text-muted)" }}
                onClick={() => setConfirmDelete(false)}>No</button>
            </div>
          ) : (
            <button type="button"
              className="text-xs font-medium px-2.5 py-2 rounded-[var(--radius-sm)] transition-colors flex-shrink-0"
              style={{ background: "rgba(220,38,38,0.08)", color: "var(--danger)" }}


              onClick={() => setConfirmDelete(true)}>
              Eliminar
            </button>
          )}
          {/* Spacer */}
          <div className="flex-1" />
          {/* Cancel + Save */}
          <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
          <Button size="md" loading={saving} disabled={!name.trim()} onClick={handleSave}>Guardar</Button>
        </div>
      </div>
    </div>
  );
}
