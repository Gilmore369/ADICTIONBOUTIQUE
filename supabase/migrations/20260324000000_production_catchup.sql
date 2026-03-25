-- ============================================================================
-- MIGRATION: Production Catch-up
-- Description: Applies all schema changes that may be missing in production.
--              All statements use IF NOT EXISTS / DROP IF EXISTS to be idempotent.
-- Date: 2026-03-24
-- ============================================================================

-- ============================================================================
-- 1. PAYMENTS TABLE — add installment_id and plan_id columns
--    (from migration 20260223000001 — may not have been applied)
-- ============================================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS installment_id UUID REFERENCES installments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_id        UUID REFERENCES credit_plans(id)  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_installment_id
  ON payments(installment_id) WHERE installment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_plan_id
  ON payments(plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_client_date
  ON payments(client_id, payment_date DESC);

-- ============================================================================
-- 2. PAYMENT_ALLOCATIONS TABLE — one row per installment per payment
--    (from migration 20260223000002 — may not have been applied)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_allocations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id     UUID NOT NULL REFERENCES payments(id)     ON DELETE CASCADE,
  installment_id UUID NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  amount_applied DECIMAL(10,2) NOT NULL CHECK (amount_applied > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id
  ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_installment_id
  ON payment_allocations(installment_id);

-- Enable RLS
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_payment_allocations"  ON payment_allocations;
DROP POLICY IF EXISTS "authenticated_write_payment_allocations" ON payment_allocations;
CREATE POLICY "authenticated_read_payment_allocations"  ON payment_allocations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write_payment_allocations" ON payment_allocations
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- 3. COLLECTION_ACTIONS — update CHECK constraints
--    (from migration 20260224000003 — may not have been applied)
-- ============================================================================

-- action_type constraint
ALTER TABLE collection_actions
  DROP CONSTRAINT IF EXISTS collection_actions_action_type_check;
ALTER TABLE collection_actions
  ADD CONSTRAINT collection_actions_action_type_check
  CHECK (action_type IN (
    'LLAMADA',
    'VISITA',
    'WHATSAPP',
    'MENSAJE_SMS',
    'EMAIL',
    'MOTORIZADO',
    'CARTA_NOTARIAL',
    'OTRO'
  ));

-- result constraint (includes current + all legacy values)
ALTER TABLE collection_actions
  DROP CONSTRAINT IF EXISTS collection_actions_result_check;
ALTER TABLE collection_actions
  ADD CONSTRAINT collection_actions_result_check
  CHECK (result IN (
    -- Current form values
    'COMPROMISO_PAGO',
    'PROMETE_PAGAR_FECHA',
    'PAGO_REALIZADO',
    'PAGO_PARCIAL',
    'CLIENTE_COLABORADOR',
    'SOLICITA_REFINANCIAMIENTO',
    'SOLICITA_DESCUENTO',
    'SE_NIEGA_PAGAR',
    'NO_CONTESTA',
    'TELEFONO_INVALIDO',
    'CLIENTE_MOLESTO',
    'DOMICILIO_INCORRECTO',
    'CLIENTE_NO_UBICADO',
    'OTRO',
    -- Legacy values from initial schema
    'PROMESA_PAGO',
    'SIN_INTENCION',
    'NO_RESPONDE',
    'PAGO',
    'REPROGRAMADO',
    -- Legacy values from previous migrations
    'NUMERO_EQUIVOCADO',
    'SOLICITA_REFINANCIACION',
    'SOLICITA_PLAZO',
    'PROBLEMAS_ECONOMICOS',
    'RECLAMO_PRODUCTO',
    'CLIENTE_FALLECIDO',
    'CLIENTE_VIAJO',
    'DERIVADO_LEGAL'
  ));

-- ============================================================================
-- 4. CLIENTS TABLE — add missing columns
--    (from migrations 20260304000001, 20260306000001 — may not be applied)
-- ============================================================================

-- referred_by (from 20260304000001)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_referred_by
  ON clients(referred_by) WHERE referred_by IS NOT NULL;

-- blacklist fields (from 20260306000001)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS blacklisted        BOOLEAN    DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS blacklisted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blacklisted_reason TEXT,
  ADD COLUMN IF NOT EXISTS blacklisted_by     UUID REFERENCES users(id) ON DELETE SET NULL;

-- rating field (may already exist, ADD COLUMN IF NOT EXISTS is safe)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS rating VARCHAR(1) CHECK (rating IN ('A','B','C','D','E'));

-- credit_limit constraint fix (from 20260306000002)
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_credit_limit_check;
ALTER TABLE clients
  ADD CONSTRAINT clients_credit_limit_check CHECK (credit_limit >= 0);

-- ============================================================================
-- 5. RECALCULATE_CLIENT_CREDIT_USED RPC
--    Drop first to allow changing signature/return type
-- ============================================================================

DROP FUNCTION IF EXISTS recalculate_client_credit_used(UUID);

CREATE OR REPLACE FUNCTION recalculate_client_credit_used(p_client_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_used DECIMAL(10,2);
BEGIN
  -- Sum all PENDING/PARTIAL/OVERDUE installment remaining amounts
  SELECT COALESCE(SUM(amount - paid_amount), 0)
  INTO v_total_used
  FROM installments i
  JOIN credit_plans cp ON cp.id = i.plan_id
  WHERE cp.client_id = p_client_id
    AND cp.status = 'ACTIVE'
    AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE');

  UPDATE clients
  SET credit_used = v_total_used
  WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. RETURNS TABLE — create if not exists
--    (from migration 20260307000000 — may not have been applied)
-- ============================================================================

CREATE TABLE IF NOT EXISTS returns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id           UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  sale_number       VARCHAR(20) NOT NULL,
  client_id         UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name       VARCHAR(255),
  store_id          VARCHAR(50) NOT NULL,
  return_number     VARCHAR(20) UNIQUE NOT NULL,
  return_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason            TEXT NOT NULL,
  reason_type       VARCHAR(50) NOT NULL CHECK (reason_type IN (
    'DEFECTO_PRODUCTO','TALLA_INCORRECTA','COLOR_DIFERENTE','NO_SATISFECHO','CAMBIO_OPINION','OTRO'
  )),
  return_type       VARCHAR(20) NOT NULL CHECK (return_type IN ('REEMBOLSO','CAMBIO')),
  total_amount      DECIMAL(10,2) NOT NULL,
  refund_amount     DECIMAL(10,2) DEFAULT 0,
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN (
    'PENDIENTE','APROBADA','RECHAZADA','COMPLETADA'
  )),
  extension_requested BOOLEAN DEFAULT FALSE,
  extension_granted   BOOLEAN DEFAULT FALSE,
  extension_date      TIMESTAMPTZ,
  extension_reason    TEXT,
  returned_items    JSONB NOT NULL DEFAULT '[]'::jsonb,
  exchange_items    JSONB DEFAULT '[]'::jsonb,
  notes             TEXT,
  admin_notes       TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_sale_id      ON returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_client_id    ON returns(client_id);
CREATE INDEX IF NOT EXISTS idx_returns_store_id     ON returns(store_id);
CREATE INDEX IF NOT EXISTS idx_returns_return_number ON returns(return_number);
CREATE INDEX IF NOT EXISTS idx_returns_return_date  ON returns(return_date DESC);
CREATE INDEX IF NOT EXISTS idx_returns_status       ON returns(status);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view returns"   ON returns;
DROP POLICY IF EXISTS "Authenticated users can create returns" ON returns;
DROP POLICY IF EXISTS "Authenticated users can update returns" ON returns;

CREATE POLICY "Authenticated users can view returns"   ON returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create returns" ON returns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update returns" ON returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Function to generate DEV-XXXX return numbers
CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS VARCHAR(20) AS $$
DECLARE
  v_next  INTEGER;
  v_num   VARCHAR(20);
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 5) AS INTEGER)), 0) + 1
  INTO v_next
  FROM returns
  WHERE return_number LIKE 'DEV-%';

  v_num := 'DEV-' || LPAD(v_next::TEXT, 4, '0');
  RETURN v_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. BASE_CODE COLUMN ON PRODUCTS
--    (from migration 20260224000002 — may not have been applied)
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS base_code VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_products_base_code
  ON products(base_code) WHERE base_code IS NOT NULL;

-- Auto-populate base_code from barcode if missing (strip last -SEGMENT)
UPDATE products
SET base_code = REGEXP_REPLACE(barcode, '-[^-]+$', '')
WHERE base_code IS NULL AND barcode IS NOT NULL AND barcode LIKE '%-%';

-- ============================================================================
-- DONE
-- ============================================================================

COMMENT ON TABLE payment_allocations IS
  'Detalle de cómo se aplica cada pago a cuotas específicas (algoritmo oldest-due-first)';
