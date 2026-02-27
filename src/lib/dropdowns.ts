import dropdownOptionsRaw from "../../data/dropdown_options.json";
import { RESTAURANT_LABELS } from "@/types";
import type { Restaurant, DropdownsResponse } from "@/types";
import { config } from "@/config";

type DropdownFile = {
  concepto: string[];
  cuentaPnl: string[];
};

const options = dropdownOptionsRaw as unknown as DropdownFile;

export function getDropdownOptions(): DropdownsResponse {
  return {
    concepto: options.concepto ?? [],
    cuentaPnl: options.cuentaPnl ?? [],
    restaurants: (Object.keys(RESTAURANT_LABELS) as Restaurant[]).map((value) => ({
      value,
      label: RESTAURANT_LABELS[value],
    })),
    adminNames: config.auth.adminNames,
  };
}
