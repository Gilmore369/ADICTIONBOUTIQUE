-- ============================================================================
-- Migration: Vistas y Funciones de Negocio
-- ============================================================================
-- 1. v_client_credit_summary  → reemplaza cálculos JS en client-service.ts
-- 2. v_overdue_installments   → vista de cobranzas rápida
-- 3. get_dashboard_metrics()  → reemplaza 7 queries + loops JS en dashboard-service.ts
-- 4. get_sales_by_period()    → ventas agrupadas para gráficos
-- ============================================================================

-- ============================================================================
-- 1. VISTA: v_client_credit_summary
-- ============================================================================
CREATE OR REPLACE VIEW v_client_credit_summary AS
SELECT
  c.id                                               AS client_id,
  c.name                                             AS client_name,
  c.credit_limit,
  c.credit_used,
  -- Deuda real calculada (fuente de verdad)
  COALESCE(SUM(i.amount - i.paid_amount) FILTER (
    WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
  ), 0)                                              AS total_debt,
  -- Deuda vencida
  COALESCE(SUM(i.amount - i.paid_amount) FILTER (
    WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
      AND i.due_date < CURRENT_DATE
  ), 0)                                              AS overdue_debt,
  -- Crédito disponible real
  GREATEST(
    c.credit_limit - COALESCE(SUM(i.amount - i.paid_amount) FILTER (
      WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    ), 0),
    0
  )                                                  AS credit_available,
  -- Número de cuotas vencidas
  COUNT(i.id) FILTER (
    WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
      AND i.due_date < CURRENT_DATE
  )                                                  AS overdue_count,
  -- Días de mora (cuota vencida más antigua)
  COALESCE(
    (CURRENT_DATE - MIN(i.due_date) FILTER (
      WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
        AND i.due_date < CURRENT_DATE
    ))::INTEGER,
    0
  )                                                  AS days_overdue,
  -- Próxima cuota a vencer
  MIN(i.due_date) FILTER (
    WHERE i.status IN ('PENDING','PARTIAL')
      AND i.due_date >= CURRENT_DATE
  )                                                  AS next_due_date,
  -- Total cuotas activas
  COUNT(i.id) FILTER (
    WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
  )                                                  AS active_installments
FROM clients c
LEFT JOIN credit_plans cp ON cp.client_id = c.id AND cp.status = 'ACTIVE'
LEFT JOIN installments i   ON i.plan_id = cp.id
GROUP BY c.id, c.name, c.credit_limit, c.credit_used;

COMMENT ON VIEW v_client_credit_summary IS
  'Resumen de crédito por cliente calculado en DB. Usar en lugar de clients.credit_used.';

-- ============================================================================
-- 2. VISTA: v_overdue_installments
-- ============================================================================
-- Nota: usa s.store_id (TEXT) para no depender de la migración de stores/warehouses.
CREATE OR REPLACE VIEW v_overdue_installments AS
SELECT
  i.id                         AS installment_id,
  i.plan_id,
  i.installment_number,
  i.amount,
  i.paid_amount,
  i.amount - i.paid_amount     AS pending_amount,
  i.due_date,
  (CURRENT_DATE - i.due_date)  AS days_overdue,
  i.status,
  cp.client_id,
  c.name                       AS client_name,
  c.phone                      AS client_phone,
  c.address                    AS client_address,
  c.lat,
  c.lng,
  c.rating,
  cp.sale_id,
  s.store_id                   AS sale_store_id
FROM installments i
JOIN credit_plans cp ON i.plan_id = cp.id
JOIN clients c        ON cp.client_id = c.id
JOIN sales s          ON cp.sale_id = s.id
WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
  AND i.due_date < CURRENT_DATE
  AND c.active = true
  AND cp.status = 'ACTIVE';

-- Índice de soporte para la vista
CREATE INDEX IF NOT EXISTS idx_installments_overdue_view
  ON installments(due_date, status)
  WHERE status IN ('PENDING','PARTIAL','OVERDUE');

COMMENT ON VIEW v_overdue_installments IS
  'Cuotas vencidas con datos del cliente para cobranzas y mapa. Tiempo real.';

-- ============================================================================
-- 3. FUNCIÓN: get_dashboard_metrics
-- ============================================================================
-- Fix: lowStockProducts envuelto en subquery para que retorne un scalar.
-- Fix: collection_actions usa columnas que pueden no existir → guardado con IF EXISTS.
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

  -- Clientes con al menos una cuota vencida
  SELECT COUNT(DISTINCT cp.client_id)
  INTO v_clients_overdue_debt
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND i.due_date < CURRENT_DATE
    AND cp.status = 'ACTIVE';

  -- Clientes inactivos (sin compra en N días)
  SELECT COUNT(*)
  INTO v_inactive_clients
  FROM clients
  WHERE active = true
    AND last_purchase_date IS NOT NULL
    AND CURRENT_DATE - last_purchase_date > p_inactivity_days;

  -- Cumpleaños este mes
  SELECT COUNT(*)
  INTO v_birthdays_this_month
  FROM clients
  WHERE active = true
    AND birthday IS NOT NULL
    AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE);

  -- Acciones de cobranza pendientes (columnas agregadas en migración 20240301000003)
  BEGIN
    EXECUTE '
      SELECT COUNT(*)
      FROM collection_actions
      WHERE completed = false
        AND follow_up_date <= CURRENT_DATE
    ' INTO v_pending_actions;
  EXCEPTION WHEN undefined_column THEN
    -- Las columnas completed/follow_up_date aún no existen
    SELECT COUNT(*) INTO v_pending_actions FROM collection_actions;
  END;

  -- Deuda total pendiente
  SELECT COALESCE(SUM(i.amount - i.paid_amount), 0)
  INTO v_total_outstanding_debt
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND cp.status = 'ACTIVE';

  -- Deuda vencida total
  SELECT COALESCE(SUM(i.amount - i.paid_amount), 0)
  INTO v_total_overdue_debt
  FROM installments i
  JOIN credit_plans cp ON i.plan_id = cp.id
  WHERE i.status IN ('PENDING','PARTIAL','OVERDUE')
    AND i.due_date < CURRENT_DATE
    AND cp.status = 'ACTIVE';

  -- Ventas de hoy
  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_sales_today, v_sales_count_today
  FROM sales
  WHERE voided = false
    AND DATE(created_at) = CURRENT_DATE;

  -- Ventas este mes
  SELECT COALESCE(SUM(total), 0)
  INTO v_sales_this_month
  FROM sales
  WHERE voided = false
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());

  -- Productos con stock bajo  ← FIX: subquery anidado para retornar scalar
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

  -- Pagos recibidos este mes
  SELECT COALESCE(SUM(amount), 0)
  INTO v_payments_this_month
  FROM payments
  WHERE DATE_TRUNC('month', payment_date::TIMESTAMPTZ) = DATE_TRUNC('month', NOW());

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

GRANT EXECUTE ON FUNCTION get_dashboard_metrics TO authenticated;

COMMENT ON FUNCTION get_dashboard_metrics IS
  'KPIs del dashboard en una sola llamada RPC. Reemplaza 7+ queries + loops JS.';

-- ============================================================================
-- 4. FUNCIÓN: get_sales_by_period
-- ============================================================================
-- Fix: usa EXECUTE dinámico para que DATE_TRUNC acepte la variable como literal.
CREATE OR REPLACE FUNCTION get_sales_by_period(
  p_period   TEXT    DEFAULT 'month',
  p_store_id TEXT    DEFAULT NULL,
  p_limit    INTEGER DEFAULT 12
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_trunc_expr  TEXT;
  v_fmt_label   TEXT;
  v_result      JSONB;
  v_sql         TEXT;
BEGIN
  -- Validar y mapear período
  v_trunc_expr := CASE p_period
    WHEN 'day'   THEN 'day'
    WHEN 'week'  THEN 'week'
    WHEN 'year'  THEN 'year'
    ELSE              'month'
  END;

  v_fmt_label := CASE v_trunc_expr
    WHEN 'day'   THEN 'DD/MM/YY'
    WHEN 'week'  THEN 'DD/MM/YY'
    WHEN 'year'  THEN 'YYYY'
    ELSE              'Mon YYYY'
  END;

  -- SQL dinámico para que DATE_TRUNC reciba literal en runtime
  v_sql := format(
    $sql$
    SELECT jsonb_agg(r ORDER BY r->>'period')
    FROM (
      SELECT jsonb_build_object(
        'period',   TO_CHAR(DATE_TRUNC(%L, created_at), 'YYYY-MM-DD'),
        'label',    TO_CHAR(DATE_TRUNC(%L, created_at), %L),
        'total',    COALESCE(SUM(total), 0),
        'count',    COUNT(*),
        'contado',  COALESCE(SUM(total) FILTER (WHERE sale_type = 'CONTADO'), 0),
        'credito',  COALESCE(SUM(total) FILTER (WHERE sale_type = 'CREDITO'), 0)
      ) AS r
      FROM sales
      WHERE voided = false
        AND (%L::TEXT IS NULL OR store_id = %L)
      GROUP BY DATE_TRUNC(%L, created_at)
      ORDER BY DATE_TRUNC(%L, created_at) DESC
      LIMIT %s
    ) sub
    $sql$,
    v_trunc_expr, v_trunc_expr, v_fmt_label,
    p_store_id, p_store_id,
    v_trunc_expr, v_trunc_expr,
    p_limit
  );

  EXECUTE v_sql INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_sales_by_period TO authenticated;

COMMENT ON FUNCTION get_sales_by_period IS
  'Ventas agrupadas por período (day/week/month/year). Retorna JSONB para gráficos del dashboard.';
