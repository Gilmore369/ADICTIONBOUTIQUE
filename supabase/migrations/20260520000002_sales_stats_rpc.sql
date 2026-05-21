-- ============================================================
-- get_sales_stats(...)
-- Calcula totales agregados de ventas (TOTAL, CONTADO, CRÉDITO,
-- COUNT, AVG) sobre un rango filtrado, descontando devoluciones.
--
-- Ejecuta en 1 solo round-trip en lugar de paginar 42 lotes.
--
-- Parámetros:
--   p_store_id     'Tienda Mujeres' / 'Tienda Hombres' / NULL = todas
--   p_from_date    timestamp inicio (inclusive) / NULL = sin límite
--   p_to_date      timestamp fin (exclusive) / NULL = sin límite
--   p_search       texto a buscar en sale_number (ilike) / '' = sin filtro
-- ============================================================

CREATE OR REPLACE FUNCTION get_sales_stats(
  p_store_id  TEXT      DEFAULT NULL,
  p_from_date TIMESTAMPTZ DEFAULT NULL,
  p_to_date   TIMESTAMPTZ DEFAULT NULL,
  p_search    TEXT      DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH filtered AS (
    SELECT s.id, s.total, s.sale_type
    FROM sales s
    WHERE s.voided = false
      AND (p_store_id  IS NULL OR s.store_id = p_store_id)
      AND (p_from_date IS NULL OR s.created_at >= p_from_date)
      AND (p_to_date   IS NULL OR s.created_at <  p_to_date)
      AND (p_search = '' OR s.sale_number ILIKE '%' || p_search || '%')
  ),
  returns_sum AS (
    SELECT r.sale_id, SUM(r.total_amount) AS returned
    FROM returns r
    WHERE r.status != 'RECHAZADA'
      AND r.sale_id IN (SELECT id FROM filtered)
    GROUP BY r.sale_id
  ),
  net_sales AS (
    SELECT
      f.id,
      f.sale_type,
      GREATEST(0, f.total - COALESCE(rs.returned, 0)) AS net_total
    FROM filtered f
    LEFT JOIN returns_sum rs ON rs.sale_id = f.id
  )
  SELECT jsonb_build_object(
    'total',         COALESCE(SUM(net_total), 0),
    'contado',       COALESCE(SUM(net_total) FILTER (WHERE sale_type = 'CONTADO'), 0),
    'credito',       COALESCE(SUM(net_total) FILTER (WHERE sale_type = 'CREDITO'), 0),
    'count',         COUNT(*),
    'contado_count', COUNT(*) FILTER (WHERE sale_type = 'CONTADO'),
    'credito_count', COUNT(*) FILTER (WHERE sale_type = 'CREDITO'),
    'avg',           CASE WHEN COUNT(*) > 0 THEN SUM(net_total)::NUMERIC / COUNT(*) ELSE 0 END
  )
  INTO v_result
  FROM net_sales;

  RETURN v_result;
END;
$$;

-- Permisos de ejecución para los roles autenticados
GRANT EXECUTE ON FUNCTION get_sales_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated, anon, service_role;

-- Test rápido (debe devolver { total, count, ... }):
-- SELECT get_sales_stats(NULL, NULL, NULL, '');
-- SELECT get_sales_stats('Tienda Mujeres', '2026-01-01', '2027-01-01', '');
