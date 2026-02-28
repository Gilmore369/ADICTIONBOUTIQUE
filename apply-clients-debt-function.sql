-- ============================================================================
-- Apply analytics.report_clients_debt function
-- ============================================================================
-- This script adds the clients debt report function to the analytics schema
-- Run this in the Supabase SQL Editor

-- ============================================================================
-- 14. REPORTE: Clientes con Deuda
-- ============================================================================
CREATE OR REPLACE FUNCTION analytics.report_clients_debt(filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
  result jsonb;
  start_date timestamptz;
  end_date timestamptz;
BEGIN
  -- Extraer filtros
  start_date := COALESCE((filters->>'start_date')::timestamptz, NOW() - INTERVAL '365 days');
  end_date := COALESCE((filters->>'end_date')::timestamptz, NOW());

  WITH client_debt_data AS (
    SELECT 
      c.id as client_id,
      c.dni,
      c.name as client_name,
      c.phone,
      c.credit_limit,
      c.credit_used,
      -- Calcular deuda total: suma de cuotas - suma de pagos
      COALESCE(SUM(i.amount), 0) as total_installments,
      COALESCE(SUM(i.paid_amount), 0) as total_paid,
      COALESCE(SUM(i.amount) - SUM(i.paid_amount), 0) as debt_balance,
      -- Contar cuotas pendientes y vencidas
      COUNT(i.id) FILTER (WHERE i.status IN ('PENDING', 'PARTIAL')) as pending_installments,
      COUNT(i.id) FILTER (WHERE i.status = 'OVERDUE') as overdue_installments,
      -- Calcular utilización de crédito
      COALESCE(ROUND(c.credit_used / NULLIF(c.credit_limit, 0) * 100, 2), 0) as credit_utilization_pct,
      -- Fecha de última cuota vencida
      MAX(i.due_date) FILTER (WHERE i.status = 'OVERDUE') as last_overdue_date,
      -- Contar planes de crédito activos
      COUNT(DISTINCT cp.id) as active_credit_plans
    FROM clients c
    LEFT JOIN credit_plans cp ON c.id = cp.client_id 
      AND cp.status = 'ACTIVE'
      AND cp.created_at >= start_date
      AND cp.created_at <= end_date
    LEFT JOIN installments i ON cp.id = i.plan_id
    WHERE c.active = true
    GROUP BY c.id, c.dni, c.name, c.phone, c.credit_limit, c.credit_used
    -- Filtrar solo clientes con deuda pendiente
    HAVING COALESCE(SUM(i.amount) - SUM(i.paid_amount), 0) > 0
  ),
  summary_stats AS (
    SELECT 
      COUNT(*) as total_clients_with_debt,
      SUM(debt_balance) as total_debt,
      SUM(total_installments) as total_installments_amount,
      SUM(total_paid) as total_paid_amount,
      AVG(debt_balance) as avg_debt_per_client,
      SUM(credit_used) as total_credit_used,
      SUM(credit_limit) as total_credit_limit,
      COUNT(*) FILTER (WHERE overdue_installments > 0) as clients_with_overdue
    FROM client_debt_data
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Clientes con Deuda', 'value', COALESCE((SELECT total_clients_with_debt FROM summary_stats), 0), 'format', 'number'),
      jsonb_build_object('label', 'Deuda Total', 'value', COALESCE((SELECT total_debt FROM summary_stats), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Deuda Promedio', 'value', COALESCE((SELECT ROUND(avg_debt_per_client, 2) FROM summary_stats), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Total Pagado', 'value', COALESCE((SELECT total_paid_amount FROM summary_stats), 0), 'format', 'currency'),
      jsonb_build_object('label', 'Clientes con Cuotas Vencidas', 'value', COALESCE((SELECT clients_with_overdue FROM summary_stats), 0), 'format', 'number'),
      jsonb_build_object('label', 'Utilización de Crédito Total', 'value', 
        COALESCE(ROUND((SELECT total_credit_used FROM summary_stats) / NULLIF((SELECT total_credit_limit FROM summary_stats), 0) * 100, 2), 0), 'format', 'percent')
    ),
    'series', jsonb_build_array(
      jsonb_build_object(
        'name', 'Top 20 Clientes por Deuda',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', client_name, 'y', debt_balance))
          FROM (
            SELECT client_name, debt_balance
            FROM client_debt_data
            ORDER BY debt_balance DESC
            LIMIT 20
          ) top_debtors
        )
      ),
      jsonb_build_object(
        'name', 'Utilización de Crédito por Cliente (Top 20)',
        'points', (
          SELECT jsonb_agg(jsonb_build_object('x', client_name, 'y', credit_utilization_pct))
          FROM (
            SELECT client_name, credit_utilization_pct
            FROM client_debt_data
            WHERE credit_limit > 0
            ORDER BY credit_utilization_pct DESC
            LIMIT 20
          ) top_utilization
        )
      )
    ),
    'rows', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'dni', COALESCE(dni, 'Sin DNI'),
          'clientName', client_name,
          'phone', COALESCE(phone, ''),
          'creditLimit', credit_limit,
          'creditUsed', credit_used,
          'creditUtilizationPct', credit_utilization_pct,
          'totalInstallments', total_installments,
          'totalPaid', total_paid,
          'debtBalance', debt_balance,
          'pendingInstallments', pending_installments,
          'overdueInstallments', overdue_installments,
          'activeCreditPlans', active_credit_plans,
          'lastOverdueDate', COALESCE(TO_CHAR(last_overdue_date, 'YYYY-MM-DD'), ''),
          'daysOverdue', CASE 
            WHEN last_overdue_date IS NOT NULL THEN GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE - last_overdue_date))::INTEGER)
            ELSE 0
          END
        )
      )
      FROM client_debt_data
      ORDER BY debt_balance DESC
    ),
    'meta', jsonb_build_object(
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'dni', 'label', 'DNI', 'type', 'string'),
        jsonb_build_object('key', 'clientName', 'label', 'Cliente', 'type', 'string'),
        jsonb_build_object('key', 'phone', 'label', 'Teléfono', 'type', 'string'),
        jsonb_build_object('key', 'creditLimit', 'label', 'Límite de Crédito', 'type', 'currency'),
        jsonb_build_object('key', 'creditUsed', 'label', 'Crédito Usado', 'type', 'currency'),
        jsonb_build_object('key', 'creditUtilizationPct', 'label', 'Utilización %', 'type', 'percent'),
        jsonb_build_object('key', 'totalInstallments', 'label', 'Total Cuotas', 'type', 'currency'),
        jsonb_build_object('key', 'totalPaid', 'label', 'Total Pagado', 'type', 'currency'),
        jsonb_build_object('key', 'debtBalance', 'label', 'Saldo Deuda', 'type', 'currency'),
        jsonb_build_object('key', 'pendingInstallments', 'label', 'Cuotas Pendientes', 'type', 'number'),
        jsonb_build_object('key', 'overdueInstallments', 'label', 'Cuotas Vencidas', 'type', 'number'),
        jsonb_build_object('key', 'activeCreditPlans', 'label', 'Planes Activos', 'type', 'number'),
        jsonb_build_object('key', 'lastOverdueDate', 'label', 'Última Fecha Vencida', 'type', 'date'),
        jsonb_build_object('key', 'daysOverdue', 'label', 'Días de Atraso', 'type', 'number')
      )
    )
  ) INTO result
  FROM summary_stats;

  RETURN result;
END;
$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION analytics.report_clients_debt TO authenticated;

-- Verify the function was created
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'analytics' 
AND routine_name = 'report_clients_debt';
