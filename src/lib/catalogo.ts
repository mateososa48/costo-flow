import type { SupabaseClient } from "@supabase/supabase-js";
import getSupabase from "@/lib/supabase";
import { getCostType } from "@/lib/cost-classification";
import universalTemplate from "../../data/catalogo-templates/universal.json";
import aventuraTemplate from "../../data/catalogo-templates/aventura.json";

export type TenantCuenta = {
  id: string;
  tenantId: string;
  label: string;
  costType: "food" | "beverage" | "operational";
  isActive: boolean;
  sortOrder: number;
};

export type TenantConcept = {
  id: string;
  tenantId: string;
  label: string;
  cuentaPnlId: string;
  costType: "food" | "beverage" | "operational";
  isActive: boolean;
  sortOrder: number;
};

type CatalogoTemplate = {
  cuentas: { label: string; cost_type: string; sort_order: number }[];
  conceptos: { label: string; cuenta: string; sort_order: number }[];
};

const TEMPLATES: Record<string, CatalogoTemplate> = {
  universal: universalTemplate as CatalogoTemplate,
  aventura: aventuraTemplate as CatalogoTemplate,
};

export async function getTenantCuentas(
  tenantId: string,
  supabase?: SupabaseClient | null
): Promise<TenantCuenta[]> {
  const db = supabase ?? getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("tenant_cuenta_pnl")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .select("id, tenant_id, label, cost_type, is_active, sort_order");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    label: row.label as string,
    costType: row.cost_type as TenantCuenta["costType"],
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
  }));
}

export async function getTenantConcepts(
  tenantId: string,
  supabase?: SupabaseClient | null
): Promise<TenantConcept[]> {
  const db = supabase ?? getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("tenant_concepts")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .select("id, tenant_id, label, cuenta_pnl_id, is_active, sort_order, tenant_cuenta_pnl(cost_type)");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    label: row.label as string,
    cuentaPnlId: row.cuenta_pnl_id as string,
    costType: ((row.tenant_cuenta_pnl as Record<string, unknown>)?.cost_type ?? "operational") as TenantConcept["costType"],
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
  }));
}

export async function getCuentaLabels(
  tenantId: string,
  supabase?: SupabaseClient | null
): Promise<string[]> {
  const cuentas = await getTenantCuentas(tenantId, supabase);
  return cuentas.sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.label);
}

export async function getConceptLabels(
  tenantId: string,
  supabase?: SupabaseClient | null
): Promise<string[]> {
  const concepts = await getTenantConcepts(tenantId, supabase);
  return concepts.sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.label);
}

export async function getCostTypeForCuenta(
  tenantId: string,
  cuentaLabel: string,
  supabase?: SupabaseClient | null
): Promise<"food" | "beverage" | "operational"> {
  const db = supabase ?? getSupabase();
  if (!db || !tenantId || !cuentaLabel) return getCostType(cuentaLabel);
  const { data } = await db
    .from("tenant_cuenta_pnl")
    .eq("tenant_id", tenantId)
    .eq("label", cuentaLabel)
    .single();
  if (!data) return getCostType(cuentaLabel);
  const row = data as { cost_type: string; is_active?: boolean };
  if (row.is_active === false) return getCostType(cuentaLabel);
  return row.cost_type as "food" | "beverage" | "operational";
}

export async function resolveConceptId(
  tenantId: string,
  conceptLabel: string,
  supabase?: SupabaseClient | null
): Promise<{ id: string; cuentaPnlId: string; costType: "food" | "beverage" | "operational" } | null> {
  const db = supabase ?? getSupabase();
  if (!db || !tenantId || !conceptLabel) return null;
  const { data } = await db
    .from("tenant_concepts")
    .eq("tenant_id", tenantId)
    .eq("label", conceptLabel)
    .single();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    cuentaPnlId: row.cuenta_pnl_id as string,
    costType: ((row.tenant_cuenta_pnl as Record<string, unknown>)?.cost_type ?? "operational") as TenantConcept["costType"],
  };
}

export async function seedTenantCatalogo(
  tenantId: string,
  template: "universal" | "aventura",
  supabase?: SupabaseClient | null
): Promise<void> {
  const db = supabase ?? getSupabase();
  if (!db) throw new Error("Supabase unavailable");

  const tpl = TEMPLATES[template];
  if (!tpl) throw new Error(`Unknown template: ${template}`);

  const { data: insertedCuentas, error: cuentasError } = await db
    .from("tenant_cuenta_pnl")
    .insert(
      tpl.cuentas.map((c) => ({
        tenant_id: tenantId,
        label: c.label,
        cost_type: c.cost_type,
        is_active: true,
        sort_order: c.sort_order,
      }))
    )
    .select("id, label");
  if (cuentasError) throw new Error(`Failed to seed cuentas: ${cuentasError.message}`);

  const cuentaMap = new Map<string, string>(
    ((insertedCuentas as { id: string; label: string }[]) ?? []).map((r) => [r.label, r.id])
  );

  const conceptRows = tpl.conceptos
    .map((c) => {
      const cuentaId = cuentaMap.get(c.cuenta);
      if (!cuentaId) return null;
      return {
        tenant_id: tenantId,
        label: c.label,
        cuenta_pnl_id: cuentaId,
        is_active: true,
        sort_order: c.sort_order,
      };
    })
    .filter(Boolean);

  const { error: conceptsError } = await db.from("tenant_concepts").insert(conceptRows);
  if (conceptsError) throw new Error(`Failed to seed conceptos: ${conceptsError.message}`);
}
