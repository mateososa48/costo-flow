-- Adds tenant_users table linking Supabase Auth users to tenants.
-- Auth is now managed by Supabase Auth (Google OAuth), not by adminNames/sharedPasswordHash in tenants.settings.

CREATE TABLE IF NOT EXISTS tenant_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,           -- matches auth.users.id from Supabase Auth
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'readonly')),
  email      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id   ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
