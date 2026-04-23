import dropdownOptionsRaw from "../../data/dropdown_options.json";
import type { DropdownsResponse } from "@/types";
import { config } from "@/config";
import { getTenantRestaurants } from "@/lib/tenant";

type DropdownFile = {
  concepto: string[];
  cuentaPnl: string[];
};

const options = dropdownOptionsRaw as unknown as DropdownFile;

const FALLBACK_RESTAURANTS = [
  { value: "motin_juarez", label: "Motín Juárez" },
  { value: "motin_roma",   label: "Motín Roma" },
  { value: "queseria",     label: "Quesería" },
];

export async function getDropdownOptions(tenantId?: string): Promise<DropdownsResponse> {
  const restaurants = tenantId
    ? await getTenantRestaurants(tenantId)
    : FALLBACK_RESTAURANTS;

  return {
    concepto: options.concepto ?? [],
    cuentaPnl: options.cuentaPnl ?? [],
    restaurants: restaurants.length > 0 ? restaurants : FALLBACK_RESTAURANTS,
    sheetRegistry: config.sheets.registry,
  };
}
