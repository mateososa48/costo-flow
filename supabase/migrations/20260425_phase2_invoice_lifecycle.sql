-- Phase 2: Invoice lifecycle — soft delete + edit history

-- Soft delete support for invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_by text;

-- comments column (may not exist on older rows created via submit route)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS comments text;

-- Line items also get deleted_at so aggregation queries can filter easily
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Edit history log
CREATE TABLE IF NOT EXISTS invoice_edits (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id text        REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id  uuid        REFERENCES tenants(id),
  edited_by  text        NOT NULL,
  edited_at  timestamptz NOT NULL DEFAULT now(),
  changes    jsonb       NOT NULL  -- { fieldName: { from: oldVal, to: newVal }, ... }
);

CREATE INDEX IF NOT EXISTS idx_invoice_edits_invoice ON invoice_edits (invoice_id, edited_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_edits_tenant  ON invoice_edits (tenant_id, edited_at DESC);

-- Partial indexes so active-record queries stay fast
CREATE INDEX IF NOT EXISTS idx_invoices_active_tenant
  ON invoices (tenant_id, invoice_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_line_items_active_tenant
  ON line_items (tenant_id, invoice_date)
  WHERE deleted_at IS NULL;
