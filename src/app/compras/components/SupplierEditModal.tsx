"use client";

import React, { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface OtherGroup {
  displayName: string;
  canonicalNames: string[];
}

interface Props {
  open: boolean;
  displayName: string;
  canonicalNames: string[];
  otherGroups: OtherGroup[];
  onClose: () => void;
  onSaved: () => void;
}

export default function SupplierEditModal({
  open,
  displayName,
  canonicalNames,
  otherGroups,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(displayName);
  const [canonicals, setCanonicals] = useState<string[]>([...canonicalNames]);
  const [addQuery, setAddQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(displayName);
      setCanonicals([...canonicalNames]);
      setAddQuery("");
      setAddOpen(false);
      setError("");
    }
  }, [open, displayName, canonicalNames.join(",")]);

  const absorbableGroups = otherGroups.filter(
    (g) =>
      g.displayName !== displayName &&
      (!addQuery || g.displayName.toLowerCase().includes(addQuery.toLowerCase()))
  );

  function absorb(group: OtherGroup) {
    const newNames = group.canonicalNames.filter((n) => !canonicals.includes(n));
    setCanonicals((prev) => [...prev, ...newNames]);
    setAddQuery("");
    setAddOpen(false);
  }

  function removeCanonical(rawName: string) {
    setCanonicals((prev) => prev.filter((n) => n !== rawName));
  }

  async function save() {
    if (!name.trim()) { setError("El nombre es requerido"); return; }
    if (canonicals.length === 0) { setError("Debe haber al menos un nombre original"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/compras/suppliers/aliases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name.trim(),
          canonicalNames: canonicals,
          oldDisplayName: displayName,
        }),
      });
      if (!res.ok) { setError("Error al guardar"); return; }
      onSaved();
      onClose();
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  const inputCls = "w-full px-3 py-2 rounded-[var(--radius-sm)] border text-sm focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--blue)_30%,transparent)]";

  return (
    <Modal open={open} onClose={onClose} title="Editar proveedor" maxWidth="max-w-md">
      <div className="space-y-5">

        {/* Display name */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
            Nombre para mostrar
          </label>
          <input
            type="text"
            value={name}
            className={inputCls}
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-dim)" }}>
            Este nombre se muestra en el análisis, tablas y reportes.
          </p>
        </div>

        {/* Canonical / original names */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
            Nombres originales en facturas
          </label>
          <div className="space-y-1.5">
            {canonicals.map((rawName) => (
              <div
                key={rawName}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-sm)] border"
                style={{ background: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}
              >
                <span className="text-sm truncate" style={{ color: "var(--text)" }}>{rawName}</span>
                <button
                  type="button"
                  disabled={canonicals.length <= 1}
                  title={canonicals.length <= 1 ? "Debe quedar al menos un nombre" : "Separar este proveedor"}
                  className="flex-shrink-0 p-1 rounded transition-colors disabled:opacity-30"
                  style={{ color: "var(--text-dim)" }}
                  onMouseEnter={(e) => { if (canonicals.length > 1) (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)"; }}
                  onClick={() => removeCanonical(rawName)}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {canonicals.length > 1 && (
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-dim)" }}>
              Quitar un nombre original lo separa en su propio proveedor.
            </p>
          )}
        </div>

        {/* Merge in another supplier */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
            Fusionar con otro proveedor
          </label>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ color: "var(--text-muted)" }}
            >
              <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={addQuery}
              placeholder="Buscar proveedor a fusionar..."
              className={`${inputCls} pl-8`}
              style={{ background: "var(--surface)", borderColor: addOpen ? "var(--blue)" : "var(--border)", color: "var(--text)" }}
              onFocus={() => setAddOpen(true)}
              onBlur={() => setTimeout(() => setAddOpen(false), 150)}
              onChange={(e) => { setAddQuery(e.target.value); setAddOpen(true); }}
            />
            {addOpen && absorbableGroups.length > 0 && (
              <div
                className="absolute z-50 left-0 right-0 mt-1 rounded-[var(--radius-sm)] border overflow-y-auto"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  maxHeight: "160px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                }}
              >
                {absorbableGroups.map((g) => (
                  <button
                    key={g.displayName}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm transition-colors"
                    style={{ color: "var(--text)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-raised)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => absorb(g)}
                  >
                    <span className="font-medium">{g.displayName}</span>
                    {g.canonicalNames.length > 1 && (
                      <span className="ml-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {g.canonicalNames.length} nombres
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {addOpen && absorbableGroups.length === 0 && addQuery && (
              <div
                className="absolute z-50 left-0 right-0 mt-1 rounded-[var(--radius-sm)] border px-3 py-2 text-sm"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Sin resultados
              </div>
            )}
          </div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-dim)" }}>
            Al fusionar, todos los registros del otro proveedor pasan a este.
          </p>
        </div>

        {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" loading={saving} onClick={save}>Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}
