-- ============================================================================
-- Fix: get_dashboard_metrics y get_sales_by_period usaban CURRENT_DATE (UTC)
-- ============================================================================
-- BUG REPORTADO:
--   Dashboard mostraba "6 en mora · S/ 542.04 vencida".
--   Página de Deuda mostraba "4 con cuotas vencidas · S/ 309.54".
--   Los 3 cuotas que se contaban en el dashboard pero NO en la página tenían
--   due_date = '2026-05-05' (hoy en Lima). Como el servidor de Supabase
--   corre en UTC, `CURRENT_DATE` ya era '2026-05-06' a las 22:46 hora Lima
--   (03:46 UTC), así que el RPC las clasificaba como vencidas; el frontend
--   las consideraba "al día" porque usaba la fecha local del navegador.
--
-- CAUSA:
--   `CURRENT_DATE` y `DATE(NOW())` retornan la fecha del servidor (UTC en
--   Supabase). El negocio opera en America/Lima (UTC-5), así que cualquier
--   métrica de "hoy" debe calcularse en esa zona.
--
-- FIX:
--   Reemplazar todas las apariciones de `CURRENT_DATE` y de `NOW()` cuando
--   se usan para definir un día calendario por
--   `(NOW() AT TIME ZONE 'America/Lima')::DATE`.
--   También se arregla `v_sales_today` que tenía el mismo defecto: las
--   ventas hechas entre 19:00 y 23:59 hora Lima caían fuera del "hoy" UTC
--   y se contaban en el día siguiente.
-- ============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_inactivity_days INTEGER DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_today                    DATE := (NOW() AT TIME ZONE 'America/Lima')::DATE;
  v_result                   JSONB;
  v_total_active             BIGINT;
  v_total_deactivated        BIGINT;
  v_clients_with_debt        BIGINT;
  v_clients_overdue_debt     BIGINT;
  v_inactive_clients         BIGINT;
  v_birthdays_this_month     BIGINT;
  v_pending_actions          BIGINT;
  v_total_outstanding_debt   NUMERIC;
  v_total_overdue_debt       NUMERIC;
  v_sales_today              NUMERIC;
  v_sales_count_today        BIGINT;
  v_sales_this_month         NUMERIC;
  v_low_stock_products       BIGINT;
  v_payments_this_month      NUMERIC;
BEGIN
  -- Clientes activos / inactivos
  SELECT COUNT(*) INTO v_total_active        FROM clients WHERE active = true;
  SELECT COUNT(*) INTO v_total_deactivated   FROM clients WHERE active = false;

  -- Clientes con alguna cuota pendiente (tienen deuda)
  SELECT COUNT(DISTINCT cp.client_id)
  INTO v_clients_with_debt
  FROM credit_plans cp
  JOIN installments i ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND cp.status = 'ACTIVE';

  -- Clientes con al menos una cuota vencida (hora Lima)
  SELECT COUNT(DISTINCT cp.client_id)
  INTO v_clients_overdue_debt
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND i.due_date < v_today
    AND cp.status = 'ACTIVE';

  -- Clientes inactivos (sin compra en N días, hora Lima)
  SELECT COUNT(*)
  INTO v_inactive_clients
  FROM clients
  WHERE active = true
    AND last_purchase_date IS NOT NULL
    AND v_today - last_purchase_date > p_inactivity_days;

  -- Cumpleaños este mes
  SELECT COUNT(*)
  INTO v_birthdays_this_month
  FROM clients
  WHERE active = true
    AND birthday IS NOT NULL
    AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM v_today);

  -- Acciones de cobranza pendientes
  SELECT COUNT(*)
  INTO v_pending_actions
  FROM collection_actions
  WHERE result IN ('PROMESA_PAGO','PENDIENTE','SIN_RESPUESTA','VOLVER_A_LLAMAR');

  -- Total de deuda pendiente (todas las cuotas no pagadas de planes ACTIVE)
  SELECT COALESCE(SUM(i.amount - i.paid_amount), 0)
  INTO v_total_outstanding_debt
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND cp.status = 'ACTIVE';

  -- Total vencido (hora Lima)
  SELECT COALESCE(SUM(i.amount - i.paid_amount), 0)
  INTO v_total_overdue_debt
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND i.due_date < v_today
    AND cp.status = 'ACTIVE';

  -- Ventas de hoy (hora Lima — antes contaba ventas de 19:00 Lima como del día siguiente)
  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_sales_today, v_sales_count_today
  FROM sales
  WHERE voided = false
    AND (created_at AT TIME ZONE 'America/Lima')::DATE = v_today;

  -- Ventas este mes (hora Lima)
  SELECT COALESCE(SUM(total), 0)
  INTO v_sales_this_month
  FROM sales
  WHERE voided = false
    AND DATE_TRUNC('month', created_at AT TIME ZONE 'America/Lima')
        = DATE_TRUNC('month', v_today::TIMESTAMP);

  -- Productos con stock bajo
  SELECT COUNT(*)
  INTO v_low_stock_products
  FROM (
    SELECT p.id
    FROM products p
    JOIN stock sk ON sk.product_id = p.id
    WHERE p.active = true
    GROUP BY p.id, p.min_stock
    HAVING SUM(sk.quantity) <= p.min_stock
  ) low_stock_sub;

  -- Pagos recibidos este mes (hora Lima)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_payments_this_month
  FROM payments
  WHERE DATE_TRUNC('month', payment_date::TIMESTAMPTZ AT TIME ZONE 'America/Lima')
        = DATE_TRUNC('month', v_today::TIMESTAMP);

  -- Construir resultado
  v_result := jsonb_build_object(
    'totalActiveClients',       v_total_active,
    'totalDeactivatedClients',  v_total_deactivated,
    'clientsWithDebt',          v_clients_with_debt,
    'clientsWithOverdueDebt',   v_clients_overdue_debt,
    'inactiveClients',          v_inactive_clients,
    'birthdaysThisMonth',       v_birthdays_this_month,
    'pendingCollectionActions', v_pending_actions,
    'totalOutstandingDebt',     v_total_outstanding_debt,
    'totalOverdueDebt',         v_total_overdue_debt,
    'salesToday',               v_sales_today,
    'salesCountToday',          v_sales_count_today,
    'salesThisMonth',           v_sales_this_month,
    'lowStockProducts',         v_low_stock_products,
    'paymentsThisMonth',        v_payments_this_month
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_metrics(INTEGER) TO authenticated;

COMMENT ON FUNCTION get_dashboard_metrics IS
  'KPIs del dashboard. Todas las fechas se calculan en zona America/Lima (UTC-5) para evitar el desfase entre la hora del servidor (UTC) y la hora del negocio.';
