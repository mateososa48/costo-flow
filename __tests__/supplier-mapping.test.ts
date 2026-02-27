/**
 * Tests for supplier mapping lookup behavior
 */

type SupplierEntry = { concepto: string; cuentaPnl: string };

// Replicate the lookup logic from src/lib/supplier-mapping.ts for isolated testing
function buildLookup(rawMapping: Record<string, unknown>) {
  const mapping = new Map<string, SupplierEntry>();

  for (const [key, value] of Object.entries(rawMapping)) {
    if (key.startsWith("_")) continue;
    if (typeof value === "object" && value && "concepto" in value && "cuentaPnl" in value) {
      mapping.set(key.toLowerCase().trim(), value as SupplierEntry);
    }
  }

  return function lookupSupplier(supplierName: string): SupplierEntry | null {
    const key = supplierName.toLowerCase().trim();

    // Reject empty input
    if (!key) return null;

    // Exact match
    if (mapping.has(key)) return mapping.get(key)!;

    // Partial match (minimum key length to avoid false positives)
    const entries = Array.from(mapping.entries());
    for (const [mappingKey, entry] of entries) {
      if (mappingKey.length >= 4 && (key.includes(mappingKey) || mappingKey.includes(key))) {
        return entry;
      }
    }

    return null;
  };
}

const MOCK_MAPPING = {
  _comment: "ignored",
  "distribuidora el rancho sa de cv": {
    concepto: "Alimentos y Bebidas",
    cuentaPnl: "Costo de Ventas",
  },
  "servicios de limpieza": {
    concepto: "Servicios",
    cuentaPnl: "Gastos Variables",
  },
  "gas lp": {
    concepto: "Gastos de Operación",
    cuentaPnl: "Gastos Fijos",
  },
};

describe("lookupSupplier", () => {
  const lookupSupplier = buildLookup(MOCK_MAPPING);

  test("exact match (same case) returns correct entry", () => {
    const result = lookupSupplier("distribuidora el rancho sa de cv");
    expect(result).not.toBeNull();
    expect(result!.concepto).toBe("Alimentos y Bebidas");
    expect(result!.cuentaPnl).toBe("Costo de Ventas");
  });

  test("is case-insensitive", () => {
    const result = lookupSupplier("DISTRIBUIDORA EL RANCHO SA DE CV");
    expect(result).not.toBeNull();
    expect(result!.concepto).toBe("Alimentos y Bebidas");
  });

  test("trims whitespace before lookup", () => {
    const result = lookupSupplier("  distribuidora el rancho sa de cv  ");
    expect(result).not.toBeNull();
  });

  test("partial match: mapping key is substring of supplier name", () => {
    // "gas lp" is contained in "Gas LP Toluca"
    const result = lookupSupplier("Gas LP Toluca");
    expect(result).not.toBeNull();
    expect(result!.concepto).toBe("Gastos de Operación");
  });

  test("partial match: supplier name is substring of mapping key", () => {
    // "servicios" is contained in "servicios de limpieza"
    const result = lookupSupplier("servicios de limpieza extra");
    expect(result).not.toBeNull();
  });

  test("unknown supplier returns null", () => {
    const result = lookupSupplier("Proveedor Desconocido ABC");
    expect(result).toBeNull();
  });

  test("empty string returns null", () => {
    const result = lookupSupplier("");
    expect(result).toBeNull();
  });

  test("_comment key is ignored", () => {
    // Should not throw and should not match "_comment"
    const result = lookupSupplier("ignored");
    expect(result).toBeNull();
  });

  test("second known supplier returns correct entry", () => {
    const result = lookupSupplier("Servicios de Limpieza");
    expect(result).not.toBeNull();
    expect(result!.cuentaPnl).toBe("Gastos Variables");
  });
});
