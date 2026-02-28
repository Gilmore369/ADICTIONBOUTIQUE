-- ============================================================================
-- SCRIPT: CORREGIR CREDIT_USED Y AGREGAR COORDENADAS
-- ============================================================================
-- Este script:
-- 1. Recalcula credit_used basado en cuotas pendientes (no pagadas)
-- 2. Agrega coordenadas (lat/lng) a clientes de Trujillo
-- ============================================================================

DO $$
DECLARE
  client_record RECORD;
  pending_debt DECIMAL;
  coord_index INTEGER;
  random_offset DECIMAL;
BEGIN
  RAISE NOTICE 'Iniciando corrección de credit_used y coordenadas...';
  
  -- ============================================================================
  -- 1. RECALCULAR CREDIT_USED BASADO EN CUOTAS PENDIENTES
  -- ============================================================================
  
  RAISE NOTICE 'Recalculando credit_used para todos los clientes...';
  
  FOR client_record IN 
    SELECT id, name FROM clients
  LOOP
    -- Calcular deuda pendiente: suma de (amount - paid_amount) de cuotas no pagadas
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
    
    IF pending_debt > 0 THEN
      RAISE NOTICE 'Cliente %: credit_used actualizado a %', client_record.name, pending_debt;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Credit_used recalculado para todos los clientes';
  
  -- ============================================================================
  -- 2. AGREGAR COORDENADAS A CLIENTES DE TRUJILLO
  -- ============================================================================
  
  RAISE NOTICE 'Agregando coordenadas a clientes...';
  
  coord_index := 1;
  
  FOR client_record IN 
    SELECT id, name FROM clients WHERE lat IS NULL OR lng IS NULL
  LOOP
    -- Offset aleatorio de ±0.005 grados (~500m)
    random_offset := (RANDOM() * 0.01) - 0.005;
    
    -- Asignar coordenadas con variación aleatoria
    UPDATE clients
    SET 
      lat = -8.1116 + random_offset,
      lng = -79.0288 + random_offset,
      updated_at = NOW()
    WHERE id = client_record.id;
    
    RAISE NOTICE 'Cliente %: coordenadas asignadas', client_record.name;
    
    coord_index := coord_index + 1;
  END LOOP;
  
  RAISE NOTICE 'Coordenadas agregadas a todos los clientes';
  
  -- ============================================================================
  -- 3. VERIFICACIÓN FINAL
  -- ============================================================================
  
  RAISE NOTICE '=== VERIFICACIÓN FINAL ===';
  
  -- Contar clientes con deuda
  SELECT COUNT(*) INTO coord_index FROM clients WHERE credit_used > 0;
  RAISE NOTICE 'Clientes con deuda pendiente: %', coord_index;
  
  -- Contar clientes con coordenadas
  SELECT COUNT(*) INTO coord_index FROM clients WHERE lat IS NOT NULL AND lng IS NOT NULL;
  RAISE NOTICE 'Clientes con coordenadas: %', coord_index;
  
  -- Mostrar resumen de deuda
  SELECT 
    COUNT(*) as total_clientes,
    SUM(credit_used) as deuda_total,
    AVG(credit_used) as deuda_promedio,
    MAX(credit_used) as deuda_maxima
  INTO client_record
  FROM clients
  WHERE credit_used > 0;
  
  RAISE NOTICE 'Total clientes con deuda: %', client_record.total_clientes;
  RAISE NOTICE 'Deuda total: S/ %', client_record.deuda_total;
  RAISE NOTICE 'Deuda promedio: S/ %', client_record.deuda_promedio;
  RAISE NOTICE 'Deuda máxima: S/ %', client_record.deuda_maxima;
  
  RAISE NOTICE '=== CORRECCIÓN COMPLETADA ===';
  
END;
$$;

-- ============================================================================
-- CONSULTAS DE VERIFICACIÓN
-- ============================================================================

-- Ver clientes con deuda y sus coordenadas
SELECT 
  name,
  phone,
  address,
  credit_limit,
  credit_used,
  lat,
  lng,
  CASE 
    WHEN lat IS NULL OR lng IS NULL THEN 'Sin coordenadas'
    ELSE 'Con coordenadas'
  END as coord_status
FROM clients
WHERE credit_used > 0
ORDER BY credit_used DESC
LIMIT 10;

-- Ver resumen por estado de coordenadas
SELECT 
  CASE 
    WHEN lat IS NULL OR lng IS NULL THEN 'Sin coordenadas'
    ELSE 'Con coordenadas'
  END as estado,
  COUNT(*) as cantidad,
  SUM(credit_used) as deuda_total
FROM clients
GROUP BY estado;
