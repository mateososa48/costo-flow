import dropdownOptionsRaw from "../../data/dropdown_options.json";
import type { DropdownsResponse } from "@/types";
import { getTenantRestaurants, getTenantSettings } from "@/lib/tenant";
import { getConceptLabels, getCuentaLabels } from "@/lib/catalogo";

type DropdownFile = {
  concepto: string[];
  cuentaPnl: string[];
};

const options = dropdownOptionsRaw as unknown as DropdownFile;

export async function getDropdownOptions(tenantId?: string): Promise<DropdownsResponse> {
  const [restaurants, settings, tenantConceptos, tenantCuentas] = await Promise.all([
    tenantId ? getTenantRestaurants(tenantId) : Promise.resolve([]),
    tenantId ? getTenantSettings(tenantId) : Promise.resolve(null),
    tenantId ? getConceptLabels(tenantId) : Promise.resolve([]),
    tenantId ? getCuentaLabels(tenantId) : Promise.resolve([]),
  ]);

  const sheetRegistry = (settings?.sheetRegistry as Record<string, string>) ?? {};

  return {
    concepto: tenantConceptos.length > 0 ? tenantConceptos : (options.concepto ?? []),
    cuentaPnl: tenantCuentas.length > 0 ? tenantCuentas : (options.cuentaPnl ?? []),
    restaurants,
    sheetRegistry,
  };
}
