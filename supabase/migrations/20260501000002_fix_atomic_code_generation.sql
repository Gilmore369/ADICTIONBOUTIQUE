-- =====================================================
-- FIX: generate_next_product_code falla con "FOR UPDATE not allowed with aggregate"
-- Fecha: 2026-05-01
-- =====================================================
--
-- La versión anterior usaba MAX() + FOR UPDATE en la misma query, lo cual
-- Postgres no permite. La solución correcta es usar pg_advisory_xact_lock,
-- que serializa la ejecución por (category_id, prefix) durante la transacción.
--
-- pg_advisory_xact_lock garantiza que dos calls concurrentes con la misma
-- combinación (category_id, prefix) se ejecuten en serie, evitando que
-- ambos generen el mismo correlativo.
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_next_product_code(
  p_category_id UUID,
  p_prefix TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_key BIGINT;
  v_last_number INTEGER;
  v_next_number INTEGER;
  v_next_code TEXT;
  v_existing_code TEXT;
BEGIN
  -- Lock advisory por (category_id + prefix). hashtextextended retorna BIGINT
  -- determinístico, así que dos llamadas con misma cat+prefix toman el mismo lock.
  -- El lock se libera al terminar la transacción automáticamente.
  v_lock_key := hashtextextended(p_category_id::TEXT || ':' || p_prefix, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Ya estamos serializados. Buscar el último número usado en base_code para esta categoría.
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(base_code FROM '^' || p_prefix || '-(\d+)$') AS INTEGER
      )
    ),
    0
  )
  INTO v_last_number
  FROM products
  WHERE category_id = p_category_id
    AND base_code ~ ('^' || p_prefix || '-\d+$');

  v_next_number := v_last_number + 1;

  -- Loop de seguridad: si por alguna razón el código ya existe globalmente
  -- (ej. mismo prefix en otra categoría), incrementar.
  LOOP
    v_next_code := p_prefix || '-' || LPAD(v_next_number::TEXT, 3, '0');

    SELECT base_code INTO v_existing_code
    FROM products
    WHERE base_code = v_next_code
    LIMIT 1;

    EXIT WHEN v_existing_code IS NULL;
    v_next_number := v_next_number + 1;
  END LOOP;

  RETURN v_next_code;
END;
$$;

COMMENT ON FUNCTION public.generate_next_product_code(UUID, TEXT) IS
  'Genera el siguiente código de modelo para una categoría de forma atómica usando pg_advisory_xact_lock para serializar llamadas concurrentes.';

GRANT EXECUTE ON FUNCTION public.generate_next_product_code(UUID, TEXT) TO authenticated;
