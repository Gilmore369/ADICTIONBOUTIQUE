-- =====================================================
-- AUDITORÍA PRODUCTOS — Fase 1: Fix C1 (race condition en generación de códigos)
-- Fecha: 2026-05-01
-- =====================================================
--
-- Problema: el endpoint /api/catalogs/next-code busca el último barcode
-- por ORDER BY DESC + parseInt + 1, sin lock. Dos requests simultáneos
-- pueden generar el mismo código → INSERT del segundo falla por UNIQUE.
--
-- Solución: función PL/pgSQL atómica que usa SELECT ... FOR UPDATE
-- sobre la tabla products para garantizar serialización.
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
  v_last_number INTEGER := 0;
  v_next_number INTEGER;
  v_next_code TEXT;
  v_existing_code TEXT;
BEGIN
  -- Tomar lock exclusivo sobre las filas de products de esta categoría
  -- con prefijo dado. Esto serializa el cálculo del siguiente correlativo.
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(base_code FROM '^' || p_prefix || '-(\d+)') AS INTEGER
      )
    ),
    0
  )
  INTO v_last_number
  FROM products
  WHERE category_id = p_category_id
    AND base_code LIKE p_prefix || '-%'
    AND base_code ~ ('^' || p_prefix || '-\d+$')
  FOR UPDATE;

  v_next_number := v_last_number + 1;

  -- Loop de seguridad: si por alguna razón el código generado ya existe
  -- (datos legacy, distinta categoría, etc.), incrementar hasta encontrar uno libre
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
  'Genera el siguiente código de modelo para una categoría de forma atómica. Usa FOR UPDATE para evitar race conditions en concurrencia.';

GRANT EXECUTE ON FUNCTION public.generate_next_product_code(UUID, TEXT) TO authenticated;
