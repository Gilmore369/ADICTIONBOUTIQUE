-- ============================================================
-- Cierre de micro-planes legacy (monto ≤ S/ 5.00)
-- Estos planes son artefactos de la migración del sistema
-- antiguo (2009-2019) con saldos residuales mínimos.
--
-- Acciones:
--   1. Marca las cuotas de esos planes como PAID
--   2. Marca los planes como COMPLETADO
--   3. Descuenta el monto de credit_used en cada cliente
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

BEGIN;

-- CTE principal: planes a cerrar
WITH micro AS (
  SELECT id, client_id, total_amount
  FROM credit_plans
  WHERE total_amount <= 5.00
    AND status NOT IN ('COMPLETADO', 'VOIDED')
),

-- Cerrar cuotas asociadas
upd_inst AS (
  UPDATE installments
  SET status     = 'PAID',
      paid_amount = amount,
      updated_at  = NOW()
  WHERE credit_plan_id IN (SELECT id FROM micro)
    AND status != 'PAID'
  RETURNING credit_plan_id
),

-- Cerrar los planes
upd_plans AS (
  UPDATE credit_plans
  SET status     = 'COMPLETADO',
      updated_at  = NOW()
  WHERE id IN (SELECT id FROM micro)
  RETURNING id, client_id, total_amount
),

-- Calcular monto a reducir por cliente
reduce AS (
  SELECT client_id,
         SUM(total_amount) AS amount_to_reduce
  FROM upd_plans
  GROUP BY client_id
)

-- Actualizar credit_used de clientes afectados
UPDATE clients c
SET credit_used = GREATEST(0, c.credit_used - r.amount_to_reduce),
    updated_at  = NOW()
FROM reduce r
WHERE c.id = r.client_id;

COMMIT;

-- Verificación: cuántos planes se cerraron
SELECT
  COUNT(*)               AS planes_cerrados,
  SUM(total_amount)      AS monto_total_cerrado,
  MIN(total_amount)      AS monto_minimo,
  MAX(total_amount)      AS monto_maximo
FROM credit_plans
WHERE total_amount <= 5.00
  AND status = 'COMPLETADO'
  AND updated_at >= NOW() - INTERVAL '10 seconds';
