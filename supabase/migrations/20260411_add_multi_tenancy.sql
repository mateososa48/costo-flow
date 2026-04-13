-- ─── Multi-Tenancy Migration ────────────────────────────────────────────────
-- Adds tenants + restaurants tables and scopes all data tables by tenant_id.
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT).

-- 1. New tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug      text UNIQUE NOT NULL,
  name      text NOT NULL,
  -- Per-tenant config: { adminNames, sharedPasswordHash, sheetRegistry }
  settings  jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS restaurants (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug      text NOT NULL,
  label     text NOT NULL,
  UNIQUE (tenant_id, slug)
);

-- 2. Ensure audit_log table exists (app writes to it lazily; may not have been created yet) ──

CREATE TABLE IF NOT EXISTS audit_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action           text NOT NULL,
  user_name        text NOT NULL,
  tenant_id        uuid REFERENCES tenants(id),
  restaurant       text NOT NULL,
  supplier         text NOT NULL,
  invoice_id       text NOT NULL,
  invoice_number   text,
  invoice_date     text,
  total            numeric NOT NULL DEFAULT 0,
  spreadsheet_url  text,
  details          jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 3. Add tenant_id to existing data tables (nullable first) ──────────────────

ALTER TABLE invoices     ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE line_items   ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE audit_log    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

-- 4. Seed Aventura Gourmet tenant ────────────────────────────────────────────
-- settings will be populated from env vars by the app on first login.

INSERT INTO tenants (id, slug, name, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'aventura_gourmet',
  'Aventura Gourmet',
  '{}'
)
ON CONFLICT (slug) DO NOTHING;

-- 5. Seed restaurants ─────────────────────────────────────────────────────────

INSERT INTO restaurants (tenant_id, slug, label) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'motin_juarez', 'Motín Juárez'),
  ('a0000000-0000-0000-0000-000000000001', 'motin_roma',   'Motín Roma'),
  ('a0000000-0000-0000-0000-000000000001', 'queseria',     'Quesería')
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 6. Backfill existing rows → Aventura Gourmet ────────────────────────────────

UPDATE invoices     SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE line_items   SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE audit_log    SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE app_settings SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- 7. Make tenant_id NOT NULL ───────────────────────────────────────────────────

ALTER TABLE invoices     ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE line_items   ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audit_log    ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE app_settings ALTER COLUMN tenant_id SET NOT NULL;

-- 8. Update app_settings unique key: (key) → (tenant_id, key) ─────────────────
-- Drop the old single-column key constraint (may be named differently depending on setup).

DO $$
BEGIN
  -- Drop primary key if app_settings uses key as PK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'app_settings' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE app_settings DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'app_settings' AND constraint_type = 'PRIMARY KEY'
      LIMIT 1
    );
  END IF;

  -- Drop any unique constraint on key alone
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'app_settings'
      AND tc.constraint_type = 'UNIQUE'
      AND ccu.column_name = 'key'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE app_settings DROP CONSTRAINT ' || tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'app_settings'
        AND tc.constraint_type = 'UNIQUE'
        AND ccu.column_name = 'key'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_tenant_key UNIQUE (tenant_id, key);

-- Re-add key as a regular non-unique column (it was likely the PK before)
-- If it's still needed as an identity, keep it; otherwise this is fine.

-- 9. Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invoices_tenant     ON invoices   (tenant_id);
CREATE INDEX IF NOT EXISTS idx_line_items_tenant   ON line_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant    ON audit_log  (tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_tenant ON app_settings (tenant_id, key);
