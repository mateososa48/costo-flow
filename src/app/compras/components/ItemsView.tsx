"use client";

import React, { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { DbLineItem, formatCurrency, formatDate, restaurantLabel } from "../types";

// ─── ItemsView Props ────────────────────────────────────────────────
interface ItemsViewProps {
  items: DbLineItem[];
  setItems: React.Dispatch<React.SetStateAction<DbLineItem[]>>;
  sortBy: string;
  sortDir: "asc" | "desc";
  toggleSort: (col: string) => void;
  fetchStats: () => void;
  addModalOpen: boolean;
  setAddModalOpen: (v: boolean) => void;
  supplierList: string[];
  fetchData: () => void;
  restaurantOptions: Array<{ value: string; label: string }>;
}

export default function ItemsView({
  items,
  setItems,
  sortBy,
  sortDir,
  toggleSort,
  fetchStats,
  addModalOpen,
  setAddModalOpen,
  supplierList,
  fetchData,
  restaurantOptions,
}: ItemsViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState("");
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteTarget = items.find((i) => i.id === deleteConfirmId);

  function startEdit(id: string, field: string, currentValue: string) {
    setEditingId(id);
    setEditField(field);
    setEditValue(currentValue);
  }

  async function saveEdit(id: string, field: string, value: string) {
    const numFields = ["quantity", "unitPrice", "total"];
    const body: Record<string, unknown> = {};
    if (numFields.includes(field)) {
      body[field] = value === "" ? null : parseFloat(value);
    } else {
      body[field] = value || null;
    }

    const previous = items;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item };
        if (field === "description") updated.description = value;
        if (field === "quantity") updated.quantity = value ? parseFloat(value) : null;
        if (field === "unit") updated.unit = value || null;
        if (field === "unitPrice") updated.unit_price = value ? parseFloat(value) : null;
        if (field === "total") updated.total = parseFloat(value) || 0;
        return updated;
      })
    );
    setEditingId(null);
    setSavingId(id);
    setSaveError("");

    try {
      const res = await fetch(`/api/compras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setItems(previous);
        setSaveError("No se pudo guardar el cambio. Intenta de nuevo.");
      }
    } catch {
      setItems(previous);
      setSaveError("Error de conexión. El cambio no fue guardado.");
    } finally {
      setSavingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await fetch(`/api/compras/${deleteConfirmId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== deleteConfirmId));
      fetchStats();
    } catch { /* ignore */ }
    finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  }

  return (
    <>
      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-[var(--radius)] border"
          style={{ borderColor: "var(--danger)", background: "var(--danger-dim)" }}>
          <p className="text-sm" style={{ color: "var(--danger)" }}>{saveError}</p>
          <button type="button" className="text-xs font-medium" style={{ color: "var(--danger)" }}
            onClick={() => setSaveError("")}>Cerrar</button>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-[var(--radius)] border overflow-hidden"
            style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--surface-raised)" }}>
                  {[
                    { key: "date", label: "Fecha" },
                    { key: "supplier", label: "Proveedor" },
                    { key: "description", label: "Descripción" },
                    { key: "", label: "Cant." },
                    { key: "", label: "Unidad" },
                    { key: "", label: "P. Unit." },
                    { key: "total", label: "Total" },
                    { key: "", label: "" },
                  ].map(({ key, label }, i) => (
                    <th
                      key={i}
                      className={`px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider ${key ? "cursor-pointer select-none" : ""}`}
                      style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}
                      onClick={key ? () => toggleSort(key) : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {key && sortBy === key && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
                            style={{ transform: sortDir === "asc" ? "rotate(180deg)" : "" }}>
                            <path d="M4 6L1 2h6L4 6z" />
                          </svg>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className="transition-colors duration-100 hover-blue-row"
                    style={{ background: idx % 2 === 0 ? "var(--surface)" : "var(--surface-raised)" }}>
                    <td className="px-3 py-3 whitespace-nowrap" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                      {formatDate(item.invoice_date)}
                    </td>
                    <td className="px-3 py-3 max-w-[140px] truncate" style={{ color: "var(--text)", borderBottom: "1px solid var(--border-subtle)" }}>
                      {item.supplier}
                    </td>
                    {/* Editable cells */}
                    {[
                      { field: "description", val: item.description, w: "max-w-[200px]" },
                      { field: "quantity", val: item.quantity != null ? String(item.quantity) : "", w: "w-16" },
                      { field: "unit", val: item.unit_normalized ?? item.unit ?? "", w: "w-16" },
                      { field: "unitPrice", val: item.unit_price != null ? String(item.unit_price) : "", w: "w-20" },
                      { field: "total", val: String(item.total), w: "w-24" },
                    ].map(({ field, val, w }) => (
                      <td key={field} className={`px-3 py-3 ${w}`}
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        {editingId === item.id && editField === field ? (
                          <input
                            type={["quantity", "unitPrice", "total"].includes(field) ? "number" : "text"}
                            value={editValue}
                            step="any"
                            autoFocus
                            className="w-full px-1.5 py-0.5 rounded border text-sm focus:outline-none focus:ring-1"
                            style={{ background: "var(--surface)", borderColor: "var(--blue)", color: "var(--text)" }}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(item.id, field, editValue)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(item.id, field, editValue);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                        ) : (
                          <span
                            className="group/cell cursor-pointer truncate inline-flex items-center gap-1"
                            style={{ color: field === "total" ? "var(--blue)" : "var(--text)" }}
                            onClick={() => startEdit(item.id, field, val)}
                          >
                            <span className="group-hover/cell:underline">
                              {field === "total" || field === "unitPrice"
                                ? (val ? formatCurrency(parseFloat(val)) : "—")
                                : (val || "—")}
                            </span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              className="opacity-0 group-hover/cell:opacity-40 transition-opacity flex-shrink-0"
                              style={{ color: "var(--text-dim)" }}>
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      {savingId === item.id ? (
                        <div className="w-6 h-6 flex items-center justify-center">
                          <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--blue)", borderTopColor: "transparent" }} />
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-6 h-6 rounded flex items-center justify-center transition-colors duration-150 hover-danger"
                          style={{ color: "var(--text-dim)" }}
                          onClick={() => setDeleteConfirmId(item.id)}
                          aria-label="Eliminar"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {items.map((item) => (
              <MobileItemCard key={item.id} item={item} onDelete={() => setDeleteConfirmId(item.id)} onEdit={(field, val) => startEdit(item.id, field, val)}
                editingId={editingId} editField={editField} editValue={editValue}
                setEditValue={setEditValue} onSaveEdit={(field, val) => saveEdit(item.id, field, val)}
                onCancelEdit={() => setEditingId(null)} itemId={item.id} />
            ))}
          </div>
        </>
      )}

      {/* Add Item Modal */}
      <AddItemModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={() => { setAddModalOpen(false); fetchData(); fetchStats(); }}
        supplierList={supplierList}
        restaurantOptions={restaurantOptions}
      />

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Eliminar artículo"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            ¿Eliminar{" "}
            <span className="font-medium" style={{ color: "var(--text)" }}>
              {deleteTarget?.description ?? "este artículo"}
            </span>
            ? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={confirmDelete}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ─── Mobile Item Card ─────────────────────────────────────────────
function MobileItemCard({
  item,
  onDelete,
  onEdit,
  editingId,
  editField,
  editValue,
  setEditValue,
  onSaveEdit,
  onCancelEdit,
  itemId,
}: {
  item: DbLineItem;
  onDelete: () => void;
  onEdit: (field: string, val: string) => void;
  editingId: string | null;
  editField: string;
  editValue: string;
  setEditValue: (v: string) => void;
  onSaveEdit: (field: string, val: string) => void;
  onCancelEdit: () => void;
  itemId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-[var(--radius)] border" style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{item.description || "Sin descripción"}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>{item.supplier}</span>
            <span>·</span>
            <span>{formatDate(item.invoice_date)}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-semibold" style={{ color: "var(--blue)" }}>{formatCurrency(item.total)}</p>
          {item.quantity != null && (
            <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
              {item.quantity} {item.unit_normalized ?? item.unit ?? ""} × {item.unit_price != null ? formatCurrency(item.unit_price) : "—"}
            </p>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t px-3 py-2.5 space-y-2" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-raised)" }}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: "Descripción", field: "description", val: item.description },
              { label: "Cantidad", field: "quantity", val: item.quantity != null ? String(item.quantity) : "" },
              { label: "Unidad", field: "unit", val: item.unit_normalized ?? item.unit ?? "" },
              { label: "P. Unitario", field: "unitPrice", val: item.unit_price != null ? String(item.unit_price) : "" },
              { label: "Total", field: "total", val: String(item.total) },
            ].map(({ label, field, val }) => (
              <div key={field}>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-dim)" }}>{label}</p>
                {editingId === itemId && editField === field ? (
                  <input
                    type={["quantity", "unitPrice", "total"].includes(field) ? "number" : "text"}
                    value={editValue}
                    step="any"
                    autoFocus
                    className="w-full px-1.5 py-0.5 rounded border text-xs focus:outline-none focus:ring-1"
                    style={{ background: "var(--surface)", borderColor: "var(--blue)", color: "var(--text)" }}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => onSaveEdit(field, editValue)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSaveEdit(field, editValue);
                      if (e.key === "Escape") onCancelEdit();
                    }}
                  />
                ) : (
                  <p
                    className="cursor-pointer inline-flex items-center gap-1"
                    style={{ color: "var(--text)" }}
                    onClick={(e) => { e.stopPropagation(); onEdit(field, val); }}
                  >
                    <span>{val || "—"}</span>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ color: "var(--text-dim)", opacity: 0.5, flexShrink: 0 }}>
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--pink-glow)", color: "var(--pink-dark)" }}>
              {restaurantLabel(item.restaurant)}
            </span>
            <button
              type="button"
              className="text-xs font-medium px-2 py-1 rounded transition-colors duration-150"
              style={{ color: "var(--danger)", background: "var(--danger-dim)" }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Supplier Combobox ───────────────────────────────────────────
function SupplierCombobox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => { setHighlightedIndex(-1); }, [query]);

  function select(opt: string) {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
    setHighlightedIndex(-1);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) { if (e.key === "ArrowDown") setOpen(true); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        select(filtered[highlightedIndex]);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          placeholder="Nombre..."
          className="w-full mt-1 px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
          style={{ background: "var(--surface)", borderColor: open ? "var(--blue)" : "var(--border)", color: "var(--text)", boxShadow: open ? "0 0 0 3px color-mix(in srgb, var(--blue) 15%, transparent)" : undefined }}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5"
          style={{ color: "var(--text-dim)" }}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d={open ? "M2 8l4-4 4 4" : "M2 4l4 4 4-4"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-[var(--radius-sm)] border overflow-hidden"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-elevated)" }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm" style={{ color: "var(--text-dim)" }}>
              {query.trim() ? `Agregar "${query}"` : "Sin opciones"}
            </div>
          ) : (
            <ul ref={listRef} className="max-h-48 overflow-y-auto py-1">
              {filtered.map((opt, i) => {
                const isHighlighted = i === highlightedIndex;
                const isSelected = opt === value;
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm transition-colors duration-100"
                      style={{
                        background: isHighlighted ? "var(--blue-glow)" : "transparent",
                        color: isHighlighted || isSelected ? "var(--blue)" : "var(--text)",
                        fontWeight: isSelected ? 600 : 400,
                      }}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onMouseLeave={() => setHighlightedIndex(-1)}
                      onMouseDown={(e) => { e.preventDefault(); select(opt); }}
                    >
                      {opt}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Item Modal ─────────────────────────────────────────────
function AddItemModal({
  open,
  onClose,
  onAdded,
  supplierList = [],
  restaurantOptions,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  supplierList?: string[];
  restaurantOptions: Array<{ value: string; label: string }>;
}) {
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [total, setTotal] = useState("");
  const [addRestaurant, setAddRestaurant] = useState("");
  const [addSupplier, setAddSupplier] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");

  async function handleAdd() {
    if (!description.trim() || !addSupplier.trim() || !total) {
      setAddError("Descripción, proveedor y total son requeridos");
      return;
    }
    setSaving(true);
    setAddError("");
    try {
      const res = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          quantity: quantity ? parseFloat(quantity) : null,
          unit: unit || null,
          unitPrice: unitPrice ? parseFloat(unitPrice) : null,
          total: parseFloat(total),
          restaurant: addRestaurant,
          supplier: addSupplier.trim(),
          invoiceDate,
        }),
      });
      if (!res.ok) { setAddError("Error al guardar"); return; }
      setDescription(""); setQuantity(""); setUnit(""); setUnitPrice(""); setTotal(""); setAddSupplier("");
      onAdded();
    } catch { setAddError("Error de conexión"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar artículo">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Descripción *</label>
          <input type="text" value={description} placeholder="Nombre del producto..."
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
            onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Proveedor *</label>
            <SupplierCombobox
              value={addSupplier}
              onChange={setAddSupplier}
              options={supplierList}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Restaurante</label>
            <div className="relative mt-1">
              <select value={addRestaurant}
                className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                onChange={(e) => setAddRestaurant(e.target.value)}>
                {restaurantOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-dim)" }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Cantidad</label>
            <input type="number" value={quantity} step="any" placeholder="0"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Unidad</label>
            <input type="text" value={unit} placeholder="kg"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>P. Unit.</label>
            <input type="number" value={unitPrice} step="0.01" placeholder="$0"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setUnitPrice(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total *</label>
            <input type="number" value={total} step="0.01" placeholder="$0"
              className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              onChange={(e) => setTotal(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Fecha</label>
          <input type="date" value={invoiceDate}
            className="w-full mt-1 px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
            onChange={(e) => setInvoiceDate(e.target.value)} />
        </div>
        {addError && <p className="text-xs" style={{ color: "var(--danger)" }}>{addError}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" loading={saving} onClick={handleAdd}>Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}
