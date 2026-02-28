-- ============================================================================
-- SCRIPT MAESTRO: CORREGIR DEUDA PENDIENTE (CREDIT_USED)
-- ============================================================================
-- Este script corrige el problema de credit_used mostrando valores incorrectos
-- 
-- PROBLEMA:
-- - credit_used muestra S/ 24,029.64 cuando el límite es S/ 5,000.00
-- - Esto ocurre porque credit_used suma TODAS las compras a crédito históricas
-- - NO resta los pagos realizados
-- 
-- SOLUCIÓN:
-- 1. Asegurar que existe la función recalculate_client_credit_used()
-- 2. Asegurar que existe el trigger que actualiza credit_used automáticamente
-- 3. Generar algunos pagos de ejemplo (opcional)
-- 4. Recalcular credit_used para todos los clientes
-- 
-- RESULTADO:
-- - credit_used mostrará solo la DEUDA PENDIENTE actual
-- - Se actualizará automáticamente cuando se registren pagos
-- ============================================================================

\echo '============================================================'
\echo 'PASO 1: VERIFICAR/CREAR FUNCIÓN DE RECÁLCULO'
\echo '============================================================'

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

\echo 'Función recalculate_client_credit_used creada/actualizada'
\echo ''

\echo '============================================================'
\echo 'PASO 2: VERIFICAR/CREAR TRIGGER AUTOMÁTICO'
\echo '============================================================'

-- Trigger: Recalcular credit_used cuando se actualiza una cuota
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

\echo 'Trigger automático creado/actualizado'
\echo 'Ahora credit_used se actualizará automáticamente cuando se registren pagos'
\echo ''

\echo '============================================================'
\echo 'PASO 3: GENERAR PAGOS DE EJEMPLO (OPCIONAL)'
\echo '============================================================'
\echo 'Generando pagos para simular que algunos clientes han pagado...'
\echo ''

DO $$
DECLARE
  installment_record RECORD;
  payment_amount DECIMAL;
  payment_date TIMESTAMP;
  total_payments INTEGER := 0;
BEGIN
  -- Generar pagos para el 30% de las cuotas vencidas y pendientes
  FOR installment_record IN 
    SELECT 
      i.id,
      i.amount,
      i.paid_amount,
      i.due_date,
      i.status
    FROM installments i
    WHERE i.status IN ('PENDING', 'OVERDUE')
      AND RANDOM() < 0.3  -- 30% de probabilidad
    LIMIT 50  -- Limitar a 50 pagos
  LOOP
    -- Pago completo o parcial
    IF RANDOM() < 0.6 THEN
      payment_amount := installment_record.amount - installment_record.paid_amount;
    ELSE
      payment_amount := ROUND(
        (installment_record.amount - installment_record.paid_amount) * (0.3 + RANDOM() * 0.5),
        2
      );
    END IF;
    
    -- Fecha de pago
    IF installment_record.status = 'OVERDUE' THEN
      payment_date := installment_record.due_date + 
        (RANDOM() * (NOW() - installment_record.due_date));
    ELSE
      payment_date := NOW() - (RANDOM() * INTERVAL '7 days');
    END IF;
    
    -- Registrar el pago
    INSERT INTO payments (
      installment_id,
      amount,
      payment_date,
      payment_method,
      notes
    ) VALUES (
      installment_record.id,
      payment_amount,
      payment_date,
      (ARRAY['EFECTIVO', 'TRANSFERENCIA', 'YAPE'])[FLOOR(RANDOM() * 3 + 1)],
      'Pago de ejemplo'
    );
    
    -- Actualizar la cuota (el trigger recalculará credit_used automáticamente)
    UPDATE installments
    SET 
      paid_amount = paid_amount + payment_amount,
      status = CASE 
        WHEN (paid_amount + payment_amount) >= amount THEN 'PAID'
        ELSE 'PARTIAL'
      END,
      paid_date = CASE 
        WHEN (paid_amount + payment_amount) >= amount THEN payment_date
        ELSE paid_date
      END
    WHERE id = installment_record.id;
    
    total_payments := total_payments + 1;
  END LOOP;
  
  RAISE NOTICE 'Pagos generados: %', total_payments;
END $$;

\echo ''
\echo '============================================================'
\echo 'PASO 4: RECALCULAR CREDIT_USED PARA TODOS LOS CLIENTES'
\echo '============================================================'

DO $$
DECLARE
  client_record RECORD;
  pending_debt DECIMAL;
  total_clients INTEGER := 0;
  updated_clients INTEGER := 0;
  clients_with_changes INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO total_clients FROM clients;
  
  RAISE NOTICE 'Recalculando credit_used para % clientes...', total_clients;
  
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
    
    -- Actualizar credit_used
    UPDATE clients
    SET credit_used = pending_debt,
        updated_at = NOW()
    WHERE id = client_record.id;
    
    updated_clients := updated_clients + 1;
    
    -- Contar cambios significativos
    IF ABS(client_record.credit_used - pending_debt) > 10 THEN
      clients_with_changes := clients_with_changes + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Recálculo completado: % clientes actualizados', updated_clients;
  RAISE NOTICE 'Clientes con cambios significativos: %', clients_with_changes;
END $$;

\echo ''
\echo '============================================================'
\echo 'CORRECCIÓN COMPLETADA'
\echo '============================================================'
\echo ''
\echo 'Ahora credit_used muestra la DEUDA PENDIENTE real de cada cliente'
\echo 'El sistema actualizará automáticamente cuando se registren pagos'
\echo ''

-- Mostrar algunos ejemplos
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

