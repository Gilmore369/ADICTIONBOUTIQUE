-- ============================================================
-- Audit Logs Table
-- Captures all CREATE, UPDATE, DELETE operations on key entities
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action       VARCHAR(20) NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE')),
  entity_type  VARCHAR(50) NOT NULL,  -- 'product', 'client', 'user', 'catalog', 'stock', etc.
  entity_id    TEXT,
  entity_name  TEXT,
  detail       TEXT,
  store        TEXT,
  old_values   JSONB,
  new_values   JSONB
);

-- Index for fast filtering by date, user, entity type
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs (entity_type);

-- RLS: only admins can read, service role can insert
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_admin_read" ON audit_logs;
CREATE POLICY "audit_logs_admin_read" ON audit_logs
  FOR SELECT
  USING (public.has_role('admin'));

DROP POLICY IF EXISTS "audit_logs_service_insert" ON audit_logs;
CREATE POLICY "audit_logs_service_insert" ON audit_logs
  FOR INSERT
  WITH CHECK (true);  -- inserts done server-side with service role (bypasses RLS anyway)
