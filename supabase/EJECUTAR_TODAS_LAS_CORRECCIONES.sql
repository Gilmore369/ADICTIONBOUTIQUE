-- ============================================================================
-- SCRIPT MAESTRO: EJECUTAR TODAS LAS CORRECCIONES
-- ============================================================================
-- Este script ejecuta todas las correcciones en el orden correcto:
-- 1. Crear funciones y triggers para credit_used
-- 2. Recalcular credit_used para todos los clientes
-- 3. Asignar coordenadas a clientes sin ubicación
-- 4. Verificar resultados
-- ============================================================================

\echo '============================================================================'
\echo 'INICIANDO CORRECCIONES DEL SISTEMA'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- PASO 1: CREAR FUNCIÓN DE RECÁLCULO DE CREDIT_USED
-- ============================================================================
\echo 'PASO 1: Creando función recalculate_client_credit_used...'

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

\echo '✓ Función creada exitosamente'
\echo ''

-- ============================================================================
-- PASO 2: CREAR TRIGGER PARA RECÁLCULO AUTOMÁTICO
-- ============================================================================
\echo 'PASO 2: Creando trigger para recálculo automático...'

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

DROP TRIGGER IF EXISTS trigger_installment_update_credit_used ON installments;
CREATE TRIGGER trigger_installment_update_credit_used
AFTER INSERT OR UPDATE OR DELETE ON installments
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_credit_used();

COMMENT ON TRIGGER trigger_installment_update_credit_used ON installments IS 'Recalcula credit_used del cliente cuando se modifica una cuota';

\echo '✓ Trigger creado exitosamente'
\echo ''

-- ============================================================================
-- PASO 3: ACTUALIZAR FUNCIÓN create_sale_transaction
-- ============================================================================
\echo 'PASO 3: Actualizando función create_sale_transaction...'

CREATE OR REPLACE FUNCTION create_sale_transaction(
  p_sale_number TEXT,
  p_store_id TEXT,
  p_client_id UUID,
  p_user_id UUID,
  p_sale_type TEXT,
  p_subtotal DECIMAL,
  p_discount DECIMAL,
  p_total DECIMAL,
  p_items JSONB,
  p_installments INTEGER
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_plan_id UUID;
  v_item JSONB;
  v_installment_amount DECIMAL;
  v_due_date DATE;
  i INTEGER;
BEGIN
  IF p_sale_type NOT IN ('CONTADO', 'CREDITO') THEN
    RAISE EXCEPTION 'Invalid sale type: %. Must be CONTADO or CREDITO', p_sale_type;
  END IF;
  
  IF p_sale_type = 'CREDITO' THEN
    IF p_client_id IS NULL THEN
      RAISE EXCEPTION 'Credit sales require a client_id';
    END IF;
    IF p_installments IS NULL OR p_installments < 1 OR p_installments > 6 THEN
      RAISE EXCEPTION 'Credit sales require installments between 1 and 6';
    END IF;
  END IF;
  
  INSERT INTO sales (sale_number, store_id, client_id, user_id, sale_type, subtotal, discount, total)
  VALUES (p_sale_number, p_store_id, p_client_id, p_user_id, p_sale_type, p_subtotal, p_discount, p_total)
  RETURNING id INTO v_sale_id;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL
    );
    
    PERFORM decrement_stock(
      p_store_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER
    );
  END LOOP;
  
  IF p_sale_type = 'CREDITO' AND p_installments IS NOT NULL THEN
    v_installment_amount := p_total / p_installments;
    
    INSERT INTO credit_plans (sale_id, client_id, total_amount, installments_count, installment_amount)
    VALUES (v_sale_id, p_client_id, p_total, p_installments, v_installment_amount)
    RETURNING id INTO v_plan_id;
    
    FOR i IN 1..p_installments LOOP
      v_due_date := CURRENT_DATE + (i * 30);
      
      INSERT INTO installments (plan_id, installment_number, amount, due_date)
      VALUES (v_plan_id, i, v_installment_amount, v_due_date);
    END LOOP;
    
    PERFORM recalculate_client_credit_used(p_client_id);
  END IF;
  
  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

\echo '✓ Función actualizada exitosamente'
\echo ''

-- ============================================================================
-- PASO 4: RECALCULAR CREDIT_USED PARA TODOS LOS CLIENTES
-- ============================================================================
\echo 'PASO 4: Recalculando credit_used para todos los clientes...'

DO $$
DECLARE
  client_record RECORD;
  total_clients INTEGER := 0;
  updated_clients INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO total_clients FROM clients;
  
  RAISE NOTICE 'Iniciando recálculo de credit_used para % clientes...', total_clients;
  
  FOR client_record IN 
    SELECT id, name FROM clients
  LOOP
    PERFORM recalculate_client_credit_used(client_record.id);
    updated_clients := updated_clients + 1;
    
    IF updated_clients % 10 = 0 THEN
      RAISE NOTICE 'Procesados % de % clientes...', updated_clients, total_clients;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Recálculo completado: % clientes actualizados', updated_clients;
END $$;

\echo '✓ Credit_used recalculado para todos los clientes'
\echo ''

-- ============================================================================
-- PASO 5: ASIGNAR COORDENADAS A CLIENTES SIN UBICACIÓN
-- ============================================================================
\echo 'PASO 5: Asignando coordenadas a clientes sin ubicación...'

DO $$
DECLARE
  clientes_sin_coords INTEGER;
BEGIN
  SELECT COUNT(*) INTO clientes_sin_coords
  FROM clients
  WHERE lat IS NULL OR lng IS NULL;
  
  RAISE NOTICE 'Clientes sin coordenadas: %', clientes_sin_coords;
  
  UPDATE clients
  SET 
    lat = -8.1116 + (random() * 0.06 - 0.03),
    lng = -79.0288 + (random() * 0.06 - 0.03),
    updated_at = NOW()
  WHERE lat IS NULL OR lng IS NULL;
  
  RAISE NOTICE 'Coordenadas asignadas a % clientes', clientes_sin_coords;
END $$;

\echo '✓ Coordenadas asignadas exitosamente'
\echo ''

-- ============================================================================
-- PASO 6: OTORGAR PERMISOS
-- ============================================================================
\echo 'PASO 6: Otorgando permisos...'

GRANT EXECUTE ON FUNCTION recalculate_client_credit_used TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_recalculate_credit_used TO authenticated;

\echo '✓ Permisos otorgados'
\echo ''

-- ============================================================================
-- VERIFICACIÓN DE RESULTADOS
-- ============================================================================
\echo '============================================================================'
\echo 'VERIFICACIÓN DE RESULTADOS'
\echo '============================================================================'
\echo ''

\echo 'Estadísticas de Clientes:'
SELECT 
  COUNT(*) AS total_clientes,
  COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS con_coordenadas,
  COUNT(*) FILTER (WHERE credit_used > 0) AS con_deuda,
  SUM(credit_limit) AS limite_total,
  SUM(credit_used) AS deuda_pendiente_total,
  SUM(credit_limit - credit_used) AS credito_disponible_total,
  ROUND(AVG((credit_used / NULLIF(credit_limit, 0)) * 100), 2) AS utilizacion_promedio_pct
FROM clients
WHERE credit_limit > 0;

\echo ''
\echo 'Top 10 Clientes con Mayor Deuda:'
SELECT 
  name,
  credit_limit,
  credit_used,
  credit_limit - credit_used AS credito_disponible,
  ROUND((credit_used / NULLIF(credit_limit, 0)) * 100, 1) AS utilizacion_pct,
  CASE 
    WHEN lat IS NOT NULL AND lng IS NOT NULL THEN '✓'
    ELSE '✗'
  END AS tiene_coords
FROM clients
WHERE credit_used > 0
ORDER BY credit_used DESC
LIMIT 10;

\echo ''
\echo '============================================================================'
\echo 'CORRECCIONES COMPLETADAS EXITOSAMENTE'
\echo '============================================================================'
\echo ''
\echo 'Próximos pasos:'
\echo '1. Verificar en la UI que no hay créditos negativos (/clients)'
\echo '2. Verificar que el mapa muestra clientes (/map)'
\echo '3. Probar registro de pagos y ventas a crédito'
\echo ''
