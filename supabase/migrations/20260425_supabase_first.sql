-- Phase 1: Supabase-first architecture
-- Invoices become the primary record; Google Sheets is an optional export add-on.

-- Track sheet sync state per invoice
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sheet_sync_status text
    CHECK (sheet_sync_status IN ('pending','synced','failed','skipped'))
    DEFAULT 'skipped',
  ADD COLUMN IF NOT EXISTS sheet_sync_error text,
  ADD COLUMN IF NOT EXISTS sheet_synced_at timestamptz;

-- Line items idempotency via position within invoice
ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS line_index integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'line_items_idempotent') THEN
    ALTER TABLE line_items
      ADD CONSTRAINT line_items_idempotent
      UNIQUE (tenant_id, invoice_id, line_index);
  END IF;
END$$;

-- Performance indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_date
  ON invoices (tenant_id, invoice_date);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_sheet_sync
  ON invoices (tenant_id, sheet_sync_status)
  WHERE sheet_sync_status IN ('failed', 'pending');

CREATE INDEX IF NOT EXISTS idx_line_items_tenant_invoice
  ON line_items (tenant_id, invoice_id);

CREATE INDEX IF NOT EXISTS idx_line_items_tenant_date
  ON line_items (tenant_id, invoice_date);
