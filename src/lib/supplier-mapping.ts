import supplierMappingRaw from "../../data/supplier_mapping.json";
import type { SupplierEntry } from "@/types";

type MappingFile = Record<string, SupplierEntry | string>;

// Load and normalize the mapping at module init time
const mapping: Map<string, SupplierEntry> = new Map();

for (const [key, value] of Object.entries(supplierMappingRaw as MappingFile)) {
  // Skip the _comment key
  if (key.startsWith("_")) continue;
  if (typeof value === "object" && "concepto" in value && "cuentaPnl" in value) {
    mapping.set(key.toLowerCase().trim(), value as SupplierEntry);
  }
}

/**
 * Look up a supplier by name (case-insensitive, trimmed).
 * Returns the { concepto, cuentaPnl } entry if found, or null.
 */
export function lookupSupplier(supplierName: string): SupplierEntry | null {
  const key = supplierName.toLowerCase().trim();

  // Reject empty input
  if (!key) return null;

  // Exact match
  if (mapping.has(key)) return mapping.get(key)!;

  // Partial match: check if any mapping key is contained in the supplier name
  // Require a minimum key length to avoid false positives with very short keys
  const entries = Array.from(mapping.entries());
  for (const [mappingKey, entry] of entries) {
    if (mappingKey.length >= 4 && (key.includes(mappingKey) || mappingKey.includes(key))) {
      return entry;
    }
  }

  return null;
}
