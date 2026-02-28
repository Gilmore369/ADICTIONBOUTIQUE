-- ============================================================================
-- Migration: Estandarizar nombres de tiendas/almacenes
-- ============================================================================
-- Este script normaliza todos los warehouse_id a un formato consistente:
--   - "Tienda Mujeres" (antes: TIENDA_MUJERES, Mujeres, etc.)
--   - "Tienda Hombres" (antes: TIENDA_HOMBRES, Hombres, etc.)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ACTUALIZAR TABLA STOCK
-- ============================================================================

-- Normalizar variantes de "Mujeres" a "Tienda Mujeres"
UPDATE stock 
SET warehouse_id = 'Tienda Mujeres'
WHERE warehouse_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'tienda_mujeres');

-- Normalizar variantes de "Hombres" a "Tienda Hombres"
UPDATE stock 
SET warehouse_id = 'Tienda Hombres'
WHERE warehouse_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'tienda_hombres');

-- ============================================================================
-- 2. ACTUALIZAR TABLA MOVEMENTS
-- ============================================================================

-- Normalizar variantes de "Mujeres" a "Tienda Mujeres"
UPDATE movements 
SET warehouse_id = 'Tienda Mujeres'
WHERE warehouse_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'tienda_mujeres');

-- Normalizar variantes de "Hombres" a "Tienda Hombres"
UPDATE movements 
SET warehouse_id = 'Tienda Hombres'
WHERE warehouse_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'tienda_hombres');

-- ============================================================================
-- 3. ACTUALIZAR TABLA SALES (store_id)
-- ============================================================================

-- Normalizar variantes de "Mujeres" a "Tienda Mujeres"
UPDATE sales 
SET store_id = 'Tienda Mujeres'
WHERE store_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'tienda_mujeres');

-- Normalizar variantes de "Hombres" a "Tienda Hombres"
UPDATE sales 
SET store_id = 'Tienda Hombres'
WHERE store_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'tienda_hombres');

-- ============================================================================
-- 4. ACTUALIZAR TABLA CASH_SHIFTS (store_id)
-- ============================================================================

-- Normalizar variantes de "Mujeres" a "Tienda Mujeres"
UPDATE cash_shifts 
SET store_id = 'Tienda Mujeres'
WHERE store_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'tienda_mujeres');

-- Normalizar variantes de "Hombres" a "Tienda Hombres"
UPDATE cash_shifts 
SET store_id = 'Tienda Hombres'
WHERE store_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'tienda_hombres');

-- ============================================================================
-- 5. ACTUALIZAR TABLA USERS (stores array)
-- ============================================================================

-- Actualizar arrays de stores en usuarios
UPDATE users
SET stores = ARRAY(
  SELECT DISTINCT 
    CASE 
      WHEN unnest_val IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'tienda_mujeres') THEN 'Tienda Mujeres'
      WHEN unnest_val IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'tienda_hombres') THEN 'Tienda Hombres'
      ELSE unnest_val
    END
  FROM unnest(stores) AS unnest_val
)
WHERE EXISTS (
  SELECT 1 FROM unnest(stores) AS s 
  WHERE s IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'tienda_mujeres', 
              'TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'tienda_hombres')
);

-- ============================================================================
-- 6. VERIFICACIÓN
-- ============================================================================

-- Verificar que solo existen los dos valores correctos
DO $$
DECLARE
  stock_count INTEGER;
  movements_count INTEGER;
  sales_count INTEGER;
  cash_count INTEGER;
BEGIN
  -- Contar registros con valores correctos en stock
  SELECT COUNT(*) INTO stock_count
  FROM stock
  WHERE warehouse_id IN ('Tienda Mujeres', 'Tienda Hombres');
  
  -- Contar registros con valores correctos en movements
  SELECT COUNT(*) INTO movements_count
  FROM movements
  WHERE warehouse_id IN ('Tienda Mujeres', 'Tienda Hombres');
  
  -- Contar registros con valores correctos en sales
  SELECT COUNT(*) INTO sales_count
  FROM sales
  WHERE store_id IN ('Tienda Mujeres', 'Tienda Hombres');
  
  -- Contar registros con valores correctos en cash_shifts
  SELECT COUNT(*) INTO cash_count
  FROM cash_shifts
  WHERE store_id IN ('Tienda Mujeres', 'Tienda Hombres');
  
  RAISE NOTICE '=== VERIFICACIÓN DE NORMALIZACIÓN ===';
  RAISE NOTICE 'Stock normalizados: %', stock_count;
  RAISE NOTICE 'Movimientos normalizados: %', movements_count;
  RAISE NOTICE 'Ventas normalizadas: %', sales_count;
  RAISE NOTICE 'Turnos de caja normalizados: %', cash_count;
  
  -- Verificar si hay valores incorrectos
  IF EXISTS (SELECT 1 FROM stock WHERE warehouse_id NOT IN ('Tienda Mujeres', 'Tienda Hombres')) THEN
    RAISE WARNING 'Aún existen valores no normalizados en stock';
  END IF;
  
  IF EXISTS (SELECT 1 FROM movements WHERE warehouse_id NOT IN ('Tienda Mujeres', 'Tienda Hombres')) THEN
    RAISE WARNING 'Aún existen valores no normalizados en movements';
  END IF;
  
  IF EXISTS (SELECT 1 FROM sales WHERE store_id NOT IN ('Tienda Mujeres', 'Tienda Hombres')) THEN
    RAISE WARNING 'Aún existen valores no normalizados en sales';
  END IF;
  
  IF EXISTS (SELECT 1 FROM cash_shifts WHERE store_id NOT IN ('Tienda Mujeres', 'Tienda Hombres')) THEN
    RAISE WARNING 'Aún existen valores no normalizados en cash_shifts';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE stock IS 'Inventario por tienda. warehouse_id debe ser: "Tienda Mujeres" o "Tienda Hombres"';
COMMENT ON TABLE movements IS 'Movimientos de inventario. warehouse_id debe ser: "Tienda Mujeres" o "Tienda Hombres"';
COMMENT ON TABLE sales IS 'Ventas. store_id debe ser: "Tienda Mujeres" o "Tienda Hombres"';
COMMENT ON TABLE cash_shifts IS 'Turnos de caja. store_id debe ser: "Tienda Mujeres" o "Tienda Hombres"';
