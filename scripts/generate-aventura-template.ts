// Run with: npx tsx scripts/generate-aventura-template.ts
import * as fs from "fs";
import * as path from "path";

const dropdowns = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../data/dropdown_options.json"), "utf-8")
);

const CUENTAS = [
  { label: "Costo de Alimentos",           cost_type: "food",        sort_order: 1 },
  { label: "Costo de Bebidas sin Alcohol", cost_type: "beverage",    sort_order: 2 },
  { label: "Mantenimiento",                cost_type: "operational", sort_order: 3 },
  { label: "Mobiliario",                   cost_type: "operational", sort_order: 4 },
  { label: "Renta",                        cost_type: "operational", sort_order: 5 },
  { label: "Gas",                          cost_type: "operational", sort_order: 6 },
  { label: "Varios de Administración",     cost_type: "operational", sort_order: 7 },
];

const CONCEPTO_TO_CUENTA: Record<string, string> = {
  "Aves": "Costo de Alimentos",
  "Carnes": "Costo de Alimentos",
  "Cremería": "Costo de Alimentos",
  "Frutas y Verduras": "Costo de Alimentos",
  "Frutas y Verduras Bar": "Costo de Alimentos",
  "Frutas y Verduras Bebidas": "Costo de Alimentos",
  "Helado": "Costo de Alimentos",
  "Huevo": "Costo de Alimentos",
  "Leche": "Costo de Alimentos",
  "Mantequilla": "Costo de Alimentos",
  "Panadería": "Costo de Alimentos",
  "Pastelería": "Costo de Alimentos",
  "Pescados y Mariscos": "Costo de Alimentos",
  "Postres": "Costo de Alimentos",
  "Quesos": "Costo de Alimentos",
  "Tortillas": "Costo de Alimentos",
  "Abarrotes Alimentos": "Costo de Alimentos",
  "Varios Alimentos": "Costo de Alimentos",
  "Agua": "Costo de Bebidas sin Alcohol",
  "Agua /provisión": "Costo de Bebidas sin Alcohol",
  "Abarrotes Bebidas": "Costo de Bebidas sin Alcohol",
  "Abarrotes Bebidas con Alcohol": "Costo de Bebidas sin Alcohol",
  "Bebidas Alcohólicas": "Costo de Bebidas sin Alcohol",
  "Café": "Costo de Bebidas sin Alcohol",
  "Cerveza": "Costo de Bebidas sin Alcohol",
  "Hielo": "Costo de Bebidas sin Alcohol",
  "Kombucha": "Costo de Bebidas sin Alcohol",
  "Refrescos": "Costo de Bebidas sin Alcohol",
  "Té": "Costo de Bebidas sin Alcohol",
  "Varios Bebidas": "Costo de Bebidas sin Alcohol",
  "Vinos": "Costo de Bebidas sin Alcohol",
  "Gas": "Gas",
  "Gas /provisión": "Gas",
  "Renta": "Renta",
  "Renta /provisión": "Renta",
  "Fumigación": "Mantenimiento",
  "Fumigación /provisión": "Mantenimiento",
  "Iguala Mantenimiento": "Mantenimiento",
  "Iguala Mantenimiento / provisión": "Mantenimiento",
  "Mantenimiento": "Mantenimiento",
  "Mantenimiento de Imagen": "Mantenimiento",
  "Audio y video": "Mobiliario",
  "Audio y Video /provisión": "Mobiliario",
  "Equipo de Restaurante": "Mobiliario",
  "Mobiliario": "Mobiliario",
  "Remodelaciones": "Mobiliario",
  "Utensilios de cocina": "Mobiliario",
  "Alimentos de Personal": "Varios de Administración",
  "Bonos de Gerentes": "Varios de Administración",
  "Capacitación": "Varios de Administración",
  "Comisión Tarjetas Bancarias": "Varios de Administración",
  "Comisiones Plataforma": "Varios de Administración",
  "Contadores": "Varios de Administración",
  "Contadores /provisión": "Varios de Administración",
  "Cuota por Administración": "Varios de Administración",
  "Gastos Legales": "Varios de Administración",
  "Gastos Legales /provisión": "Varios de Administración",
  "Impresos y consumibles RES": "Varios de Administración",
  "Impresos y Consumibles SAD": "Varios de Administración",
  "Inversión de Publicidad": "Varios de Administración",
  "Licencias y permisos": "Varios de Administración",
  "Licencias y permisos /provisión": "Varios de Administración",
  "Luz": "Varios de Administración",
  "Luz /provisión": "Varios de Administración",
  "Otros Ingresos": "Varios de Administración",
  "Papelería": "Varios de Administración",
  "Seguros GMM": "Varios de Administración",
  "Seguros GMM /provisión": "Varios de Administración",
  "Seguros y fianzas": "Varios de Administración",
  "Seguros y fianzas /provisión": "Varios de Administración",
  "Servicios Profesionales": "Varios de Administración",
  "Servicios Profesionales /provisión": "Varios de Administración",
  "Software y Sistemas": "Varios de Administración",
  "Suministro de limpieza": "Varios de Administración",
  "Teléfono": "Varios de Administración",
  "Teléfono /provisión": "Varios de Administración",
  "Transporte de Personal": "Varios de Administración",
  "Uniformes": "Varios de Administración",
  "Varios Capitalizables": "Varios de Administración",
  "Varios de Administración": "Varios de Administración",
  "Varios de Operación": "Varios de Administración",
  "Varios de Personal": "Varios de Administración",
  "Venta Tienda": "Varios de Administración",
};

const conceptos = (dropdowns.concepto as string[]).map((label: string, i: number) => ({
  label,
  cuenta: CONCEPTO_TO_CUENTA[label] ?? "Varios de Administración",
  sort_order: i + 1,
}));

const output = { cuentas: CUENTAS, conceptos };

const outPath = path.resolve(__dirname, "../data/catalogo-templates/aventura.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${conceptos.length} conceptos to ${outPath}`);
