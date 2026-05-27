-- ============================================================
-- Enhanced RPCs para payments con filtro de tienda
--
-- 1) get_payments_stats_v2 — totales agregados con filtro store
-- 2) get_payments_page    — devuelve página + stats en un solo viaje
--
-- Mapping de tienda a clientes:
--   Tienda Mujeres → clientes con plan donde legacy_source ILIKE '%DBAdiction%' OR sale.store_id='Tienda Mujeres'
--   Tienda Hombres → clientes con plan donde legacy_source ILIKE '%BoutiqueV%' OR sale.store_id='Tienda Hombres'
-- ============================================================

CREATE OR REPLACE FUNCTION get_payments_stats(
  p_from_date DATE   DEFAULT NULL,
  p_to_date   DATE   DEFAULT NULL,
  p_search    TEXT   DEFAULT '',
  p_store_id  TEXT   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH store_clients AS (
    SELECT DISTINCT cp.client_id
    FROM credit_plans cp
    LEFT JOIN sales s ON s.id = cp.sale_id
    WHERE p_store_id IS NOT NULL AND (
      (p_store_id = 'Tienda Mujeres' AND (s.store_id = 'Tienda Mujeres' OR cp.legacy_source ILIKE '%DBAdiction%'))
      OR
      (p_store_id = 'Tienda Hombres' AND (s.store_id = 'Tienda Hombres' OR cp.legacy_source ILIKE '%BoutiqueV%'))
    )
  ),
  filtered AS (
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
      AND (
        p_store_id IS NULL
        OR p.client_id IN (SELECT client_id FROM store_clients)
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

GRANT EXECUTE ON FUNCTION get_payments_stats(DATE, DATE, TEXT, TEXT) TO authenticated, anon, service_role;


-- Página de payments con filtros (incluye store)
CREATE OR REPLACE FUNCTION get_payments_page(
  p_from_date DATE   DEFAULT NULL,
  p_to_date   DATE   DEFAULT NULL,
  p_search    TEXT   DEFAULT '',
  p_store_id  TEXT   DEFAULT NULL,
  p_offset    INT    DEFAULT 0,
  p_limit     INT    DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  WITH store_clients AS (
    SELECT DISTINCT cp.client_id
    FROM credit_plans cp
    LEFT JOIN sales s ON s.id = cp.sale_id
    WHERE p_store_id IS NOT NULL AND (
      (p_store_id = 'Tienda Mujeres' AND (s.store_id = 'Tienda Mujeres' OR cp.legacy_source ILIKE '%DBAdiction%'))
      OR
      (p_store_id = 'Tienda Hombres' AND (s.store_id = 'Tienda Hombres' OR cp.legacy_source ILIKE '%BoutiqueV%'))
    )
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t.*)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT p.id, p.amount, p.payment_date, p.notes, p.receipt_url, p.created_at,
           p.client_id, p.user_id,
           jsonb_build_object('name', c.name, 'dni', c.dni) AS clients,
           jsonb_build_object('name', u.name, 'stores', u.stores) AS users
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
      AND (
        p_store_id IS NULL
        OR p.client_id IN (SELECT client_id FROM store_clients)
      )
    ORDER BY p.payment_date DESC, p.created_at DESC
    OFFSET p_offset LIMIT p_limit
  ) t;

  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION get_payments_page(DATE, DATE, TEXT, TEXT, INT, INT) TO authenticated, anon, service_role;
