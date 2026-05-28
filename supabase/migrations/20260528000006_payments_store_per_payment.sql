-- ============================================================
-- get_payments_page / get_payments_stats v3
--
-- Cambio clave: el filtro de tienda ahora se basa en la tienda
-- DEL PAGO (no del cliente). Antes, un cliente con planes en ambas
-- tiendas (ej: Milagrito Koide) mostraba TODOS sus pagos en ambos
-- filtros. Ahora cada pago se asigna a su tienda real:
--
--   legacy_source ILIKE '%BoutiqueV%'  → Tienda Hombres
--   notes ILIKE '%BoutiqueV%'          → Tienda Hombres (respaldo)
--   legacy_source ILIKE '%DBAdiction%' → Tienda Mujeres
--   pagos nuevos (plan_id) → tienda de la venta del plan
--   resto → Tienda Mujeres (default)
--
-- get_payments_page ahora devuelve `store` por fila.
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
      AND (
        p_store_id IS NULL
        OR (
          CASE
            WHEN p.legacy_source ILIKE '%BoutiqueV%' OR p.notes ILIKE '%BoutiqueV%' THEN 'Tienda Hombres'
            WHEN p.legacy_source ILIKE '%DBAdiction%' THEN 'Tienda Mujeres'
            ELSE COALESCE(
              (SELECT s.store_id FROM credit_plans cp LEFT JOIN sales s ON s.id = cp.sale_id WHERE cp.id = p.plan_id),
              'Tienda Mujeres'
            )
          END = p_store_id
        )
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
  SELECT COALESCE(jsonb_agg(row_to_json(t.*)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT p.id, p.amount, p.payment_date, p.notes, p.receipt_url, p.created_at,
           p.client_id, p.user_id,
           CASE
             WHEN p.legacy_source ILIKE '%BoutiqueV%' OR p.notes ILIKE '%BoutiqueV%' THEN 'Tienda Hombres'
             WHEN p.legacy_source ILIKE '%DBAdiction%' THEN 'Tienda Mujeres'
             ELSE COALESCE(
               (SELECT s.store_id FROM credit_plans cp LEFT JOIN sales s ON s.id = cp.sale_id WHERE cp.id = p.plan_id),
               'Tienda Mujeres'
             )
           END AS store,
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
        OR (
          CASE
            WHEN p.legacy_source ILIKE '%BoutiqueV%' OR p.notes ILIKE '%BoutiqueV%' THEN 'Tienda Hombres'
            WHEN p.legacy_source ILIKE '%DBAdiction%' THEN 'Tienda Mujeres'
            ELSE COALESCE(
              (SELECT s.store_id FROM credit_plans cp LEFT JOIN sales s ON s.id = cp.sale_id WHERE cp.id = p.plan_id),
              'Tienda Mujeres'
            )
          END = p_store_id
        )
      )
    ORDER BY p.payment_date DESC, p.created_at DESC
    OFFSET p_offset LIMIT p_limit
  ) t;

  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION get_payments_page(DATE, DATE, TEXT, TEXT, INT, INT) TO authenticated, anon, service_role;
