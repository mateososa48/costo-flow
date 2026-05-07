# Mexican Restaurant Back-Office Classification — Research & Refactor Proposal

**Audience:** Costoflow product/engineering (boh-saas repo)
**Status:** v2 — Option B selected and leaned down to a 6-cuenta / 12-concepto v1 spine after design review (2026-05-02). Sections 2, 3 (Option B) and 4 reflect the agreed lean shape; Options A and C left intact for context.
**Date:** 2026-05-01 (initial research) · 2026-05-02 (lean revision)

> **Guiding principle (user, 2026-05-02):** *"The purpose of Costoflow is to make cost tracking easier, not more complex."* The lean v1 catálogo prioritizes onboarding speed and the buckets a real owner reviews monthly. SAT código agrupador, USALI alignment, and finer granularity are deliberate add-ons later — not v1.

---

## 1. Key findings

### Regulatory baseline (SAT)

1. **There is no SAT-mandated, restaurant-specific chart of accounts.** SAT publishes a *código agrupador de cuentas* (Anexo 24 of the Resolución Miscelánea Fiscal) — a 6-group skeleton (1 Activo, 2 Pasivo, 3 Capital, 4 Ingresos, **5 Costos**, **6 Gastos**) — that *every* taxpayer must map their own internal accounts to. Each taxpayer keeps their own catálogo and tags each account with the SAT grouping code so contabilidad electrónica XML files (Catálogo + Balanza) parse uniformly. ([SAT Anexo 24 PDF (omawww.sat.gob.mx)](http://omawww.sat.gob.mx/normatividad_rmf_rgce/Paginas/documentos2024/rmf/anexos/Anexo_24_RMF2024-22012024.pdf), [Anexo 24 RMF 2026](https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rmf/anexos/Anexo_24_RMF2026-13012026.pdf), [ContadorMx — código agrupador](https://contadormx.com/catalogo-cuentas-codigo-agrupador-la-contabilidad-electronica/))
2. **The 5xx/6xx subgroups are coarse.** Costos splits into ~ `51 Costo de ventas` and `52 Costo de producción`; Gastos splits into `61 Gastos de ventas`, `62 Gastos administrativos`, `63 Gastos financieros`. Restaurants almost always need finer granularity than this for management reporting — that finer granularity is *not* prescribed by SAT. ([EdiFactMx — catálogo SAT código agrupador](https://www.edifact.com.mx/masinfo/catalogo-sat-codigo-agrupador.html))
3. **CFDI 4.0 line items always carry a `ClaveProdServ` (SAT product/service code).** Restaurants receive supplier facturas with codes like `50111500` (meat/poultry), `50202201` (beer), `50202306` (soft drinks), `50201708` (coffee), `50192300` (desserts), `90101501` (restaurant service). The `ClaveProdServ` is mandatory at the line level along with `ClaveUnidad` (unit), `ObjetoImp` (tax object), and IVA/IEPS breakdown. ([Polotab — CFDI 4.0 restaurantes](https://blog.polotab.com/facturacion-restaurantes-cfdi-4-0-mexico/), [Veinte — clave 90101501](https://veinte.mx/catalogos/clave/90101501))
4. **`Uso de CFDI` lives on the *receiver's* side, and as the buyer the restaurant chooses one of ~30 codes** — most commonly `G01 Adquisición de mercancías` (resale inventory, e.g., food/bev to be sold), `G03 Gastos en general` (consumables, supplies), or `I0x` series for capitalized investments. `P01` was eliminated in CFDI 4.0; the buyer must commit to a use up front. ([SW Sapien — uso de CFDI 4.0](https://sw.com.mx/blog/cumplimiento-fiscal/catalogo-de-uso-de-cfdi-4.0-que-es-el-uso-de-cfdi-y-como-se-usa), [ChecaFactura — tabla completa](https://checafactura.com/blog/uso-cfdi-cual-elegir))
5. **`ClaveProdServ` is a *useful* signal but a noisy classifier.** Suppliers pick whatever they want; the same conceptual product (e.g., "limpieza") can arrive under several codes. So it's a hint, not a source of truth — every serious back-office layer still needs an internal taxonomy on top.

### Industry standards for restaurants

6. **The de-facto international standard is USAR** (Uniform System of Accounts for Restaurants, 8th ed., National Restaurant Association). USALI is the *lodging* equivalent, used by hotel restaurants. Both are recommended in Mexican hospitality-finance literature; neither is required. ([USAR overview (Amazon listing)](https://www.amazon.com/Uniform-System-Accounts-Restaurants-8th/dp/0133142876), [Ingeniería de Menú — catálogo de cuentas restaurante](https://ingenieriademenu.com/catalogo-de-cuentas-de-un-restaurante/))
7. **The standard Mexican restaurant catálogo (USALI-influenced) typically looks like:**
   - **4xxx Ingresos** — Alimentos / Bebidas / Otros / Descuentos
   - **5xxx Costo de ventas** — Costo de Alimentos / Costo de Bebidas (often split alcohol vs. sin alcohol) / Otros costos
   - **6100 Nómina y relativos** — sueldos, IMSS/INFONAVIT, prestaciones
   - **6200 Gastos de operación** — limpieza, uniformes, loza/cristalería, papelería, suministros
   - **6300 Gastos de administración** — honorarios, software, papelería admin, comisiones bancarias
   - **6400 Ventas y mercadotecnia** — publicidad, comisiones de plataforma (Rappi/UberEats/DiDi)
   - **6500 Mantenimiento** — iguala, refacciones, fumigación
   - **6600 Energéticos / Servicios** — luz, gas, agua, teléfono, internet
   - **7xxx No-operacionales** — renta, seguros, depreciación
   - **8xxx Financieros** — intereses, comisiones bancarias, IVA
   ([Ingeniería de Menú](https://ingenieriademenu.com/catalogo-de-cuentas-de-un-restaurante/), [SimpleRestaurantAccounting COA](https://simplerestaurantaccounting.com/chart-of-accounts-for-restaurants/), [Lavu MX — cuentas contables restaurante](https://www.lavu.com.mx/blog/contabilidad-para-restaurantes/))
8. **Food cost is universally subdivided.** US/MX templates consistently split COGS into Meat / Poultry / Seafood / Dairy / Produce / Bakery / Frozen / Grocery, and Beverage into Liquor / Beer / Wine / Non-alcoholic. This matches Aventura's instinct (Carnes, Aves, Pescados y Mariscos, Cremería, Frutas y Verduras, Panadería, Abarrotes, etc.) very closely. ([SimpleRestaurantAccounting](https://simplerestaurantaccounting.com/chart-of-accounts-for-restaurants/))

### How competitors handle it

9. **Aspel COI / Siigo (legacy MX accounting):** ships a default catálogo *with the SAT código agrupador already wired in*; each tenant edits/extends. Supports importing a custom catálogo via Excel. Multi-sucursal handled via "Departamentos / Centros de Costo / Proyectos" tagged at voucher entry, with P&L by cost center as a standard report. ([Aspel COI](https://www.siigo.com/mx/software-contable-aspel-coi/restaurantes-gastrobar/), [Importar cuentas](https://coiportaldeclientes.aspel.com.mx/importar-cuentas-al-catalogo-del-sistema/))
10. **CONTPAQi:** "Segmentos de Negocio" act as cross-cutting cost centers (sucursal / proyecto / agente) — independent dimension from the chart of accounts, applied at posting time. ([Integra Consorcio — CONTPAQi segmentos](https://integraconsorcio.com.mx/public/index.php/blog/articulo/Segmentos_de_Negocio_o_Centros_de_costo_en_CONTPAQi_Contabilidad))
11. **Bind ERP (cloud MX SMB ERP):** auto-creates a "Matriz" sucursal; user adds more via Configuración > Sucursales. Catálogo de cuentas is editable; multi-sucursal/multi-almacén is a first-class concept. ([Bind ERP](https://bind.com.mx/), [Bind sucursales](https://www.tiendanube.com/mx/tienda-aplicaciones-nube/bind-erp))
12. **Foodics Accounting (international restaurant SaaS):** ships a default chart of accounts; tenant can add/remove. "Cost centers" (a.k.a. revenue centers) are a separate dimension — branch is one type. Designed so onboarding is "instant activation, automatic matching with POS." ([Foodics CoA help](https://help.foodics.com/hc/en-us/articles/17229760824988-Chart-of-Accounts-Explanation-and-user-guide-for-Foodics-Accounting), [Foodics Accounting](https://www.foodics.com/accounting/))
13. **Parrot (MX restaurant POS):** owns menu/category management on the *sales* side and outsources the GL to whatever accounting system the customer uses (Aspel/CONTPAQi). 14-day standard onboarding includes "personalizar y configurar" categorías. So Parrot avoids prescribing a P&L catálogo — they let users define their own categories per tenant. ([Parrot Software](https://parrotsoftware.com.mx/), [Parrot configuración](https://parrotsoftware.com.mx/parrot-pos-todo-en-uno-para-restaurantes))
14. **The pattern across all five:** ship a sane default catálogo + let tenant override + treat sucursal/cost center as a separate dimension (NOT a column on every account).
15. **Multi-sucursal best practice (MX consensus):** keep one tenant-wide chart of accounts, attach `centro_de_costo` (sucursal) as a tag at the line-item / journal-entry level. Avoid per-sucursal catálogos — they make consolidation reports painful. ([Contalink — centros de costo](https://tutoriales.contalink.com/es/articles/8589839-centros-de-costos))

---

## 2. Universal vs. restaurant-specific layer

What every Mexican restaurant absolutely needs (ship as defaults):

| Layer | What |
|---|---|
| **SAT regulatory** | `código_agrupador` field on every account (1xx–6xx), `ClaveProdServ` captured per line item, `Uso de CFDI` per invoice, IVA/IEPS breakdown, supplier RFC. Non-negotiable for contabilidad electrónica. |
| **Universal restaurant taxonomy** | Top of the catálogo: **Costo de Alimentos**, **Costo de Bebidas (alcohol)**, **Costo de Bebidas (sin alcohol)**, **Nómina**, **Gastos de operación**, **Mantenimiento**, **Servicios (luz/gas/agua/teléfono/internet)**, **Renta**, **Mercadotecnia**, **Comisiones de plataforma**, **Honorarios**, **Software/sistemas**, **Suministros de limpieza**, **Loza y cristalería**, **Uniformes**. ~15–20 universal categories. |
| **Universal food sub-categories** | Carnes, Aves, Pescados y Mariscos, Cremería/Lácteos, Frutas y Verduras, Panadería, Abarrotes secos, Congelados, Café/Té, Refrescos, Cerveza, Vinos, Destilados. ~13 universal sub-conceptos. |
| **Cost-type classifier** | Three-way `food` / `beverage` / `operational` derived from the cuenta — universal because it drives the COGS-vs-OpEx separation that every P&L uses. |

What is **Aventura-specific** (must NOT be hard-coded as default):

- The "**/provisión**" suffix on ~12 conceptos (Renta /provisión, Luz /provisión, etc.) — Aventura's particular accrual workflow. Most restaurants don't track provisiones at concepto level.
- **"Bonos de Gerentes", "Cuota por Administración", "Inversión de Publicidad"** — Aventura's particular labeling of standard expense lines.
- The split **"Frutas y Verduras / Frutas y Verduras Bar / Frutas y Verduras Bebidas"** — Aventura splitting produce by destination (kitchen vs. bar). Most restaurants use one bucket.
- **"Kombucha", "Helado", "Tortillas", "Postres", "Pastelería"** as top-level conceptos — these are menu-category-driven, not standard catálogo entries. Most restaurants would lump these under Abarrotes or Panadería.
- **Only 7 cuenta_pnl values** is unusually flat. Most MX restaurants run 30–80 cuenta_pnl entries (closer to USALI granularity).
- The **"Iguala Mantenimiento"** wording is Aventura-specific (general term is "Mantenimiento — contratos").
- The hardcoded **`FOOD_CUENTAPNL = {"Costo de Alimentos"}`** assumes there's exactly one food account. Real restaurants often have several (Costo de Alimentos Cocina, Costo de Alimentos Banquetes, etc.).

Conclusion: **the universal layer is ~20 conceptos and ~10 cuenta_pnl entries**; everything beyond that should be tenant-extensible.

---

## 3. Three options for the refactor

### Option A — "Aventura-as-default with per-tenant edit"

**One-liner:** Lift the current 88 conceptos / 7 cuenta_pnl into the database as the seed for *every* new tenant; expose a Settings UI where each tenant deletes/renames/adds entries.

**Data model (rough):**
```sql
-- New tables
CREATE TABLE concepts (
  id          uuid PK,
  tenant_id   uuid FK tenants,
  label       text NOT NULL,
  cuenta_pnl_id uuid FK cuenta_pnl,    -- default mapping
  is_archived boolean DEFAULT false,
  sort_order  int,
  UNIQUE(tenant_id, label)
);

CREATE TABLE cuenta_pnl (
  id          uuid PK,
  tenant_id   uuid FK tenants,
  label       text NOT NULL,
  cost_type   text CHECK (cost_type IN ('food','beverage','operational')),
  is_archived boolean DEFAULT false,
  UNIQUE(tenant_id, label)
);

-- Existing line_items.concepto / cuenta_pnl stay as text columns (denormalized)
-- but a new concept_id / cuenta_pnl_id FK is added for joins.
ALTER TABLE line_items ADD COLUMN concept_id uuid REFERENCES concepts(id);
ALTER TABLE line_items ADD COLUMN cuenta_pnl_id uuid REFERENCES cuenta_pnl(id);
```
Onboarding seeder copies the Aventura 88+7 set into each new tenant.

**Onboarding UX:** New restaurant signs up → tenant gets seeded with Aventura's catálogo → owner is shown a Settings > Catálogo screen with "Reuse defaults / Customize" toggle. Most owners will never touch it on day one.

**Migration path:** Trivial. Aventura keeps its current values verbatim; we just back-fill `concept_id` and `cuenta_pnl_id` on existing rows by name match. No data loss, no re-classification needed.

**Pros**
- Lowest engineering effort. Working code path on day one.
- Aventura sees zero behavior change.
- Cost-type classifier keeps working unchanged.

**Cons / Risk**
- New tenants get an Aventura-shaped taxonomy that includes very Aventura-specific concepts ("/provisión" suffix, "Bonos de Gerentes", "Cuota por Administración") — they'll be confused on day one.
- The LLM extractor is currently prompted with the 88 conceptos as the allowed enum; it will start hallucinating/mis-classifying once the universe varies per tenant. Needs prompt-per-tenant.
- No SAT código agrupador wired in → kicking the regulatory can down the road.

**Effort:** **Small.** ~3–5 days. Mostly a schema + seed + Settings page.

---

### Option B — "SAT-aligned universal catálogo + per-tenant extension"

**One-liner:** Ship a curated, USALI-flavored, SAT-código-agrupador-tagged universal catálogo (~20 cuenta_pnl, ~30 conceptos) as global defaults; tenants extend or rename, but inherit the spine. Add `centro_de_costo` as a first-class dimension.

**Data model:**
```sql
-- Global (no tenant_id) — system catálogo
CREATE TABLE system_cuenta_pnl (
  id              uuid PK,
  label           text,
  codigo_agrupador text,           -- e.g., '510', '610', '650'
  cost_type       text,            -- 'food'|'beverage'|'operational'
  sat_uso_cfdi_default text,       -- 'G01' for inventory, 'G03' for general
  sort_order      int
);
CREATE TABLE system_concepts (
  id              uuid PK,
  label           text,
  default_cuenta_pnl_id uuid FK system_cuenta_pnl,
  -- typical SAT product codes that map here (for LLM hinting)
  typical_clave_prod_serv text[]
);

-- Tenant overlay: a tenant either uses a system row (by FK) or defines its own
CREATE TABLE tenant_cuenta_pnl (
  id            uuid PK,
  tenant_id     uuid FK,
  system_id     uuid NULL FK system_cuenta_pnl,  -- null => fully custom
  label         text,                             -- tenant override of label
  codigo_agrupador text,                          -- tenant override
  cost_type     text,
  is_active     boolean DEFAULT true
);
CREATE TABLE tenant_concepts (
  id            uuid PK,
  tenant_id     uuid FK,
  system_id     uuid NULL FK system_concepts,
  label         text,
  cuenta_pnl_id uuid FK tenant_cuenta_pnl,
  is_active     boolean
);

-- Cost-center / sucursal (already partially exists as restaurants table)
-- Generalize: every line item carries cost_center_id, not just a free-text restaurant
ALTER TABLE line_items ADD COLUMN cost_center_id uuid REFERENCES restaurants(id);
ALTER TABLE invoices ADD COLUMN cost_center_id uuid REFERENCES restaurants(id);
```

**Onboarding UX:** New tenant picks a *template* during sign-up: "Restaurante casual / Fine dining / Bar / Cafetería / Custom". Each template activates a curated subset of the system catálogo (e.g., a cafetería doesn't get "Vinos" or "Destilados"). Owner can flip any row on/off and rename labels in Settings. Add custom concepts at any time.

**Migration path:** Medium-touch. Map each Aventura concept → closest system concept (or mark as tenant-custom). Aventura's "Frutas y Verduras Bar" becomes either (a) a renamed instance of `system: Frutas y Verduras` with cost_center=Bar, or (b) kept as a tenant-custom entry. The seven Aventura cuenta_pnl values map cleanly to system cuenta_pnl. "/provisión" entries stay tenant-custom. Build a one-time mapping JSON, run a migration that re-points `cuenta_pnl_id` on every line_item.

**Pros**
- New tenants get a *good* default — not an Aventura-shaped one. Onboarding is real.
- SAT-ready: código agrupador is on every account, so we can produce contabilidad electrónica XML later with no additional schema work.
- LLM prompt becomes universal (system catálogo) + tenant overlay (small delta) → cheaper, more consistent extraction.
- Centro-de-costo separation lets us cleanly support multi-sucursal P&L without per-sucursal catálogos.

**Cons / Risk**
- Real research and curation work to design the system catálogo (need an MX restaurant accountant in the loop, or accept that v1 will be wrong in edges).
- Aventura's data has to be re-mapped — non-trivial. Names like "Iguala Mantenimiento" don't have a clean system twin; need a migration JSON the user reviews.
- More schema surface, more queries, more places for bugs.

**Effort:** **Medium.** ~2–3 weeks including catálogo curation, migration script, settings UI, LLM prompt restructuring.

---

### Option C — "Fully tenant-defined with starter-template wizard"

**One-liner:** No global catálogo at all. On signup, the tenant runs a 3-step wizard ("What kind of restaurant? Pick a starter template. Edit anything before continuing.") that *copies* a chosen starter into the tenant's own catálogo, after which the templates are forgotten. Templates are versioned blueprints maintained in code/JSON — not foreign-key parents.

**Data model:**
```sql
-- Templates live as JSON files in repo (not in DB)
-- /data/catalog-templates/casual-mx.json
-- /data/catalog-templates/fine-dining-mx.json
-- /data/catalog-templates/bar-mx.json
-- /data/catalog-templates/cafeteria-mx.json
-- /data/catalog-templates/aventura-legacy.json   <- migration target

-- DB only has tenant rows
CREATE TABLE concepts (
  id          uuid PK,
  tenant_id   uuid FK,
  label       text,
  cuenta_pnl_id uuid FK,
  codigo_agrupador text NULL,        -- optional
  is_active   boolean
);
CREATE TABLE cuenta_pnl (
  id          uuid PK,
  tenant_id   uuid FK,
  label       text,
  cost_type   text,
  codigo_agrupador text NULL
);

-- Cost-type classifier moves from hardcoded sets to a per-row column.
-- The cost_type column on cuenta_pnl drives line_items.cost_type at save time.
```

**Onboarding UX:** Sign-up wizard:
1. "What's your concept?" → choose Casual / Fine Dining / Bar / Cafetería / Blank / Import-from-Aventura
2. Preview the catálogo (list of cuenta_pnl + conceptos), with checkboxes to deselect
3. "Add custom" inline before finishing
4. Done — tenant owns its catálogo from this moment, no upstream link

Settings page is a full CRUD on concepts/cuenta_pnl with no "system row" concept to reason about.

**Migration path:** Aventura is treated like any other tenant — its current 88+7 become its `concepts` and `cuenta_pnl` rows, exported once to `aventura-legacy.json` as a starter template (in case anyone else wants the same shape). No re-classification. Existing line_item text values get foreign-keyed to new rows by exact-match.

**Pros**
- Maximum flexibility. No upstream taxonomy debt — if a tenant wants "Tortillas Norte / Tortillas Sur" they just add it.
- Simplest mental model: tenant owns its world. No "system vs. tenant" merge logic to reason about.
- Templates are easy to add/iterate (just JSON files), no DB migration to update them.
- Aventura migration is the cheapest of all options.

**Cons / Risk**
- Templates can drift from each other and from SAT updates because they're not normalized.
- No central place to update "the food sub-categories" once we learn more — every tenant who already onboarded keeps their snapshot.
- LLM prompt has to be regenerated per tenant from their catálogo (manageable but slightly more cost / complexity).
- Tenants still get a *pretty good* default but they're more likely to over-customize and end up with idiosyncratic catálogos that hurt benchmarking later.

**Effort:** **Medium-small.** ~1.5–2 weeks. Schema is simpler than Option B; complexity moves into the wizard and template JSON design.

---

## 4. Recommended option: **Option B**

Option B is the right balance for boh-saas right now. Aventura proves the value proposition is *not* "let me bring my own taxonomy" — it's "tell me my food cost % vs. my OpEx % without me thinking." That requires a curated universal spine that benchmarks across tenants and ships SAT-clean (código agrupador on every cuenta) so contabilidad electrónica is a future-proof bonus, not a re-architecture. Option A locks new customers into Aventura's idiosyncrasies; Option C trades long-term comparability and SAT alignment for short-term flexibility we don't yet need.

Concretely: invest 2–3 weeks now in a curated `system_cuenta_pnl` (~20 entries) + `system_concepts` (~30 entries), each tagged with SAT código agrupador and a typical `ClaveProdServ` set, plus a tenant overlay table. Aventura's "/provisión" entries and bar/kitchen splits become tenant-custom rows on top. New tenants pick a template (casual/fine-dining/bar/cafetería) and customize only the delta — first onboarding becomes a 5-minute process instead of a multi-hour calibration session.

---

## Sources

- [SAT — Anexo 24 RMF 2026 (PDF)](https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rmf/anexos/Anexo_24_RMF2026-13012026.pdf)
- [SAT — Anexo 24 RMF 2024 (PDF)](http://omawww.sat.gob.mx/normatividad_rmf_rgce/Paginas/documentos2024/rmf/anexos/Anexo_24_RMF2024-22012024.pdf)
- [SAT — Código agrupador de cuentas (PDF)](http://omawww.sat.gob.mx/fichas_tematicas/buzon_tributario/Documents/codigo_agrupador.pdf)
- [ContadorMx — catálogo de cuentas y código agrupador](https://contadormx.com/catalogo-cuentas-codigo-agrupador-la-contabilidad-electronica/)
- [EdiFactMx — catálogo SAT código agrupador](https://www.edifact.com.mx/masinfo/catalogo-sat-codigo-agrupador.html)
- [Solución Factible — código agrupador](https://solucionfactible.com/sfic/capitulos/contabilidad/contabilidad-catalogo-sat.jsp)
- [Polotab — facturación restaurantes CFDI 4.0](https://blog.polotab.com/facturacion-restaurantes-cfdi-4-0-mexico/)
- [Veinte — clave SAT 90101501 (restaurantes)](https://veinte.mx/catalogos/clave/90101501)
- [Veinte — clave SAT 90101500 (consumo de alimentos y bebidas)](https://veinte.mx/catalogos/clave/90101500)
- [SW Sapien — uso de CFDI 4.0](https://sw.com.mx/blog/cumplimiento-fiscal/catalogo-de-uso-de-cfdi-4.0-que-es-el-uso-de-cfdi-y-como-se-usa)
- [ChecaFactura — uso de CFDI tabla completa 2026](https://checafactura.com/blog/uso-cfdi-cual-elegir)
- [Ingeniería de Menú — catálogo de cuentas de un restaurante](https://ingenieriademenu.com/catalogo-de-cuentas-de-un-restaurante/)
- [Lavu MX — cuentas contables de un restaurante](https://www.lavu.com.mx/blog/contabilidad-para-restaurantes/)
- [Luis Manuel Rivera — catálogo de cuentas para restaurante (USALI)](https://luismanuelrivera.com/2021/09/05/catalogo-de-cuentas-para-restaurante/)
- [SimpleRestaurantAccounting — restaurant chart of accounts](https://simplerestaurantaccounting.com/chart-of-accounts-for-restaurants/)
- [USAR (8th ed., NRA) — Amazon listing](https://www.amazon.com/Uniform-System-Accounts-Restaurants-8th/dp/0133142876)
- [HFTP — USALI hub](https://usali.hftp.org/)
- [Aspel COI — software contable restaurantes](https://www.siigo.com/mx/software-contable-aspel-coi/restaurantes-gastrobar/)
- [Aspel COI — importar catálogo de cuentas](https://coiportaldeclientes.aspel.com.mx/importar-cuentas-al-catalogo-del-sistema/)
- [CONTPAQi — segmentos de negocio / centros de costo](https://integraconsorcio.com.mx/public/index.php/blog/articulo/Segmentos_de_Negocio_o_Centros_de_costo_en_CONTPAQi_Contabilidad)
- [Bind ERP — sitio oficial](https://bind.com.mx/)
- [Bind ERP — sucursales](https://www.tiendanube.com/mx/tienda-aplicaciones-nube/bind-erp)
- [Foodics Accounting — chart of accounts user guide](https://help.foodics.com/hc/en-us/articles/17229760824988-Chart-of-Accounts-Explanation-and-user-guide-for-Foodics-Accounting)
- [Foodics Accounting — product page](https://www.foodics.com/accounting/)
- [Parrot Software MX](https://parrotsoftware.com.mx/)
- [Parrot — POS todo-en-uno](https://parrotsoftware.com.mx/parrot-pos-todo-en-uno-para-restaurantes)
- [Contalink — centros de costo manual](https://tutoriales.contalink.com/es/articles/8589839-centros-de-costos)
