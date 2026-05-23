-- ============================================================
-- Fix RPC get_dashboard_metrics: paymentsThisMonth ignoraba pagos del día 1
-- ============================================================
-- Bug: el query usaba
--   DATE_TRUNC('month', payment_date::TIMESTAMPTZ AT TIME ZONE 'America/Lima')
-- Como payment_date es DATE, ::TIMESTAMPTZ lo convierte a UTC medianoche,
-- y AT TIME ZONE 'America/Lima' lo desplaza -5h → el 1-mayo se mueve a 30-abril.
-- Esto subcontaba los pagos del primer día del mes (S/510 menos en el dashboard).
--
-- Fix: comparar DATE_TRUNC('month', payment_date) directamente — sin TZ shift,
-- porque payment_date es DATE (no TIMESTAMP) y representa el día calendario.
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_metrics(p_inactivity_days INT DEFAULT 90)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today                    DATE := (NOW() AT TIME ZONE 'America/Lima')::DATE;
  v_month_start              DATE := DATE_TRUNC('month', v_today::TIMESTAMP)::DATE;
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
  v_result                   JSONB;
BEGIN
  SELECT COUNT(*) INTO v_total_active FROM clients WHERE active = true;
  SELECT COUNT(*) INTO v_total_deactivated FROM clients WHERE active = false;
  SELECT COUNT(DISTINCT cp.client_id) INTO v_clients_with_debt
    FROM credit_plans cp JOIN installments i ON i.plan_id = cp.id
    WHERE cp.status = 'ACTIVE' AND i.status != 'PAID';
  SELECT COUNT(DISTINCT cp.client_id) INTO v_clients_overdue_debt
    FROM credit_plans cp JOIN installments i ON i.plan_id = cp.id
    WHERE cp.status = 'ACTIVE' AND i.status != 'PAID' AND i.due_date < v_today;
  SELECT COUNT(*) INTO v_inactive_clients FROM clients
    WHERE active = true
      AND (last_purchase_date IS NULL OR last_purchase_date < v_today - (p_inactivity_days || ' days')::INTERVAL);
  SELECT COUNT(*) INTO v_birthdays_this_month FROM clients
    WHERE active = true AND birthday IS NOT NULL
      AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM v_today);
  SELECT COUNT(*) INTO v_pending_actions FROM collection_actions
    WHERE result IS NULL OR result = '';
  SELECT COALESCE(SUM(i.amount - i.paid_amount), 0) INTO v_total_outstanding_debt
    FROM installments i JOIN credit_plans cp ON cp.id = i.plan_id
    WHERE cp.status = 'ACTIVE' AND i.status != 'PAID';
  SELECT COALESCE(SUM(i.amount - i.paid_amount), 0) INTO v_total_overdue_debt
    FROM installments i JOIN credit_plans cp ON cp.id = i.plan_id
    WHERE cp.status = 'ACTIVE' AND i.status != 'PAID' AND i.due_date < v_today;
  SELECT COALESCE(SUM(total), 0), COUNT(*)
    INTO v_sales_today, v_sales_count_today
    FROM sales
    WHERE (created_at AT TIME ZONE 'America/Lima')::DATE = v_today
      AND voided = false;
  SELECT COALESCE(SUM(total), 0) INTO v_sales_this_month
    FROM sales
    WHERE (created_at AT TIME ZONE 'America/Lima')::DATE >= v_month_start
      AND voided = false;
  SELECT COUNT(*) INTO v_low_stock_products
    FROM (
      SELECT p.id FROM products p
      JOIN stock sk ON sk.product_id = p.id
      WHERE p.active = true
      GROUP BY p.id, p.min_stock
      HAVING SUM(sk.quantity) <= p.min_stock
    ) low_stock_sub;

  -- ★ FIX: comparar payment_date (DATE) directamente con v_month_start, sin TZ shift
  SELECT COALESCE(SUM(amount), 0) INTO v_payments_this_month
    FROM payments
    WHERE payment_date >= v_month_start
      AND payment_date <= v_today;

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
