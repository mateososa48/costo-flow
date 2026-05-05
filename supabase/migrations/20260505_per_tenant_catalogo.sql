-- ADDITIVE ONLY. Never drops or renames existing columns.

-- 1. P&L account buckets per tenant
CREATE TABLE IF NOT EXISTS tenant_cuenta_pnl (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label       text NOT NULL,
  cost_type   text NOT NULL CHECK (cost_type IN ('food', 'beverage', 'operational')),
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, label)
);

-- 2. Line-item / invoice-level categories per tenant
CREATE TABLE IF NOT EXISTS tenant_concepts (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label           text NOT NULL,
  cuenta_pnl_id   uuid NOT NULL REFERENCES tenant_cuenta_pnl(id) ON DELETE RESTRICT,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, label)
);

-- 3. Nullable FK columns on line_items (old rows stay NULL — old app unaffected)
ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS concept_id      uuid REFERENCES tenant_concepts(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cuenta_pnl_id   uuid REFERENCES tenant_cuenta_pnl(id) ON DELETE SET NULL;

-- 4. Nullable FK column on invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS cuenta_pnl_id   uuid REFERENCES tenant_cuenta_pnl(id) ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_cuenta_pnl_tenant   ON tenant_cuenta_pnl(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_concepts_tenant      ON tenant_concepts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_concepts_cuenta_pnl ON tenant_concepts(cuenta_pnl_id);
CREATE INDEX IF NOT EXISTS idx_line_items_concept          ON line_items(concept_id);
CREATE INDEX IF NOT EXISTS idx_line_items_cuenta_pnl       ON line_items(cuenta_pnl_id);
CREATE INDEX IF NOT EXISTS idx_invoices_cuenta_pnl         ON invoices(cuenta_pnl_id);
