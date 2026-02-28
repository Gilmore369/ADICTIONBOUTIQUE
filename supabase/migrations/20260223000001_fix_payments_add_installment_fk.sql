-- ============================================================================
-- Migration: Fix payments table - Add installment_id and plan_id FKs
-- ============================================================================
-- Problema: payments solo tiene client_id y amount. No se puede saber a qué
-- cuota se aplicó un pago, rompiendo el tracking de cobranzas.
-- El índice idx_payments_installment_id ya existe pero la columna no.
-- ============================================================================

-- 1. Agregar installment_id (FK a cuota específica - uso directo simple)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS installment_id UUID REFERENCES installments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES credit_plans(id) ON DELETE SET NULL;

-- 2. Recrear índice correctamente (puede que ya exista desde la migración anterior)
DROP INDEX IF EXISTS idx_payments_installment_id;
CREATE INDEX IF NOT EXISTS idx_payments_installment_id ON payments(installment_id) WHERE installment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_plan_id ON payments(plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_client_date ON payments(client_id, payment_date DESC);

-- 3. Intentar inferir plan_id desde la relación con client_id (data repair best-effort)
-- Para pagos existentes sin plan_id, asociar al plan activo más reciente del cliente
UPDATE payments p
SET plan_id = (
  SELECT cp.id
  FROM credit_plans cp
  WHERE cp.client_id = p.client_id
    AND cp.status = 'ACTIVE'
  ORDER BY cp.created_at DESC
  LIMIT 1
)
WHERE p.plan_id IS NULL
  AND p.client_id IS NOT NULL;

-- 4. Comentarios
COMMENT ON COLUMN payments.installment_id IS 'Cuota específica a la que se aplica este pago (nullable para pagos globales)';
COMMENT ON COLUMN payments.plan_id IS 'Plan de crédito al que pertenece el pago';
