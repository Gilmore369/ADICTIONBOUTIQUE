-- ============================================================================
-- GENERAR PAGOS DE EJEMPLO
-- ============================================================================
-- Este script genera pagos aleatorios para algunas cuotas vencidas y pendientes
-- para simular que algunos clientes han estado pagando sus deudas
-- ============================================================================

DO $$
DECLARE
  installment_record RECORD;
  payment_amount DECIMAL;
  payment_date TIMESTAMP;
  total_payments INTEGER := 0;
  payment_percentage DECIMAL;
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'GENERANDO PAGOS DE EJEMPLO';
  RAISE NOTICE '============================================================';
  
  -- Generar pagos para el 40% de las cuotas vencidas y pendientes
  FOR installment_record IN 
    SELECT 
      i.id,
      i.amount,
      i.paid_amount,
      i.due_date,
      i.status,
      cp.client_id,
      c.name as client_name
    FROM installments i
    INNER JOIN credit_plans cp ON i.plan_id = cp.id
    INNER JOIN clients c ON cp.client_id = c.id
    WHERE i.status IN ('PENDING', 'OVERDUE')
      AND RANDOM() < 0.4  -- 40% de probabilidad de pago
    ORDER BY i.due_date
    LIMIT 100  -- Limitar a 100 pagos para no saturar
  LOOP
    -- Determinar monto del pago (50% pago completo, 50% pago parcial)
    IF RANDOM() < 0.5 THEN
      -- Pago completo
      payment_amount := installment_record.amount - installment_record.paid_amount;
      payment_percentage := 100;
    ELSE
      -- Pago parcial (30% a 80% del monto pendiente)
      payment_percentage := 30 + (RANDOM() * 50);
      payment_amount := ROUND(
        (installment_record.amount - installment_record.paid_amount) * (payment_percentage / 100),
        2
      );
    END IF;
    
    -- Fecha de pago: entre la fecha de vencimiento y hoy
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
      (ARRAY['EFECTIVO', 'TRANSFERENCIA', 'YAPE', 'PLIN'])[FLOOR(RANDOM() * 4 + 1)],
      'Pago generado automáticamente'
    );
    
    -- Actualizar la cuota
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
    
    -- Mostrar algunos pagos
    IF total_payments <= 10 THEN
      RAISE NOTICE 'Pago #%: Cliente: % | Monto: S/ % (%.0f%% de la cuota)',
        total_payments,
        installment_record.client_name,
        ROUND(payment_amount, 2),
        payment_percentage;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'PAGOS GENERADOS: % pagos registrados', total_payments;
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTA: El trigger automático recalculará credit_used para cada cliente';
  RAISE NOTICE '      después de actualizar las cuotas.';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- VERIFICAR PAGOS GENERADOS
-- ============================================================================

RAISE NOTICE '============================================================';
RAISE NOTICE 'RESUMEN DE PAGOS POR CLIENTE';
RAISE NOTICE '============================================================';

SELECT 
  c.name AS "Cliente",
  COUNT(p.id) AS "Pagos Realizados",
  SUM(p.amount) AS "Total Pagado",
  c.credit_used AS "Deuda Pendiente",
  c.credit_limit - c.credit_used AS "Crédito Disponible"
FROM clients c
INNER JOIN credit_plans cp ON cp.client_id = c.id
INNER JOIN installments i ON i.plan_id = cp.id
INNER JOIN payments p ON p.installment_id = i.id
GROUP BY c.id, c.name, c.credit_used, c.credit_limit
ORDER BY SUM(p.amount) DESC
LIMIT 10;

-- ============================================================================
-- ESTADÍSTICAS DE CUOTAS
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '============================================================';
RAISE NOTICE 'ESTADÍSTICAS DE CUOTAS';
RAISE NOTICE '============================================================';

SELECT 
  status AS "Estado",
  COUNT(*) AS "Cantidad",
  SUM(amount) AS "Monto Total",
  SUM(paid_amount) AS "Monto Pagado",
  SUM(amount - paid_amount) AS "Monto Pendiente"
FROM installments
GROUP BY status
ORDER BY 
  CASE status
    WHEN 'OVERDUE' THEN 1
    WHEN 'PARTIAL' THEN 2
    WHEN 'PENDING' THEN 3
    WHEN 'PAID' THEN 4
  END;

