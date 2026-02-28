-- ============================================================================
-- FIX CREDIT_USED CALCULATION
-- ============================================================================
-- Problema: credit_used actualmente representa el total histórico de crédito usado
-- Solución: credit_used debe representar solo la DEUDA PENDIENTE (lo que el cliente aún debe)
--
-- Este script recalcula credit_used para todos los clientes basándose en:
-- credit_used = SUM(installments.amount - installments.paid_amount) 
-- WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE')
-- ============================================================================

-- Paso 1: Crear función para recalcular credit_used de un cliente
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

-- Paso 2: Recalcular credit_used para TODOS los clientes
DO $$
DECLARE
  client_record RECORD;
  total_clients INTEGER := 0;
  updated_clients INTEGER := 0;
BEGIN
  -- Contar total de clientes
  SELECT COUNT(*) INTO total_clients FROM clients;
  
  RAISE NOTICE 'Iniciando recálculo de credit_used para % clientes...', total_clients;
  
  -- Iterar sobre cada cliente
  FOR client_record IN 
    SELECT id, name FROM clients
  LOOP
    -- Recalcular credit_used
    PERFORM recalculate_client_credit_used(client_record.id);
    updated_clients := updated_clients + 1;
    
    -- Log cada 10 clientes
    IF updated_clients % 10 = 0 THEN
      RAISE NOTICE 'Procesados % de % clientes...', updated_clients, total_clients;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Recálculo completado: % clientes actualizados', updated_clients;
END $$;

-- Paso 3: Verificar resultados
SELECT 
  c.id,
  c.name,
  c.credit_limit,
  c.credit_used AS credit_used_actual,
  COALESCE(SUM(i.amount - i.paid_amount), 0) AS deuda_pendiente_calculada,
  c.credit_limit - c.credit_used AS credito_disponible
FROM clients c
LEFT JOIN credit_plans cp ON cp.client_id = c.id
LEFT JOIN installments i ON i.plan_id = cp.id AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
GROUP BY c.id, c.name, c.credit_limit, c.credit_used
ORDER BY c.credit_used DESC
LIMIT 20;

-- Paso 4: Estadísticas generales
SELECT 
  COUNT(*) AS total_clientes,
  SUM(credit_limit) AS limite_total,
  SUM(credit_used) AS deuda_pendiente_total,
  SUM(credit_limit - credit_used) AS credito_disponible_total,
  AVG((credit_used / NULLIF(credit_limit, 0)) * 100) AS utilizacion_promedio_pct
FROM clients
WHERE credit_limit > 0;

COMMENT ON FUNCTION recalculate_client_credit_used IS 'Recalcula credit_used basándose en cuotas pendientes (PENDING, PARTIAL, OVERDUE)';
