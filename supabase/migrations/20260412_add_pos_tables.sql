-- ─── Parrot POS Tables Migration ─────────────────────────────────────────────
-- Adds tables for synced POS data from Parrot POS.
-- All tables are scoped by tenant_id (no RLS; service role enforces isolation).

-- 1. Orders (header-level) ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pos_orders (
  uuid              text PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  store_uuid        text NOT NULL,
  created_at        timestamptz,
  finished_at       timestamptz,
  status            text,
  order_type        text,       -- "DINE_IN", "TAKE_OUT", etc.
  provider          text,       -- "PARROT", "RAPPI", "UBER_EATS", "DIDI_FOOD"
  total             numeric,
  total_discounts   numeric,
  total_taxes       numeric,
  customers_count   integer
);

-- 2. Order items (line-item level — v2 response shape) ────────────────────────

CREATE TABLE IF NOT EXISTS pos_order_items (
  uuid              text PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  order_uuid        text NOT NULL,
  store_uuid        text NOT NULL,
  created_at        timestamptz,
  item_name         text,
  sku               text,
  category_uuid     text,
  quantity          numeric,
  unit_price        numeric,
  total_price       numeric,
  discount          numeric,
  total             numeric,
  item_status       text,
  provider          text
);

-- 3. Cashier sessions (shift summaries) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS pos_cashier_sessions (
  uuid            text PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  store_uuid      text NOT NULL,
  session_number  text,
  state           text,
  started_at      timestamptz,
  finished_at     timestamptz,
  total_sales     numeric,
  raw_data        jsonb         -- full session blob; payment/provider breakdowns live here
);

-- 4. Sync audit log ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pos_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  synced_at       timestamptz DEFAULT now(),
  start_ts        timestamptz,
  end_ts          timestamptz,
  orders_synced   integer DEFAULT 0,
  items_synced    integer DEFAULT 0,
  sessions_synced integer DEFAULT 0,
  error           text
);

-- 5. Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS pos_orders_tenant_created    ON pos_orders (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS pos_orders_tenant_store      ON pos_orders (tenant_id, store_uuid);
CREATE INDEX IF NOT EXISTS pos_order_items_tenant_created ON pos_order_items (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS pos_order_items_order        ON pos_order_items (tenant_id, order_uuid);
CREATE INDEX IF NOT EXISTS pos_cashier_sessions_started ON pos_cashier_sessions (tenant_id, started_at);
