-- Add tenant scoping to ingredients table.
-- Existing rows (Aventura Gourmet data) get tenant_id = NULL and will no
-- longer be visible to any tenant, effectively isolating them.

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ingredients_tenant_id
  ON ingredients (tenant_id);
