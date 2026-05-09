-- ============================================================================
-- LEGACY DEBT IMPORT — Columnas de trazabilidad
-- ============================================================================
-- Permite importar deudas históricas desde otro sistema y darles seguimiento
-- desde este. Las deudas/clientes/pagos importados quedan marcados con
-- imported_from_legacy=true para auditoría y filtrado.
--
-- Ejecutar en Supabase Dashboard → SQL Editor.
-- Es seguro re-ejecutar (IF NOT EXISTS).
-- ============================================================================

-- ── clients ────────────────────────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS imported_from_legacy BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legacy_source TEXT,            -- e.g. 'Sistema Anterior', 'Hoja Excel 2024'
  ADD COLUMN IF NOT EXISTS legacy_imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legacy_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_legacy ON clients(imported_from_legacy)
  WHERE imported_from_legacy = TRUE;

-- ── credit_plans ───────────────────────────────────────────────────────────
ALTER TABLE credit_plans
  ADD COLUMN IF NOT EXISTS imported_from_legacy BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legacy_source TEXT,
  ADD COLUMN IF NOT EXISTS legacy_purchase_description TEXT, -- "qué compró" en texto libre
  ADD COLUMN IF NOT EXISTS legacy_purchase_date DATE,        -- fecha original de la compra
  ADD COLUMN IF NOT EXISTS legacy_original_total DECIMAL(10,2), -- monto original (antes de pagos parciales)
  ADD COLUMN IF NOT EXISTS legacy_imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legacy_imported_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS legacy_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_credit_plans_legacy ON credit_plans(imported_from_legacy)
  WHERE imported_from_legacy = TRUE;

-- ── payments ──────────────────────────────────────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS imported_from_legacy BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legacy_source TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_legacy ON payments(imported_from_legacy)
  WHERE imported_from_legacy = TRUE;

-- ── legacy_import_batches — auditoría de lotes ─────────────────────────────
-- Cada vez que se importa un lote (manual/Excel) se crea un registro aquí
-- para poder revertir o auditar. Si el cliente quiere borrar TODO lo importado
-- en un lote específico, puede hacerlo via batch_id.
CREATE TABLE IF NOT EXISTS legacy_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imported_by UUID REFERENCES users(id),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  source_label TEXT,                                  -- ej. "Excel mayo 2026", "Manual sesión 1"
  source_filename TEXT,                               -- nombre original del archivo subido
  total_rows INTEGER NOT NULL DEFAULT 0,
  successful_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  total_debt_amount DECIMAL(12,2) NOT NULL DEFAULT 0, -- suma de saldos importados
  notes TEXT,
  raw_payload JSONB                                   -- snapshot del input (para debugging/rollback)
);

-- Vincular credit_plans y payments al batch para trazabilidad
ALTER TABLE credit_plans
  ADD COLUMN IF NOT EXISTS legacy_batch_id UUID REFERENCES legacy_import_batches(id) ON DELETE SET NULL;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS legacy_batch_id UUID REFERENCES legacy_import_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credit_plans_legacy_batch ON credit_plans(legacy_batch_id)
  WHERE legacy_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_legacy_batch ON payments(legacy_batch_id)
  WHERE legacy_batch_id IS NOT NULL;

-- RLS — solo admin puede leer/escribir batches
ALTER TABLE legacy_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legacy_batches_admin_all" ON legacy_import_batches;
CREATE POLICY "legacy_batches_admin_all" ON legacy_import_batches
  FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

-- ── Comentarios para documentación ─────────────────────────────────────────
COMMENT ON COLUMN clients.imported_from_legacy IS 'TRUE si el cliente fue creado por importación masiva desde otro sistema.';
COMMENT ON COLUMN credit_plans.imported_from_legacy IS 'TRUE si la deuda viene de un sistema externo (no se generó por una venta en este sistema).';
COMMENT ON COLUMN credit_plans.legacy_purchase_description IS 'Texto libre que describe qué compró el cliente en el sistema anterior.';
COMMENT ON COLUMN credit_plans.legacy_original_total IS 'Monto total ORIGINAL de la deuda (incluyendo pagos parciales ya realizados antes de la importación).';
COMMENT ON TABLE legacy_import_batches IS 'Registro de lotes de importación masiva. Permite trazabilidad y rollback.';
