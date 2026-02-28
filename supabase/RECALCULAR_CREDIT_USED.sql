-- ============================================================================
-- RECALCULAR CREDIT_USED PARA TODOS LOS CLIENTES
-- ============================================================================
-- Problema: credit_used muestra el total histórico de compras a crédito
--           en lugar de la deuda pendiente actual
-- 
-- Solución: Recalcular credit_used basándose en cuotas pendientes:
--           credit_used = SUM(installments.amount - installments.paid_amount)
--           WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE')
-- ============================================================================

DO $$
DECLARE
  client_record RECORD;
  pending_debt DECIMAL;
  total_clients INTEGER := 0;
  updated_clients INTEGER := 0;
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'INICIANDO RECÁLCULO DE CREDIT_USED';
  RAISE NOTICE '============================================================';
  
  -- Contar total de clientes
  SELECT COUNT(*) INTO total_clients FROM clients;
  RAISE NOTICE 'Total de clientes: %', total_clients;
  RAISE NOTICE '';
  
  -- Iterar sobre cada cliente
  FOR client_record IN 
    SELECT id, name, credit_limit, credit_used FROM clients
  LOOP
    -- Calcular deuda pendiente real
    SELECT COALESCE(SUM(i.amount - i.paid_amount), 0)
    INTO pending_debt
    FROM installments i
    INNER JOIN credit_plans cp ON i.plan_id = cp.id
    WHERE cp.client_id = client_record.id
      AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE');
    
    -- Actualizar credit_used con la deuda pendiente real
    UPDATE clients
    SET credit_used = pending_debt,
        updated_at = NOW()
    WHERE id = client_record.id;
    
    updated_clients := updated_clients + 1;
    
    -- Mostrar cambios significativos
    IF ABS(client_record.credit_used - pending_debt) > 100 THEN
      RAISE NOTICE 'Cliente: % | Antes: S/ % | Después: S/ % | Diferencia: S/ %',
        client_record.name,
        ROUND(client_record.credit_used, 2),
        ROUND(pending_debt, 2),
        ROUND(client_record.credit_used - pending_debt, 2);
    END IF;
    
    -- Mostrar progreso cada 10 clientes
    IF updated_clients % 10 = 0 THEN
      RAISE NOTICE 'Procesados % de % clientes...', updated_clients, total_clients;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'RECÁLCULO COMPLETADO: % clientes actualizados', updated_clients;
  RAISE NOTICE '============================================================';
END $$;

-- ============================================================================
-- VERIFICAR RESULTADOS
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '============================================================';
RAISE NOTICE 'TOP 10 CLIENTES CON MAYOR DEUDA PENDIENTE';
RAISE NOTICE '============================================================';

SELECT 
  c.name AS "Cliente",
  c.credit_limit AS "Límite",
  c.credit_used AS "Deuda Pendiente",
  c.credit_limit - c.credit_used AS "Crédito Disponible",
  ROUND((c.credit_used / NULLIF(c.credit_limit, 0)) * 100, 1) AS "Utilización %"
FROM clients c
WHERE c.credit_limit > 0
ORDER BY c.credit_used DESC
LIMIT 10;

-- ============================================================================
-- ESTADÍSTICAS GENERALES
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '============================================================';
RAISE NOTICE 'ESTADÍSTICAS GENERALES';
RAISE NOTICE '============================================================';

SELECT 
  COUNT(*) AS "Total Clientes",
  COUNT(*) FILTER (WHERE credit_used > 0) AS "Clientes con Deuda",
  SUM(credit_limit) AS "Límite Total",
  SUM(credit_used) AS "Deuda Pendiente Total",
  SUM(credit_limit - credit_used) AS "Crédito Disponible Total",
  ROUND(AVG((credit_used / NULLIF(credit_limit, 0)) * 100), 1) AS "Utilización Promedio %"
FROM clients
WHERE credit_limit > 0;

