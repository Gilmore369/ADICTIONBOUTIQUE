-- ============================================================================
-- FIX: Corregir conteo de productos con stock bajo en get_dashboard_metrics
-- PROBLEMA: SUM(qty) <= min_stock cuenta productos con qty=0 y min_stock=0
--   (0 <= 0 = true) → infla el conteo global
-- SOLUCIÓN: Solo contar si qty=0 (sin stock) O (min_stock>0 AND qty<=min_stock)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_inactivity_days INTEGER DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
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
  SELECT COUNT(*) INTO v_total_active        FROM clients WHERE active = true;
  SELECT COUNT(*) INTO v_total_deactivated   FROM clients WHERE active = false;

  SELECT COUNT(DISTINCT cp.client_id)
  INTO v_clients_with_debt
  FROM credit_plans cp
  JOIN installments i ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND cp.status = 'ACTIVE';

  SELECT COUNT(DISTINCT cp.client_id)
  INTO v_clients_overdue_debt
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND i.due_date < CURRENT_DATE
    AND cp.status = 'ACTIVE';

  SELECT COUNT(*)
  INTO v_inactive_clients
  FROM clients
  WHERE active = true
    AND last_purchase_date IS NOT NULL
    AND CURRENT_DATE - last_purchase_date > p_inactivity_days;

  SELECT COUNT(*)
  INTO v_birthdays_this_month
  FROM clients
  WHERE active = true
    AND birthday IS NOT NULL
    AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE);

  BEGIN
    EXECUTE '
      SELECT COUNT(*)
      FROM collection_actions
      WHERE completed = false
        AND follow_up_date <= CURRENT_DATE
    ' INTO v_pending_actions;
  EXCEPTION WHEN undefined_column THEN
    SELECT 0 INTO v_pending_actions;
  END;

  SELECT COALESCE(SUM(i.amount - i.paid_amount), 0)
  INTO v_total_outstanding_debt
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND cp.status = 'ACTIVE';

  SELECT COALESCE(SUM(i.amount - i.paid_amount), 0)
  INTO v_total_overdue_debt
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND i.due_date < CURRENT_DATE
    AND cp.status = 'ACTIVE';

  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_sales_today, v_sales_count_today
  FROM sales
  WHERE voided = false
    AND DATE(created_at) = CURRENT_DATE;

  SELECT COALESCE(SUM(total), 0)
  INTO v_sales_this_month
  FROM sales
  WHERE voided = false
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());

  -- FIX: qty=0 (sin stock) OR (min_stock>0 AND qty<=min_stock)
  -- Excluye productos con min_stock=0 y qty>0 (sin mínimo configurado)
  SELECT COUNT(*)
  INTO v_low_stock_products
  FROM (
    SELECT p.id
    FROM products p
    JOIN stock sk ON sk.product_id = p.id
    WHERE p.active = true
    GROUP BY p.id, p.min_stock
    HAVING SUM(sk.quantity) = 0
        OR (p.min_stock > 0 AND SUM(sk.quantity) <= p.min_stock)
  ) low_stock_sub;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_payments_this_month
  FROM payments
  WHERE DATE_TRUNC('month', payment_date::TIMESTAMPTZ) = DATE_TRUNC('month', NOW());

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

GRANT EXECUTE ON FUNCTION get_dashboard_metrics TO authenticated;
