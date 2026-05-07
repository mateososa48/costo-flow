"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

// ── Sample data ────────────────────────────────────────────────────────────────
const SAMPLE = [
  { id: "1", supplier: "Comercializadora de Alimentos Saida", invoiceNumber: "6825", invoiceDate: "2026-01-21", restaurant: "Aventura", total: 1870.00, cuenta_pnl: "Costo de Alimentos",
    lineItems: [
      { description: "Jitomate Saladette", quantity: 20, unit: "kg", total: 560.00 },
      { description: "Cebolla Blanca", quantity: 10, unit: "kg", total: 180.00 },
      { description: "Lechuga Orejona", quantity: 15, unit: "pz", total: 1130.00 },
    ]},
  { id: "2", supplier: "Distribuidora La Palma", invoiceNumber: "1042", invoiceDate: "2026-01-19", restaurant: "Sucursal Norte", total: 4320.50, cuenta_pnl: "Costo de Bebidas",
    lineItems: [
      { description: "Agua Mineral 1L", quantity: 48, unit: "pz", total: 960.00 },
      { description: "Refresco Limón 2L", quantity: 24, unit: "pz", total: 840.00 },
      { description: "Jugo de Naranja 1L", quantity: 12, unit: "pz", total: 720.50 },
      { description: "Agua Embotellada 500ml", quantity: 96, unit: "pz", total: 1800.00 },
    ]},
  { id: "3", supplier: "Productos Frescos del Valle", invoiceNumber: null, invoiceDate: "2026-01-17", restaurant: "Aventura", total: 980.00, cuenta_pnl: "Costo de Alimentos",
    lineItems: [
      { description: "Aguacate Hass", quantity: 30, unit: "kg", total: 480.00 },
      { description: "Limón Persa", quantity: 10, unit: "kg", total: 160.00 },
      { description: "Cilantro", quantity: 5, unit: "kg", total: 100.00 },
      { description: "Epazote", quantity: 3, unit: "kg", total: 90.00 },
      { description: "Hierba Santa", quantity: 2, unit: "kg", total: 150.00 },
    ]},
  { id: "4", supplier: "Carnícería El Ranchero S.A.", invoiceNumber: "7741", invoiceDate: "2026-01-15", restaurant: "Sucursal Norte", total: 12450.00, cuenta_pnl: "Costo de Alimentos",
    lineItems: [
      { description: "Arrachera Premium", quantity: 15, unit: "kg", total: 4500.00 },
      { description: "Costilla de Res", quantity: 20, unit: "kg", total: 3800.00 },
      { description: "Pollo Entero", quantity: 25, unit: "kg", total: 2250.00 },
      { description: "Lomo de Cerdo", quantity: 10, unit: "kg", total: 1900.00 },
    ]},
  { id: "5", supplier: "Importadora de Especias MX", invoiceNumber: "309", invoiceDate: "2026-01-12", restaurant: "Aventura", total: 2100.75, cuenta_pnl: "Costo de Alimentos",
    lineItems: [
      { description: "Pimienta Negra Molida", quantity: 2, unit: "kg", total: 480.00 },
      { description: "Comino Entero", quantity: 1, unit: "kg", total: 220.75 },
      { description: "Chile Ancho Seco", quantity: 3, unit: "kg", total: 540.00 },
      { description: "Orégano Mexicano", quantity: 1, unit: "kg", total: 180.00 },
      { description: "Canela en Rama", quantity: 1, unit: "kg", total: 320.00 },
      { description: "Clavo de Olor", quantity: 0.5, unit: "kg", total: 360.00 },
    ]},
];

const RestaurantPill = ({ name }: { name: string }) => (
  <span style={{
    display: "inline-block",
    padding: "2px 9px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.01em",
    background: "#0350A9",
    color: "#fff",
    whiteSpace: "nowrap",
    lineHeight: 1.6,
  }}>
    {name}
  </span>
);

const fmt = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v);

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

const ROW_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.055, duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

// ── Shared icon buttons ────────────────────────────────────────────────────────
const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M11.5 2.5a2.121 2.121 0 013 3L5 15H2v-3L11.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M6 2h4M2 5h12M4.5 5l1 9a.5.5 0 00.5.5h4a.5.5 0 00.5-.5l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ══════════════════════════════════════════════════════════════════════════════
// MOCKUP A — "Vercel deployments" — ultra-flat, no headers, tight rows
// ══════════════════════════════════════════════════════════════════════════════
function MockupA() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ border: "1px solid #E4E4E7", borderRadius: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" }}>
      <div style={{ padding: "13px 20px", borderBottom: "1px solid #F0F0F1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#18181B", letterSpacing: "-0.01em" }}>Facturas</span>
        <span style={{ fontSize: 12, color: "#A1A1AA" }}>{SAMPLE.length} registros</span>
      </div>
      <div>
        {SAMPLE.map((inv, i) => (
          <motion.div key={inv.id} custom={i} initial="hidden" animate="visible" variants={ROW_VARIANTS}>
            <div
              onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
              onMouseEnter={() => setHovered(inv.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 20px",
                height: 46,
                borderBottom: "1px solid #F0F0F1",
                background: hovered === inv.id ? "#F8F8F7" : "#fff",
                cursor: "pointer",
                transition: "background 100ms ease",
                gap: 0,
              }}
            >
              <span style={{ flex: "1 1 0", fontSize: 13, fontWeight: 500, color: "#18181B", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 16 }}>
                {inv.supplier}
              </span>

              <span style={{ width: 72, flexShrink: 0, fontSize: 12, fontFamily: "monospace", color: "#A1A1AA", textAlign: "right", marginRight: 20 }}>
                {inv.invoiceNumber ? `#${inv.invoiceNumber}` : "—"}
              </span>

              <span style={{ width: 100, flexShrink: 0, fontSize: 12, color: "#71717A", textAlign: "right", marginRight: 20 }}>
                {fmtDate(inv.invoiceDate)}
              </span>

              {/* Sucursal tag */}
              <div style={{ width: 120, flexShrink: 0, display: "flex", justifyContent: "flex-end", marginRight: 20 }}>
                <RestaurantPill name={inv.restaurant} />
              </div>

              <span style={{ width: 96, flexShrink: 0, fontSize: 13, fontWeight: 600, color: "#18181B", textAlign: "right", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                {fmt(inv.total)}
              </span>

              <div style={{ width: 56, flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: 4, opacity: hovered === inv.id ? 1 : 0, transition: "opacity 100ms" }}>
                <button onClick={e => e.stopPropagation()} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #E4E4E7", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#71717A" }}>
                  <EditIcon />
                </button>
                <button onClick={e => e.stopPropagation()} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #E4E4E7", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#71717A" }}>
                  <TrashIcon />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {expanded === inv.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeInOut" }}
                  style={{ overflow: "hidden", background: "#F8F8F7", borderBottom: "1px solid #F0F0F1" }}
                >
                  <div style={{ padding: "12px 20px 14px", display: "flex", gap: 32, alignItems: "center" }}>
                    <div><span style={{ fontSize: 10, color: "#A1A1AA", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 2 }}>Cuenta P&L</span><span style={{ fontSize: 12, color: "#71717A" }}>{inv.cuenta_pnl}</span></div>
                    <div><span style={{ fontSize: 10, color: "#A1A1AA", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 2 }}>Artículos</span><span style={{ fontSize: 12, color: "#71717A" }}>{inv.lineItems.length}</span></div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                      <button style={{ fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "1px solid #E4E4E7", background: "#fff", cursor: "pointer", color: "#18181B", fontWeight: 500 }}>Editar</button>
                      <button style={{ fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "1px solid #FED7D7", background: "#FFF5F5", cursor: "pointer", color: "#DC2626", fontWeight: 500 }}>Eliminar</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MOCKUP B — "Notion database" — column headers, spacious, clean
// ══════════════════════════════════════════════════════════════════════════════
function MockupB() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const GRID = "28px 1fr 96px 116px 140px 112px 60px";

  const COL: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "#A1A1AA",
    padding: "0 12px",
  };

  return (
    <div style={{ border: "1px solid #E4E4E7", borderRadius: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" }}>
      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", height: 36, borderBottom: "1px solid #F0F0F1", background: "#F8F8F7", padding: "0 4px 0 0" }}>
        <span />
        <span style={{ ...COL, paddingLeft: 8 }}>Proveedor</span>
        <span style={{ ...COL, textAlign: "right" }}>Factura</span>
        <span style={{ ...COL, textAlign: "right" }}>Fecha</span>
        <span style={{ ...COL, textAlign: "right" }}>Sucursal</span>
        <span style={{ ...COL, textAlign: "right" }}>Total</span>
        <span />
      </div>

      {SAMPLE.map((inv, i) => {
        const isExpanded = expanded === inv.id;
        const isHovered = hovered === inv.id;

        return (
          <motion.div key={inv.id} custom={i} initial="hidden" animate="visible" variants={ROW_VARIANTS}>
            {/* Main row */}
            <div
              onClick={() => setExpanded(isExpanded ? null : inv.id)}
              onMouseEnter={() => setHovered(inv.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                alignItems: "center",
                height: 50,
                padding: "0 4px 0 0",
                borderBottom: isExpanded ? "none" : "1px solid #F0F0F1",
                background: isExpanded ? "#F8F8F7" : isHovered ? "#F8F8F7" : "#fff",
                cursor: "pointer",
                transition: "background 100ms ease",
              }}
            >
              {/* Expand chevron */}
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#A1A1AA" }}>
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                  style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 180ms ease" }}
                >
                  <path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Supplier */}
              <div style={{ padding: "0 12px 0 8px", overflow: "hidden", display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#18181B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                  {inv.supplier}
                </span>
              </div>

              {/* Invoice # */}
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "#A1A1AA", textAlign: "right", padding: "0 12px" }}>
                {inv.invoiceNumber ? `#${inv.invoiceNumber}` : "—"}
              </span>

              {/* Date */}
              <span style={{ fontSize: 12, color: "#71717A", textAlign: "right", padding: "0 12px" }}>
                {fmtDate(inv.invoiceDate)}
              </span>

              {/* Sucursal tag — square */}
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 12px" }}>
                <RestaurantPill name={inv.restaurant} />
              </div>

              {/* Total */}
              <span style={{ fontSize: 14, fontWeight: 600, color: "#18181B", textAlign: "right", padding: "0 12px", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em" }}>
                {fmt(inv.total)}
              </span>

              {/* Actions — visible on hover OR when expanded */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 3, padding: "0 8px", opacity: isHovered || isExpanded ? 1 : 0, transition: "opacity 100ms" }}>
                <button onClick={e => e.stopPropagation()} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#A1A1AA" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F4F4F5"; e.currentTarget.style.color = "#18181B"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A1A1AA"; }}>
                  <EditIcon />
                </button>
                <button onClick={e => e.stopPropagation()} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#A1A1AA" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.08)"; e.currentTarget.style.color = "#DC2626"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A1A1AA"; }}>
                  <TrashIcon />
                </button>
              </div>
            </div>

            {/* Expanded: line items */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ background: "#F8F8F7", borderBottom: "1px solid #F0F0F1", borderTop: "1px solid #F0F0F1" }}>
                    {/* Line items mini-header */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px 96px", padding: "8px 20px 6px 44px", gap: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#A1A1AA" }}>Artículo</span>
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#A1A1AA", textAlign: "right" }}>Cantidad</span>
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#A1A1AA", textAlign: "right" }}>Unidad</span>
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#A1A1AA", textAlign: "right" }}>Total</span>
                    </div>
                    {inv.lineItems.map((item, j) => (
                      <div key={j} style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px 96px", padding: "5px 20px", gap: 0, borderTop: "1px solid #EBEBEC", paddingLeft: 44 }}>
                        <span style={{ fontSize: 12, color: "#18181B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</span>
                        <span style={{ fontSize: 12, color: "#71717A", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.quantity}</span>
                        <span style={{ fontSize: 12, color: "#71717A", textAlign: "right" }}>{item.unit}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#18181B", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(item.total)}</span>
                      </div>
                    ))}
                    {/* Total row */}
                    <div style={{ display: "flex", justifyContent: "flex-end", padding: "7px 20px 8px", borderTop: "1px solid #E4E4E7" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#18181B", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(inv.total)}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MOCKUP C — "Linear issues" — borderless rows, left accent on expand
// ══════════════════════════════════════════════════════════════════════════════
function MockupC() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E4E4E7", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", height: 32, padding: "0 16px", borderBottom: "1px solid #F0F0F1", background: "#F8F8F7" }}>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 500, color: "#A1A1AA", letterSpacing: "0.06em", textTransform: "uppercase" }}>Proveedor</span>
        <span style={{ width: 104, fontSize: 11, fontWeight: 500, color: "#A1A1AA", letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "right" }}>Fecha</span>
        <span style={{ width: 130, fontSize: 11, fontWeight: 500, color: "#A1A1AA", letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "right" }}>Sucursal</span>
        <span style={{ width: 112, fontSize: 11, fontWeight: 500, color: "#A1A1AA", letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "right" }}>Total</span>
        <span style={{ width: 52 }} />
      </div>

      {SAMPLE.map((inv, i) => (
        <motion.div key={inv.id} custom={i} initial="hidden" animate="visible" variants={ROW_VARIANTS}>
          <div
            onMouseEnter={() => setHovered(inv.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              height: 44,
              borderBottom: "1px solid #F0F0F1",
              background: hovered === inv.id ? "#F8F8F7" : "transparent",
              cursor: "pointer",
              transition: "background 80ms ease",
              borderLeft: expanded === inv.id ? "2px solid #0350A9" : "2px solid transparent",
            }}
          >
            <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#18181B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                {inv.supplier}
              </span>
              {inv.invoiceNumber && (
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#A1A1AA", flexShrink: 0 }}>
                  #{inv.invoiceNumber}
                </span>
              )}
            </div>

            <span style={{ width: 104, fontSize: 12, color: "#71717A", textAlign: "right", flexShrink: 0 }}>
              {fmtDate(inv.invoiceDate)}
            </span>

            {/* Sucursal tag */}
            <div style={{ width: 130, flexShrink: 0, display: "flex", justifyContent: "flex-end", paddingLeft: 8 }}>
              <RestaurantPill name={inv.restaurant} />
            </div>

            <span style={{ width: 112, fontSize: 13, fontWeight: 600, color: "#18181B", textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
              {fmt(inv.total)}
            </span>

            <div style={{ width: 52, flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: 2, opacity: hovered === inv.id ? 1 : 0, transition: "opacity 80ms" }}>
              <button onClick={e => e.stopPropagation()} style={{ width: 26, height: 26, borderRadius: 5, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#A1A1AA" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F4F4F5"; e.currentTarget.style.color = "#18181B"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A1A1AA"; }}>
                <EditIcon />
              </button>
              <button onClick={e => e.stopPropagation()} style={{ width: 26, height: 26, borderRadius: 5, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#A1A1AA" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.08)"; e.currentTarget.style.color = "#DC2626"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A1A1AA"; }}>
                <TrashIcon />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {expanded === inv.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ padding: "8px 16px 10px 18px", background: "#EBF2FF", borderBottom: "1px solid #C7DCF9", borderLeft: "2px solid #0350A9", display: "flex", gap: 24, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#0350A9", fontWeight: 500 }}>{inv.cuenta_pnl}</span>
                  <span style={{ fontSize: 11, color: "#71717A" }}>{inv.lineItems.length} artículos</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "1px solid #C7DCF9", background: "#fff", cursor: "pointer", color: "#0350A9", fontWeight: 500 }}>Editar</button>
                    <button style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "1px solid #FED7D7", background: "#FFF5F5", cursor: "pointer", color: "#DC2626", fontWeight: 500 }}>Eliminar</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main mockup page
// ══════════════════════════════════════════════════════════════════════════════
export default function InvoiceMockupsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8F8F7", padding: "40px 32px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#A1A1AA", marginBottom: 4 }}>Mockups — InvoicesView</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#18181B", letterSpacing: "-0.03em", marginBottom: 48 }}>Elige un diseño</h1>

        {/* A */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#18181B", letterSpacing: "-0.02em" }}>A</span>
            <span style={{ fontSize: 13, color: "#71717A" }}>Filas planas sin headers — estilo Vercel</span>
          </div>
          <MockupA />
        </div>

        {/* B */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#18181B", letterSpacing: "-0.02em" }}>B</span>
            <span style={{ fontSize: 13, color: "#71717A" }}>Tabla con headers y dos líneas por fila — estilo Notion DB</span>
          </div>
          <MockupB />
        </div>

        {/* C */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#18181B", letterSpacing: "-0.02em" }}>C</span>
            <span style={{ fontSize: 13, color: "#71717A" }}>Filas borderless, acento azul al expandir — estilo Linear</span>
          </div>
          <MockupC />
        </div>
      </div>
    </div>
  );
}
