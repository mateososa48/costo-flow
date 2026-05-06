import { SupabaseClient } from "@supabase/supabase-js";
import {
  getTenantCuentas,
  getTenantConcepts,
  getConceptLabels,
  getCuentaLabels,
  getCostTypeForCuenta,
  resolveConceptId,
  seedTenantCatalogo,
  type TenantCuenta,
  type TenantConcept,
} from "../src/lib/catalogo";

function mockSupabase(rows: Record<string, unknown[]>): SupabaseClient {
  const fromMock = jest.fn((table: string) => {
    const tableRows = rows[table] ?? [];
    return {
      select: jest.fn().mockResolvedValue({ data: tableRows, error: null }),
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: tableRows, error: null }),
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: tableRows, error: null }),
          single: jest.fn().mockResolvedValue({ data: tableRows[0] ?? null, error: null }),
        }),
        single: jest.fn().mockResolvedValue({ data: tableRows[0] ?? null, error: null }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    };
  });

  return { from: fromMock } as unknown as SupabaseClient;
}

describe("getTenantCuentas", () => {
  it("returns active cuentas for a tenant", async () => {
    const db = mockSupabase({ tenant_cuenta_pnl: [
      { id: "c1", tenant_id: "t1", label: "Costo de Alimentos", cost_type: "food", is_active: true, sort_order: 1 },
    ]});
    const result = await getTenantCuentas("t1", db);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Costo de Alimentos");
    expect(result[0].costType).toBe("food");
  });

  it("returns empty array when supabase is unavailable", async () => {
    const result = await getTenantCuentas("t1", undefined);
    expect(result).toEqual([]);
  });
});

describe("getCuentaLabels", () => {
  it("returns sorted labels of active cuentas", async () => {
    const db = mockSupabase({ tenant_cuenta_pnl: [
      { id: "c1", tenant_id: "t1", label: "Costo de Alimentos", cost_type: "food", is_active: true, sort_order: 1 },
      { id: "c2", tenant_id: "t1", label: "Nómina", cost_type: "operational", is_active: true, sort_order: 2 },
    ]});
    const labels = await getCuentaLabels("t1", db);
    expect(labels).toEqual(["Costo de Alimentos", "Nómina"]);
  });
});

describe("getConceptLabels", () => {
  it("returns sorted labels of active concepts", async () => {
    const db = mockSupabase({ tenant_concepts: [
      { id: "p1", tenant_id: "t1", label: "Carnes", cuenta_pnl_id: "c1", cost_type: "food", is_active: true, sort_order: 1 },
    ]});
    const labels = await getConceptLabels("t1", db);
    expect(labels).toEqual(["Carnes"]);
  });
});

describe("getCostTypeForCuenta", () => {
  it("returns cost_type from tenant catálogo", async () => {
    const db = mockSupabase({ tenant_cuenta_pnl: [
      { id: "c1", tenant_id: "t1", label: "Costo de Bebidas", cost_type: "beverage", is_active: true, sort_order: 1 },
    ]});
    const result = await getCostTypeForCuenta("t1", "Costo de Bebidas", db);
    expect(result).toBe("beverage");
  });

  it("falls back to legacy hardcoded logic when cuenta not in catálogo", async () => {
    const db = mockSupabase({ tenant_cuenta_pnl: [] });
    const result = await getCostTypeForCuenta("t1", "Costo de Alimentos", db);
    expect(result).toBe("food");
  });
});

describe("resolveConceptId", () => {
  it("returns concept row for a known label", async () => {
    const db = mockSupabase({ tenant_concepts: [
      { id: "p1", tenant_id: "t1", label: "Carnes", cuenta_pnl_id: "c1", cost_type: "food", is_active: true, sort_order: 1 },
    ]});
    const result = await resolveConceptId("t1", "Carnes", db);
    expect(result).toMatchObject({ id: "p1", cuentaPnlId: "c1" });
  });

  it("returns null for unknown label", async () => {
    const db = mockSupabase({ tenant_concepts: [] });
    const result = await resolveConceptId("t1", "Unknown Label", db);
    expect(result).toBeNull();
  });
});
