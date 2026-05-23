-- ============================================================
-- get_payments_stats(...)
-- Calcula totales agregados de pagos (SUM, COUNT, AVG, MAX)
-- sobre un rango filtrado. Server-side en 1 round-trip.
-- ============================================================

CREATE OR REPLACE FUNCTION get_payments_stats(
  p_from_date DATE   DEFAULT NULL,
  p_to_date   DATE   DEFAULT NULL,
  p_search    TEXT   DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH filtered AS (
    SELECT p.amount
    FROM payments p
    LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN users   u ON u.id = p.user_id
    WHERE (p_from_date IS NULL OR p.payment_date >= p_from_date)
      AND (p_to_date   IS NULL OR p.payment_date <= p_to_date)
      AND (
        p_search = ''
        OR c.name ILIKE '%' || p_search || '%'
        OR c.dni  ILIKE '%' || p_search || '%'
        OR u.name ILIKE '%' || p_search || '%'
      )
  )
  SELECT jsonb_build_object(
    'total', COALESCE(SUM(amount), 0),
    'count', COUNT(*),
    'avg',   CASE WHEN COUNT(*) > 0 THEN SUM(amount)::NUMERIC / COUNT(*) ELSE 0 END,
    'max',   COALESCE(MAX(amount), 0)
  ) INTO v_result FROM filtered;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_payments_stats(DATE, DATE, TEXT) TO authenticated, anon, service_role;
