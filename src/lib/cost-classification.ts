/**
 * Classifies invoices as food, beverage, or operational based on cuentaPnl.
 * Used to separate COGS (food/beverage) from operating expenses (rent, services, etc.)
 * and to set line_items.cost_type at save time.
 */

export const FOOD_CUENTAPNL = new Set(["Costo de Alimentos"]);
export const BEVERAGE_CUENTAPNL = new Set(["Costo de Bebidas sin Alcohol"]);

export type CostType = "food" | "beverage" | "operational";

export function getCostType(cuentaPnl: string): CostType {
  if (FOOD_CUENTAPNL.has(cuentaPnl)) return "food";
  if (BEVERAGE_CUENTAPNL.has(cuentaPnl)) return "beverage";
  return "operational";
}

/** Returns true for cost types that belong in the Compras (COGS) view */
export function isFoodCost(costType: CostType): boolean {
  return costType === "food" || costType === "beverage";
}
