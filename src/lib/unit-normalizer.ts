/**
 * Server-side unit normalizer for Mexican restaurant invoice line items.
 * Maps raw unit strings (as extracted from invoices) to a canonical set.
 * Applied at save time, overriding the LLM's unitNormalized field for reliability.
 *
 * Special Mexican market units:
 *   DOMO / FLAT / CHAROLA  → caja  (berry flat/tray ~250–500g)
 *   MANOJO / ATADO          → bolsa (bunch of herbs/greens)
 *   KGM / KILO / K          → kg
 *   PZA / PIEZA / UND       → pz
 */

export const NORMALIZED_UNITS = [
  "kg", "g", "l", "ml", "pz", "caja", "docena",
  "bolsa", "metro", "lata", "botella", "galon",
  "costal", "sobre", "rollo", "otros",
] as const;

export type NormalizedUnit = typeof NORMALIZED_UNITS[number];

const MAP: Record<string, NormalizedUnit> = {
  // kg
  kg: "kg", kilo: "kg", kilos: "kg", kgm: "kg", kilogram: "kg",
  kilograms: "kg", kilogramo: "kg", kilogramos: "kg", k: "kg",
  // g
  g: "g", gr: "g", gramo: "g", gramos: "g", gram: "g", grams: "g", grs: "g",
  // l
  l: "l", lt: "l", lts: "l", litro: "l", litros: "l", liter: "l", liters: "l", litre: "l",
  // ml
  ml: "ml", mililitro: "ml", mililitros: "ml", milliliter: "ml",
  // pz
  pz: "pz", pza: "pz", pieza: "pz", piezas: "pz", un: "pz", und: "pz",
  unidad: "pz", unidades: "pz", uni: "pz", piece: "pz", pieces: "pz",
  // caja — includes Mexican berry/produce flats
  caja: "caja", cajas: "caja", box: "caja",
  domo: "caja", domos: "caja", flat: "caja", charola: "caja", charol: "caja",
  charolas: "caja",
  // docena
  docena: "docena", docenas: "docena", doc: "docena", dz: "docena", dozen: "docena",
  // bolsa — includes herb bunches
  bolsa: "bolsa", bolsas: "bolsa", bag: "bolsa",
  manojo: "bolsa", manojos: "bolsa", manoj: "bolsa",
  atado: "bolsa", atados: "bolsa", bunch: "bolsa",
  // metro
  metro: "metro", metros: "metro", m: "metro", mt: "metro",
  // lata
  lata: "lata", latas: "lata", can: "lata",
  // botella
  botella: "botella", botellas: "botella", bottle: "botella", bottles: "botella",
  // galon
  galon: "galon", galones: "galon", galón: "galon", gal: "galon", gallon: "galon",
  // costal
  costal: "costal", costales: "costal", saco: "costal", sacos: "costal", sack: "costal",
  // sobre
  sobre: "sobre", sobres: "sobre", packet: "sobre", sachet: "sobre",
  // rollo
  rollo: "rollo", rollos: "rollo", roll: "rollo", rolls: "rollo",
};

/**
 * Normalizes a raw unit string to a canonical NormalizedUnit.
 * Returns "otros" for null, empty, or unrecognized values.
 */
export function normalizeUnit(raw: string | null | undefined): NormalizedUnit {
  if (!raw) return "otros";
  const key = raw.trim().toLowerCase();
  return MAP[key] ?? "otros";
}
