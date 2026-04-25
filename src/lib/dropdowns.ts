import dropdownOptionsRaw from "../../data/dropdown_options.json";
import type { DropdownsResponse } from "@/types";
import { getTenantRestaurants, getTenantSettings } from "@/lib/tenant";

type DropdownFile = {
  concepto: string[];
  cuentaPnl: string[];
};

const options = dropdownOptionsRaw as unknown as DropdownFile;

export async function getDropdownOptions(tenantId?: string): Promise<DropdownsResponse> {
  const restaurants = tenantId ? await getTenantRestaurants(tenantId) : [];
  const settings = tenantId ? await getTenantSettings(tenantId) : null;
  const sheetRegistry = (settings?.sheetRegistry as Record<string, string>) ?? {};

  return {
    concepto: options.concepto ?? [],
    cuentaPnl: options.cuentaPnl ?? [],
    restaurants,
    sheetRegistry,
  };
}
