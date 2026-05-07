# Invoice/Expense Processing Pipeline — Classification & Aventura-Specific Mapping

**Source:** Codebase mapping subagent run, 2026-05-01
**Companion doc:** [mexican-backoffice-research.md](mexican-backoffice-research.md) — proposes refactor options A/B/C using this map.

---

## Overview

This is a deep technical map of the classification, categorization, and Aventura Gourmet-specific hardcodings in the invoice processing system. The product is transitioning from single-tenant to multi-tenant but retains significant hardcoded references.

---

### 1. INVOICE INGESTION & EXTRACTION

#### Entry Points
- **File upload route**: `/src/app/api/invoices/parse/route.ts` (POST)
  - Accepts PDF, JPEG, PNG, WebP, HEIC/HEIF formats
  - Rate limited: 20 requests per 5 minutes per user (line 32)
  - Calls `extractFromPdf()` for PDFs, delegates to LLM vision/text extraction

- **Image processing**: 
  - Server-side compression if >1.5MB (lines 76-91)
  - Uses `@napi-rs/canvas` for HEIC conversion & resize to max 1600px JPEG

#### LLM Extraction (src/lib/openai.ts)

**System prompt** (lines 44-75): 
- Explicitly instructs model to handle Mexican invoices with period as decimal separator
- Requires strict JSON output with `extractionConfidence` field
- Specializes in Mexican restaurant contexts ("para un grupo de restaurantes mexicano")

**Extraction Schema** (lines 77-110):
```typescript
type LLMExtraction = {
  invoiceDate: string;           // yyyy-mm-dd
  supplier: string;
  invoiceNumber: string | null;  // digits only, stripped
  importe: number;               // net before IVA
  iva: number;                   // tax only
  total: number;                 // importe + iva must match within $1
  concepto: string | null;       // best-guess from valid list
  cuentaPnl: string | null;      // best-guess from valid list
  lineItems: LLMLineItem[];
  extractionConfidence: number;  // 0-1
}
```

**Line item extraction** (lines 58-67 of prompt):
- Per-item `description`, `quantity`, `unit`, `unitNormalized`, `unitPrice`, `total`, `category` (concepto)
- Model forced to pick category for each item from concepto list
- Specific guidance: "For produce → 'Frutas y Verduras', meat → 'Carnes', poultry → 'Aves', fish → 'Pescados y Mariscos', dairy → 'Lácteos'"

**Unit normalization** (lines 14-16, 97):
```typescript
UNIT_NORMALIZED_VALUES = ["kg", "g", "l", "ml", "pz", "caja", "docena", 
                          "bolsa", "metro", "lata", "botella", "galon", 
                          "costal", "sobre", "rollo", "otros"]
```

---

### 2. CLASSIFICATION TAXONOMY (PRIMARY CONCERN)

#### Concepto Values (88 distinct values in data/dropdown_options.json)
These are **line-item product categories**:

**Food categories** (direct food costs):
- Frutas y Verduras, Frutas y Verduras Bar, Frutas y Verduras Bebidas
- Carnes, Aves, Pescados y Mariscos
- Quesos, Lácteos, Leche, Cremería, Mantequilla, Huevo
- Panadería, Pastelería, Abarrotes Alimentos, Helado, Postres
- Café, Té, Refrescos, Agua, Agua /provisión, Hielo, Kombucha
- Cerveza, Bebidas Alcohólicas, Abarrotes Bebidas, Abarrotes Bebidas con Alcohol, Vinos

**Operational/Non-food**:
- Gas, Gas /provisión
- Luz, Luz /provisión
- Renta, Renta /provisión
- Teléfono, Teléfono /provisión
- Siguros y fianzas, Seguros GMM, etc. (/provisión variants exist for accrual accounting)
- Fumigación, Iguala Mantenimiento, Mantenimiento, Mantenimiento de Imagen
- Loza/plaqué/cristalería, Utensilios de cocina, Mobiliario, Equipo de Restaurante
- Servicios Profesionales, Contadores, Gastos Legales
- Papelería, Impresos y consumibles
- Uniformes, Transporte de Personal, Alimentos de Personal
- Capacitación, Bonos de Gerentes, Comisión Tarjetas Bancarias, Comisiones Plataforma
- Varios Alimentos, Varios Bebidas, Varios Capitalizables, Varios de Administración, Varios de Operación, Varios de Personal

**Location in code**: `/Users/mateososaalbrecht/boh-saas/data/dropdown_options.json` lines 3-88

#### Cuenta P&L Values (7 values — hard-coded business logic!)
These are **P&L account mappings** used for cost classification:

```json
{
  "cuentaPnl": [
    "Costo de Alimentos",           // Cost of Goods Sold for food
    "Costo de Bebidas sin Alcohol", // Cost of Goods Sold for beverages
    "Mantenimiento",                // Operating expense
    "Mobiliario",                   // Capital/fixed asset
    "Renta",                        // Operating expense
    "Gas",                          // Operating expense
    "Varios de Administración"      // Operating expense
  ]
}
```

**Location**: `/Users/mateososaalbrecht/boh-saas/data/dropdown_options.json` lines 89-97

#### Cost Type Classification (src/lib/cost-classification.ts)

Hard-coded mapping from `cuentaPnl` to runtime `CostType`:

```typescript
export const FOOD_CUENTAPNL = new Set(["Costo de Alimentos"]);
export const BEVERAGE_CUENTAPNL = new Set(["Costo de Bebidas sin Alcohol"]);

export type CostType = "food" | "beverage" | "operational";

export function getCostType(cuentaPnl: string): CostType {
  if (FOOD_CUENTAPNL.has(cuentaPnl)) return "food";
  if (BEVERAGE_CUENTAPNL.has(cuentaPnl)) return "beverage";
  return "operational";
}

export function isFoodCost(costType: CostType): boolean {
  return costType === "food" || costType === "beverage";
}
```

**Location**: `/Users/mateososaalbrecht/boh-saas/src/lib/cost-classification.ts` lines 7-21

This function is called when saving invoices to `line_items.cost_type` (supabase.ts line 112).

#### Supplier Mapping (Concepto + Cuenta P&L assignment)

**Approach**: Static JSON file lookup by supplier name
**File**: `/Users/mateososaalbrecht/boh-saas/data/supplier_mapping.json`

Currently only has one example entry:
```json
{
  "_comment": "Maps supplier names (case-insensitive) to their fixed Concepto and Cuenta P&L values.",
  "EJEMPLO PROVEEDOR SA DE CV": {
    "concepto": "Alimentos y Bebidas",
    "cuentaPnl": "Costo de Ventas"
  }
}
```

**Lookup logic** (src/lib/supplier-mapping.ts):
- Case-insensitive, trimmed exact match
- Falls back to partial substring match (mapping key >= 4 chars)
- Returns `SupplierEntry { concepto, cuentaPnl }` or null
- Called during parse (route.ts line 108): `const mapping = lookupSupplier(extraction.supplier)`
- If found, overrides LLM extraction (route.ts lines 143-144): `mapping?.concepto ?? extraction.concepto`

#### Supplier Tag Override System (src/lib/supplier-classification.ts)

Runtime supplier tags stored in `app_settings` table, keyed by `(tenant_id, "supplier_tags")`:

```typescript
export const FOOD_SUPPLIER_TAGS = new Set([
  "Costo de Alimentos",
  "Costo de Bebidas sin Alcohol",
]);

export function isFoodSupplierTag(tag: string | null | undefined): boolean {
  return !!tag && FOOD_SUPPLIER_TAGS.has(tag);
}

export function belongsInCompras(tag: string | null | undefined, fallbackIsFood: boolean): boolean {
  if (hasSupplierTagOverride(tag)) return isFoodSupplierTag(tag);
  return fallbackIsFood;
}
```

Read from DB via `readSupplierTags()` (lines 32-41), used in analytics to filter invoices into "Compras" (food) vs "Gastos" (operational) tabs.

**Location**: `/Users/mateososaalbrecht/boh-saas/src/lib/supplier-classification.ts`

#### Line-Item Category Classification

**Where it happens**:
1. **LLM extraction** (openai.ts): Model assigns `category` (concepto value) to each line item
2. **Save to DB** (supabase.ts line 110): `category: item.category ?? null` stored in `line_items.category`

**Used for analytics**: grouping by category in reports

---

### 3. DATA MODEL

#### Tables (from migrations)

**Core invoice tables**:

```sql
-- invoices
id (text, PK)
tenant_id (uuid, FK → tenants)
restaurant (text)          -- Restaurant slug/identifier
supplier (text)
invoice_number (text)      -- Digits only, null if absent
invoice_date (text, yyyy-mm-dd)
importe (numeric)          -- Net before IVA
iva (numeric)              -- Tax only
total (numeric)            -- Net + IVA
concepto (text)            -- Best-match from dropdown
cuenta_pnl (text)          -- Best-match from dropdown
comments (text)
submitted_by (text)        -- User email
submitted_at (timestamptz)
spreadsheet_url (text)     -- Legacy: Google Sheet URL
file_url (text)            -- Supabase Storage path
sheet_sync_status (text)   -- 'pending', 'synced', 'failed', 'skipped'
sheet_sync_error (text)
sheet_synced_at (timestamptz)
deleted_at (timestamptz)   -- Soft delete
deleted_by (text)
```

**Line items**:

```sql
-- line_items
id (uuid, PK)
tenant_id (uuid, FK → tenants)
invoice_id (text, FK → invoices)
line_index (integer)       -- Position within invoice (for idempotency)
restaurant (text)
supplier (text)
invoice_date (text)
description (text)
quantity (numeric)
unit (text)                -- Raw unit from invoice
unit_normalized (text)     -- Canonical: kg, g, l, ml, pz, caja, etc.
unit_price (numeric)
total (numeric)
category (text)            -- Concepto for this item
ingredient_id (uuid, FK → ingredients)
cost_type (text)           -- 'food', 'beverage', 'operational' (derived from cuenta_pnl)
deleted_at (timestamptz)
```

**Tenancy**:

```sql
-- tenants
id (uuid, PK)
slug (text, UNIQUE)        -- tenant identifier (e.g., 'aventura_gourmet')
name (text)                -- Display name
settings (jsonb)           -- { sheetRegistry: { "motin_juarez_2026_01": "spreadsheetId" }, ... }

-- restaurants
id (uuid, PK)
tenant_id (uuid, FK → tenants)
slug (text)                -- Unique per tenant
label (text)               -- Display name

-- tenant_users
id (uuid, PK)
user_id (uuid, FK → supabase auth.users)
tenant_id (uuid, FK → tenants)
role (text)                -- 'admin', 'member', 'readonly'
email (text)
created_at (timestamptz)
```

**Ingredients**:

```sql
-- ingredients
id (uuid, PK)
tenant_id (uuid, FK → tenants, ON DELETE CASCADE)
canonical_name (text)
aliases (text[])           -- Array of description aliases
category (text)            -- Optional: product category
default_unit (text)        -- Optional: default unit for this ingredient
```

**Audit/edit history**:

```sql
-- invoice_edits
id (uuid, PK)
invoice_id (text, FK → invoices)
tenant_id (uuid, FK → tenants)
edited_by (text)
edited_at (timestamptz)
changes (jsonb)            -- { fieldName: { from: oldVal, to: newVal }, ... }

-- audit_log
id (uuid, PK)
action (text)              -- 'submitted', 'duplicate_bypassed'
user_name (text)
tenant_id (uuid)
restaurant (text)
supplier (text)
invoice_id (text)
invoice_number (text)
invoice_date (text)
total (numeric)
spreadsheet_url (text)
details (jsonb)
created_at (timestamptz)
```

**Migrations**:
- `/Users/mateososaalbrecht/boh-saas/supabase/migrations/20260411_add_multi_tenancy.sql` — Tenants + restaurants + backfill Aventura
- `/Users/mateososaalbrecht/boh-saas/supabase/migrations/20260425_supabase_first.sql` — Sheet sync metadata
- `/Users/mateososaalbrecht/boh-saas/supabase/migrations/20260425_phase2_invoice_lifecycle.sql` — Soft delete + edit history
- `/Users/mateososaalbrecht/boh-saas/supabase/migrations/20260425_tenant_scope_ingredients.sql` — Tenant scoping for ingredients
- `/Users/mateososaalbrecht/boh-saas/supabase/migrations/20260412_add_pos_tables.sql` — Parrot POS sync tables (separate from invoicing)
- `/Users/mateososaalbrecht/boh-saas/supabase/migrations/20260422_add_supabase_auth.sql` — Supabase Auth integration

**Aventura Gourmet seed data** (migration 20260411, lines 51-66):
```sql
INSERT INTO tenants VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'aventura_gourmet', 'Aventura Gourmet', '{}')
  
INSERT INTO restaurants VALUES
  ('a0000000-0000-0000-0000-000000000001', 'motin_juarez', 'Motín Juárez'),
  ('a0000000-0000-0000-0000-000000000001', 'motin_roma', 'Motín Roma'),
  ('a0000000-0000-0000-0000-000000000001', 'queseria', 'Quesería')
```

---

### 4. ANALYTICS & REPORTING

#### Food Cost Analytics (src/lib/analytics/food-cost.ts)

**Filtering logic**:
```typescript
const FOOD_BEV_CUENTAPNL = new Set(["Costo de Alimentos", "Costo de Bebidas sin Alcohol"]);
const FOOD_COST_TYPES = new Set(["food", "beverage"]);
```

Invoices are grouped by:
- **By restaurant** (invoice.restaurant, from `restaurants` table)
- **By supplier** (invoice.supplier, optionally with display-name alias from `app_settings`)
- **By concepto** (invoice.concepto → categories)
- **By cost_type** (derived from cuenta_pnl)

**Output aggregations**:
- `totalSpend`, `invoiceCount`, `supplierCount`, `itemCount`
- Weekly trend: `Array<{ week: string; total: number }>`
- Category breakdown: `Array<{ name: string; total: number }>`
- Supplier breakdown: `Array<{ supplier: string; total: number }>`
- Top items: `Array<{ label: string; total: number; count: number; quantity; unit; category }>`
- Restaurant breakdown: `Array<{ restaurant: string; total: number }>`

**Location**: `/Users/mateososaalbrecht/boh-saas/src/app/api/compras/analytics/route.ts` (lines 24, 36-39)

#### Gastos (Operational) Analytics (src/app/gastos/page.tsx, GastosAnalytics.tsx)

Inverted logic: filters OUT food (beverages) via supplier tags, groups by `cuenta_pnl` (P&L accounts).

---

### 5. AVENTURA-SPECIFIC SIGNALS

#### Hard-Coded Restaurant References

**Migration seed** (20260411, lines 62-65):
```sql
INSERT INTO restaurants VALUES
  ('a0000000-0000-0000-0000-000000000001', 'motin_juarez', 'Motín Juárez'),
  ('a0000000-0000-0000-0000-000000000001', 'motin_roma', 'Motín Roma'),
  ('a0000000-0000-0000-0000-000000000001', 'queseria', 'Quesería')
```

**Tenant ID**: `a0000000-0000-0000-0000-000000000001` (hardcoded in migration)

**Location references in config comment** (src/config.ts):
```
Key format: {restaurant}_{YYYY}_{MM}  e.g. "motin_juarez_2025_01"
```

#### Invoice Mock Data (src/app/invoice-mockups/page.tsx, lines 8-44)

Sample invoices reference "Aventura" restaurant and Aventura-specific suppliers:
- Comercializadora de Alimentos Saida
- Distribuidora La Palma
- Productos Frescos del Valle
- Carnícería El Ranchero S.A.
- Importadora de Especias MX

#### Concepto List

The concepto dropdown is entirely Mexican-restaurant specific:
- Spanish ingredient names (Jitomate, Cebolla, Lechuga, Cilantro, Epazote, Hierba Santa)
- Mexican supplier patterns (provisión = accrual, Seguros GMM = specific insurance provider)
- Regional units (domo, charola, manojo, atado = Mexican produce flats/bunches)

#### Unit Normalization (src/lib/unit-normalizer.ts)

Mexican-specific units explicitly documented (lines 7-10):
```typescript
// DOMO / FLAT / CHAROLA  → caja  (berry flat/tray ~250–500g)
// MANOJO / ATADO          → bolsa (bunch of herbs/greens)
// KGM / KILO / K          → kg
// PZA / PIEZA / UND       → pz
```

Map includes Spanish/English/Mexican variants (e.g., kilogramo, kilogramos alongside kg).

---

### 6. ONBOARDING FLOW

#### Dynamic Restaurant Setup (src/app/onboard/page.tsx, src/app/api/onboard/route.ts)

**NOT Aventura-specific**:
- Creates new tenant with custom name + slug
- User defines N restaurants with custom labels + slugs
- Stores in `tenants` and `restaurants` tables
- No hard-coded locations

**Validates**:
- Slug uniqueness per tenant
- Slug format: lowercase alphanumeric + hyphens only
- At least one restaurant required

**Located**: `/Users/mateososaalbrecht/boh-saas/src/app/api/onboard/route.ts` lines 7-106

---

### SUMMARY: GENERALIZATION ROADMAP

**What's Aventura-specific and must be removed/generalized**:

1. **Migration seed (20260411)**: Hard-coded tenant ID + restaurant names
   - Action: Keep pattern, remove seed data or make it optional
   
2. **Concepto/Cuenta P&L dropdowns**: Spanish-only, Mexican restaurant-specific categories
   - Action: Make per-tenant configurable; provide UI for admins to customize

3. **Cost-type classification** (src/lib/cost-classification.ts): Only recognizes "Costo de Alimentos" + "Costo de Bebidas sin Alcohol"
   - Action: Generalize to query dynamic P&L accounts from tenant settings

4. **Supplier mapping JSON**: Minimal seeding; requires manual entry
   - Action: Build admin UI for supplier → concepto/cuenta mapping

5. **Unit normalization**: Mexican-specific (domo, charola, manojo, atado)
   - Action: Keep core units; remove Mexican-specific variants or make configurable

6. **LLM system prompt**: Hardcoded Spanish language, Mexican invoice format assumptions
   - Action: Parametrize language + region; store in tenant settings

7. **Google Sheets integration**: Assumes Aventura's sheet structure (months as tabs)
   - Action: Already tenant-scoped; requires per-tenant sheet registry setup

**What's already generalized**:
- Multi-tenancy model (tenants, restaurants, tenant_users)
- Dynamic restaurant lookup (not hard-coded)
- Onboarding flow (user-defined restaurants)
- Database schema (tenant_id FK on all tables)