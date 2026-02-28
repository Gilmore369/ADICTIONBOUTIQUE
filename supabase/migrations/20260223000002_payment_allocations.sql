-- ============================================================================
-- Migration: Payment Allocations Table
-- ============================================================================
-- Permite que un pago se distribuya entre múltiples cuotas (relación N:M).
-- Usa el algoritmo "oldest-due-first" que ya existe en el frontend.
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_allocations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id    UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  installment_id UUID NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  amount_applied DECIMAL(10,2) NOT NULL CHECK (amount_applied > 0),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (payment_id, installment_id)
);

CREATE INDEX IF NOT EXISTS idx_palloc_payment_id    ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_palloc_installment_id ON payment_allocations(installment_id);

COMMENT ON TABLE payment_allocations IS
  'Distribución de un pago entre una o más cuotas (N:M). Un pago puede cubrir varias cuotas y una cuota puede recibir pagos parciales.';

-- ============================================================================
-- Función: apply_payment_to_installments
-- ============================================================================
-- Aplica un monto a cuotas usando oldest-due-first.
-- Llama a esta función DESPUÉS de insertar en payments.
-- ============================================================================
CREATE OR REPLACE FUNCTION apply_payment_to_installments(
  p_payment_id  UUID,
  p_client_id   UUID,
  p_amount      DECIMAL
) RETURNS VOID AS $$
DECLARE
  v_remaining   DECIMAL := p_amount;
  v_inst        RECORD;
  v_to_apply    DECIMAL;
BEGIN
  -- Iterar cuotas pendientes ordenadas: vencidas primero, luego por fecha
  FOR v_inst IN
    SELECT i.id, i.amount, i.paid_amount, i.status, i.due_date
    FROM installments i
    JOIN credit_plans cp ON i.plan_id = cp.id
    WHERE cp.client_id = p_client_id
      AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
    ORDER BY
      CASE WHEN i.due_date < CURRENT_DATE THEN 0 ELSE 1 END,
      i.due_date ASC
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_to_apply := LEAST(v_remaining, v_inst.amount - v_inst.paid_amount);

    -- Registrar allocation
    INSERT INTO payment_allocations (payment_id, installment_id, amount_applied)
    VALUES (p_payment_id, v_inst.id, v_to_apply)
    ON CONFLICT (payment_id, installment_id) DO UPDATE
      SET amount_applied = payment_allocations.amount_applied + v_to_apply;

    -- Actualizar cuota (el trigger recalculate_client_credit_used se dispara aquí)
    UPDATE installments
    SET
      paid_amount = paid_amount + v_to_apply,
      status = CASE
        WHEN paid_amount + v_to_apply >= amount THEN 'PAID'
        ELSE 'PARTIAL'
      END,
      paid_at = CASE WHEN paid_amount + v_to_apply >= amount THEN NOW() ELSE paid_at END
    WHERE id = v_inst.id;

    v_remaining := v_remaining - v_to_apply;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION apply_payment_to_installments TO authenticated;

COMMENT ON FUNCTION apply_payment_to_installments IS
  'Distribuye un pago entre cuotas pendientes usando oldest-due-first. Crea registros en payment_allocations y actualiza installments.';
