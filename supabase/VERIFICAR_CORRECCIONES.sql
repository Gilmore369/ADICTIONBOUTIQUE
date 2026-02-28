-- ============================================================================
-- SCRIPT DE VERIFICACIÓN DE CORRECCIONES
-- ============================================================================
-- Este script verifica que todas las correcciones se aplicaron correctamente
-- ============================================================================

\echo '============================================================================'
\echo 'VERIFICACIÓN DE CORRECCIONES DEL SISTEMA'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- 1. VERIFICAR FUNCIONES CREADAS
-- ============================================================================
\echo '1. Verificando funciones creadas...'
\echo ''

SELECT 
  proname AS nombre_funcion,
  pg_get_function_arguments(oid) AS argumentos,
  CASE 
    WHEN proname = 'recalculate_client_credit_used' THEN '✓'
    ELSE '?'
  END AS estado
FROM pg_proc
WHERE proname IN ('recalculate_client_credit_used', 'trigger_recalculate_credit_used')
ORDER BY proname;

\echo ''

-- ============================================================================
-- 2. VERIFICAR TRIGGERS CREADOS
-- ============================================================================
\echo '2. Verificando triggers creados...'
\echo ''

SELECT 
  tgname AS nombre_trigger,
  tgrelid::regclass AS tabla,
  CASE 
    WHEN tgname = 'trigger_installment_update_credit_used' THEN '✓'
    ELSE '?'
  END AS estado
FROM pg_trigger
WHERE tgname = 'trigger_installment_update_credit_used';

\echo ''

-- ============================================================================
-- 3. VERIFICAR CONSISTENCIA DE CREDIT_USED
-- ============================================================================
\echo '3. Verificando consistencia de credit_used...'
\echo ''

WITH client_debt AS (
  SELECT 
    c.id,
    c.name,
    c.credit_limit,
    c.credit_used AS credit_used_actual,
    COALESCE(SUM(i.amount - i.paid_amount), 0) AS deuda_calculada,
    ABS(c.credit_used - COALESCE(SUM(i.amount - i.paid_amount), 0)) AS diferencia
  FROM clients c
  LEFT JOIN credit_plans cp ON cp.client_id = c.id
  LEFT JOIN installments i ON i.plan_id = cp.id 
    AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
  GROUP BY c.id, c.name, c.credit_limit, c.credit_used
)
SELECT 
  COUNT(*) AS total_clientes,
  COUNT(*) FILTER (WHERE diferencia < 0.01) AS consistentes,
  COUNT(*) FILTER (WHERE diferencia >= 0.01) AS inconsistentes,
  CASE 
    WHEN COUNT(*) FILTER (WHERE diferencia >= 0.01) = 0 THEN '✓ Todos consistentes'
    ELSE '⚠ Hay inconsistencias'
  END AS estado
FROM client_debt;

\echo ''
\echo 'Clientes con inconsistencias (si hay):'
SELECT 
  c.name,
  c.credit_used AS credit_used_actual,
  COALESCE(SUM(i.amount - i.paid_amount), 0) AS deuda_calculada,
  ABS(c.credit_used - COALESCE(SUM(i.amount - i.paid_amount), 0)) AS diferencia
FROM clients c
LEFT JOIN credit_plans cp ON cp.client_id = c.id
LEFT JOIN installments i ON i.plan_id = cp.id 
  AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
GROUP BY c.id, c.name, c.credit_used
HAVING ABS(c.credit_used - COALESCE(SUM(i.amount - i.paid_amount), 0)) >= 0.01
LIMIT 5;

\echo ''

-- ============================================================================
-- 4. VERIFICAR CRÉDITOS NEGATIVOS
-- ============================================================================
\echo '4. Verificando créditos negativos...'
\echo ''

SELECT 
  COUNT(*) AS total_clientes,
  COUNT(*) FILTER (WHERE (credit_limit - credit_used) < 0) AS con_credito_negativo,
  CASE 
    WHEN COUNT(*) FILTER (WHERE (credit_limit - credit_used) < 0) = 0 THEN '✓ Sin créditos negativos'
    ELSE '⚠ Hay créditos negativos'
  END AS estado
FROM clients;

\echo ''
\echo 'Clientes con crédito negativo (si hay):'
SELECT 
  name,
  credit_limit,
  credit_used,
  credit_limit - credit_used AS credito_disponible
FROM clients
WHERE (credit_limit - credit_used) < 0
LIMIT 5;

\echo ''

-- ============================================================================
-- 5. VERIFICAR COORDENADAS
-- ============================================================================
\echo '5. Verificando coordenadas de clientes...'
\echo ''

SELECT 
  COUNT(*) AS total_clientes,
  COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS con_coordenadas,
  COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL) AS sin_coordenadas,
  ROUND(COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL)::NUMERIC / COUNT(*) * 100, 1) AS porcentaje_con_coords,
  CASE 
    WHEN COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL) = 0 THEN '✓ Todos con coordenadas'
    WHEN COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL)::NUMERIC / COUNT(*) >= 0.9 THEN '✓ Mayoría con coordenadas'
    ELSE '⚠ Muchos sin coordenadas'
  END AS estado
FROM clients;

\echo ''
\echo 'Rango de coordenadas (debe estar en Trujillo):'
SELECT 
  MIN(lat) AS lat_min,
  MAX(lat) AS lat_max,
  MIN(lng) AS lng_min,
  MAX(lng) AS lng_max,
  CASE 
    WHEN MIN(lat) BETWEEN -8.15 AND -8.05 
     AND MAX(lat) BETWEEN -8.15 AND -8.05
     AND MIN(lng) BETWEEN -79.10 AND -78.95
     AND MAX(lng) BETWEEN -79.10 AND -78.95
    THEN '✓ Coordenadas en rango de Trujillo'
    ELSE '⚠ Coordenadas fuera de rango'
  END AS estado
FROM clients
WHERE lat IS NOT NULL AND lng IS NOT NULL;

\echo ''

-- ============================================================================
-- 6. ESTADÍSTICAS GENERALES
-- ============================================================================
\echo '6. Estadísticas generales del sistema...'
\echo ''

SELECT 
  COUNT(*) AS total_clientes,
  COUNT(*) FILTER (WHERE credit_limit > 0) AS con_credito,
  COUNT(*) FILTER (WHERE credit_used > 0) AS con_deuda,
  TO_CHAR(SUM(credit_limit), 'S/ 999,999,999.99') AS limite_total,
  TO_CHAR(SUM(credit_used), 'S/ 999,999,999.99') AS deuda_total,
  TO_CHAR(SUM(credit_limit - credit_used), 'S/ 999,999,999.99') AS credito_disponible_total,
  ROUND(AVG((credit_used / NULLIF(credit_limit, 0)) * 100), 1) || '%' AS utilizacion_promedio
FROM clients
WHERE credit_limit > 0;

\echo ''

-- ============================================================================
-- 7. TOP 5 CLIENTES CON MAYOR DEUDA
-- ============================================================================
\echo '7. Top 5 clientes con mayor deuda...'
\echo ''

SELECT 
  name AS cliente,
  TO_CHAR(credit_limit, 'S/ 999,999.99') AS limite,
  TO_CHAR(credit_used, 'S/ 999,999.99') AS deuda,
  TO_CHAR(credit_limit - credit_used, 'S/ 999,999.99') AS disponible,
  ROUND((credit_used / NULLIF(credit_limit, 0)) * 100, 1) || '%' AS utilizacion,
  CASE 
    WHEN lat IS NOT NULL AND lng IS NOT NULL THEN '✓'
    ELSE '✗'
  END AS coords
FROM clients
WHERE credit_used > 0
ORDER BY credit_used DESC
LIMIT 5;

\echo ''

-- ============================================================================
-- 8. VERIFICAR CUOTAS PENDIENTES
-- ============================================================================
\echo '8. Verificando cuotas pendientes...'
\echo ''

SELECT 
  COUNT(*) AS total_cuotas,
  COUNT(*) FILTER (WHERE status = 'PENDING') AS pendientes,
  COUNT(*) FILTER (WHERE status = 'PARTIAL') AS parciales,
  COUNT(*) FILTER (WHERE status = 'OVERDUE') AS vencidas,
  COUNT(*) FILTER (WHERE status = 'PAID') AS pagadas,
  TO_CHAR(SUM(amount - paid_amount) FILTER (WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE')), 'S/ 999,999,999.99') AS monto_pendiente
FROM installments;

\echo ''

-- ============================================================================
-- RESUMEN FINAL
-- ============================================================================
\echo '============================================================================'
\echo 'RESUMEN DE VERIFICACIÓN'
\echo '============================================================================'
\echo ''

DO $$
DECLARE
  v_funciones_ok BOOLEAN;
  v_triggers_ok BOOLEAN;
  v_consistencia_ok BOOLEAN;
  v_negativos_ok BOOLEAN;
  v_coords_ok BOOLEAN;
  v_todo_ok BOOLEAN;
BEGIN
  -- Verificar funciones
  SELECT COUNT(*) = 2 INTO v_funciones_ok
  FROM pg_proc
  WHERE proname IN ('recalculate_client_credit_used', 'trigger_recalculate_credit_used');
  
  -- Verificar triggers
  SELECT COUNT(*) = 1 INTO v_triggers_ok
  FROM pg_trigger
  WHERE tgname = 'trigger_installment_update_credit_used';
  
  -- Verificar consistencia
  SELECT COUNT(*) FILTER (
    WHERE ABS(c.credit_used - COALESCE(SUM(i.amount - i.paid_amount), 0)) >= 0.01
  ) = 0 INTO v_consistencia_ok
  FROM clients c
  LEFT JOIN credit_plans cp ON cp.client_id = c.id
  LEFT JOIN installments i ON i.plan_id = cp.id 
    AND i.status IN ('PENDING', 'PARTIAL', 'OVERDUE')
  GROUP BY c.id, c.credit_used;
  
  -- Verificar negativos
  SELECT COUNT(*) FILTER (WHERE (credit_limit - credit_used) < 0) = 0 INTO v_negativos_ok
  FROM clients;
  
  -- Verificar coordenadas
  SELECT COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL)::NUMERIC / COUNT(*) < 0.1 INTO v_coords_ok
  FROM clients;
  
  v_todo_ok := v_funciones_ok AND v_triggers_ok AND v_consistencia_ok AND v_negativos_ok AND v_coords_ok;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Funciones creadas:        %', CASE WHEN v_funciones_ok THEN '✓ OK' ELSE '✗ FALLO' END;
  RAISE NOTICE 'Triggers creados:         %', CASE WHEN v_triggers_ok THEN '✓ OK' ELSE '✗ FALLO' END;
  RAISE NOTICE 'Consistencia credit_used: %', CASE WHEN v_consistencia_ok THEN '✓ OK' ELSE '✗ FALLO' END;
  RAISE NOTICE 'Sin créditos negativos:   %', CASE WHEN v_negativos_ok THEN '✓ OK' ELSE '✗ FALLO' END;
  RAISE NOTICE 'Coordenadas asignadas:    %', CASE WHEN v_coords_ok THEN '✓ OK' ELSE '⚠ REVISAR' END;
  RAISE NOTICE '';
  RAISE NOTICE 'RESULTADO FINAL:          %', CASE WHEN v_todo_ok THEN '✓✓✓ TODAS LAS CORRECCIONES APLICADAS CORRECTAMENTE ✓✓✓' ELSE '⚠⚠⚠ HAY PROBLEMAS QUE REVISAR ⚠⚠⚠' END;
  RAISE NOTICE '';
END $$;

\echo ''
\echo 'Próximos pasos:'
\echo '1. Si todo está OK, verificar en la interfaz web'
\echo '2. Probar registro de pagos y ventas a crédito'
\echo '3. Verificar que el mapa muestra clientes correctamente'
\echo ''
