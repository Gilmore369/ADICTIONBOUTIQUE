-- ─────────────────────────────────────────────────────────────────────────
-- Reset de la secuencia sale_number_seq a 1
-- Fecha: 2026-05-14
-- Motivo: el usuario reseteo data transaccional (sin ventas en BD) pero
--         la secuencia seguía en 109. La próxima venta sería V-110 lo
--         cual es confuso.
-- ─────────────────────────────────────────────────────────────────────────

-- Verificar que NO haya ventas antes de resetear (seguridad)
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM sales;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'No se puede resetear: hay % ventas en BD. Borra las ventas primero.', v_count;
  END IF;
END $$;

-- Reset de la secuencia. El nombre puede variar según cómo se creó.
-- Posibles nombres: sale_number_seq, sales_sale_number_seq
DO $$
BEGIN
  -- Intento 1: sale_number_seq (nombre custom)
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sale_number_seq' AND relkind = 'S') THEN
    PERFORM setval('sale_number_seq', 1, false);
    RAISE NOTICE 'Reseteada secuencia: sale_number_seq';
  -- Intento 2: nombre auto-generado de columna serial
  ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sales_sale_number_seq' AND relkind = 'S') THEN
    PERFORM setval('sales_sale_number_seq', 1, false);
    RAISE NOTICE 'Reseteada secuencia: sales_sale_number_seq';
  ELSE
    RAISE NOTICE 'No se encontró la secuencia. Listado de secuencias para diagnóstico:';
    -- Mostrar secuencias para que el usuario las vea
  END IF;
END $$;

-- Función helper para futuro: peek + reset
CREATE OR REPLACE FUNCTION public.reset_sale_number_seq()
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_seq_name TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM sales;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'No se puede resetear: hay % ventas en BD', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sale_number_seq' AND relkind = 'S') THEN
    v_seq_name := 'sale_number_seq';
  ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sales_sale_number_seq' AND relkind = 'S') THEN
    v_seq_name := 'sales_sale_number_seq';
  ELSE
    RAISE EXCEPTION 'No se encontró la secuencia';
  END IF;

  EXECUTE format('SELECT setval(%L, 1, false)', v_seq_name);
  RETURN 1;
END $$;

GRANT EXECUTE ON FUNCTION public.reset_sale_number_seq() TO service_role;
