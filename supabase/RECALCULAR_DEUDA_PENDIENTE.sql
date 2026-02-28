-- ============================================================================
-- RECALCULAR DEUDA PENDIENTE (credit_used)
-- ============================================================================
-- Este script recalcula el campo credit_used para que refleje solo la DEUDA
-- PENDIENTE actual, no el total histórico de compras.
--
-- credit_used = SUM de (amount - paid_amount) de cuotas con estado:
-- - PENDING (pendiente)
-- - PARTIAL (parcialmente pagada)
-- - OVERDUE (vencida)
--
-- Las cuotas PAID (pagadas completamente) NO se cuentan.
-- ============================================================================

-- Recalcular credit_used para TODOS los clientes
DO $$
DECLARE
  client_record RECORD;
  v_pending_debt DECIMAL;
  total_clients INTEGER := 0;
  updated_clients INTEGER := 0;
BEGIN
  -- Contar total de clientes
  SELECT COUNT(*) INTO total_clients FROM clients;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Iniciando recálculo de deuda pendiente...';
  RAISE NOTICE 'Total de clientes: %', total_clients;
  RAISE NOTICE '==============================================';
  
  -- Iterar sobre cada cliente
  FOR client_record IN 
    SELECT id, name, credit_used FROM clients ORDER BY name
  LOOP
    -- Calcular deuda pendiente real
    SELECT COALESCE(SUM(i.amount - i.paid_amount), 0)
    INTO v_pending_debt
    FROM installments i
    INNER JOIN credit_plans cp ON i.plan_id = cp.id
    WHERE cp.client_id = client_record.id
      AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE');
    
    -- Actualizar credit_used del cliente
    UPDATE clients
    SET credit_used = v_pending_debt,
        updated_at = NOW()
    WHERE id = client_record.id;
    
    updated_clients := updated_clients + 1;
    
    -- Log de cambios significativos
    IF client_record.credit_used != v_pending_debt THEN
      RAISE NOTICE 'Cliente: % | Antes: S/ % | Ahora: S/ %', 
        client_record.name, 
        client_record.credit_used, 
        v_pending_debt;
    END IF;
    
    -- Progreso cada 10 clientes
    IF updated_clients % 10 = 0 THEN
      RAISE NOTICE 'Progreso: % de % clientes procesados...', updated_clients, total_clients;
    END IF;
  END LOOP;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Recálculo completado: % clientes actualizados', updated_clients;
  RAISE NOTICE '==============================================';
END $$;

-- Verificar resultados - Top 10 clientes con mayor deuda
SELECT 
  c.name AS cliente,
  c.credit_limit AS limite_credito,
  c.credit_used AS deuda_pendiente,
  c.credit_limit - c.credit_used AS credito_disponible,
  ROUND((c.credit_used / NULLIF(c.credit_limit, 0) * 100)::numeric, 2) AS utilizacion_pct,
  COUNT(i.id) AS cuotas_pendientes
FROM clients c
LEFT JOIN credit_plans cp ON cp.client_id = c.id
LEFT JOIN installments i ON i.plan_id = cp.id AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
WHERE c.credit_limit > 0
GROUP BY c.id, c.name, c.credit_limit, c.credit_used
ORDER BY c.credit_used DESC
LIMIT 10;

-- Estadísticas generales
SELECT 
  COUNT(*) AS total_clientes,
  COUNT(CASE WHEN credit_used > 0 THEN 1 END) AS clientes_con_deuda,
  COUNT(CASE WHEN credit_used = 0 THEN 1 END) AS clientes_sin_deuda,
  ROUND(SUM(credit_limit)::numeric, 2) AS limite_total,
  ROUND(SUM(credit_used)::numeric, 2) AS deuda_pendiente_total,
  ROUND(SUM(credit_limit - credit_used)::numeric, 2) AS credito_disponible_total,
  ROUND(AVG((credit_used / NULLIF(credit_limit, 0)) * 100)::numeric, 2) AS utilizacion_promedio_pct
FROM clients
WHERE credit_limit > 0;
