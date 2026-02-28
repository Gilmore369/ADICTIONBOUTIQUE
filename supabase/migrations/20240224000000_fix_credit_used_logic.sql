-- ============================================================================
-- Migration: Fix Credit Used Logic
-- ============================================================================
-- Problema: credit_used representa total histórico en lugar de deuda pendiente
-- Solución: Modificar funciones para que credit_used = deuda pendiente actual
-- ============================================================================

-- Función: recalculate_client_credit_used
-- Recalcula credit_used basándose en cuotas pendientes
CREATE OR REPLACE FUNCTION recalculate_client_credit_used(p_client_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_pending_debt DECIMAL;
BEGIN
  -- Calcular deuda pendiente: suma de (amount - paid_amount) de cuotas no pagadas
  SELECT COALESCE(SUM(i.amount - i.paid_amount), 0)
  INTO v_pending_debt
  FROM installments i
  INNER JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE cp.client_id = p_client_id
    AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE');
  
  -- Actualizar credit_used del cliente
  UPDATE clients
  SET credit_used = v_pending_debt,
      updated_at = NOW()
  WHERE id = p_client_id;
  
  RETURN v_pending_debt;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_client_credit_used IS 'Recalcula credit_used basándose en cuotas pendientes (PENDING, PARTIAL, OVERDUE)';

-- Trigger: Recalcular credit_used cuando se actualiza una cuota
-- Esto asegura que credit_used siempre refleje la deuda pendiente real
CREATE OR REPLACE FUNCTION trigger_recalculate_credit_used()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
BEGIN
  -- Obtener client_id desde credit_plans
  SELECT client_id INTO v_client_id
  FROM credit_plans
  WHERE id = COALESCE(NEW.plan_id, OLD.plan_id);
  
  -- Recalcular credit_used del cliente
  IF v_client_id IS NOT NULL THEN
    PERFORM recalculate_client_credit_used(v_client_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Crear trigger en installments para recalcular automáticamente
DROP TRIGGER IF EXISTS trigger_installment_update_credit_used ON installments;
CREATE TRIGGER trigger_installment_update_credit_used
AFTER INSERT OR UPDATE OR DELETE ON installments
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_credit_used();

COMMENT ON TRIGGER trigger_installment_update_credit_used ON installments IS 'Recalcula credit_used del cliente cuando se modifica una cuota';

-- Grant permissions
GRANT EXECUTE ON FUNCTION recalculate_client_credit_used TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_recalculate_credit_used TO authenticated;
