-- ============================================================================
-- Migration: Estandarizar nombres de tiendas a "Tienda Mujeres" y "Tienda Hombres"
-- Date: 2026-02-27
-- ============================================================================
-- Este script corrige la inconsistencia en los nombres de warehouse_id y store_id
-- para usar nombres consistentes y claros en todo el sistema.
-- ============================================================================

-- 1. Actualizar tabla stock (warehouse_id)
-- ============================================================================
UPDATE stock 
SET warehouse_id = 'Tienda Mujeres'
WHERE warehouse_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'mujeres');

UPDATE stock 
SET warehouse_id = 'Tienda Hombres'
WHERE warehouse_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'hombres');

-- 2. Actualizar tabla movements (warehouse_id)
-- ============================================================================
UPDATE movements 
SET warehouse_id = 'Tienda Mujeres'
WHERE warehouse_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'mujeres');

UPDATE movements 
SET warehouse_id = 'Tienda Hombres'
WHERE warehouse_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'hombres');

-- 3. Actualizar tabla sales (store_id)
-- ============================================================================
UPDATE sales 
SET store_id = 'Tienda Mujeres'
WHERE store_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'mujeres');

UPDATE sales 
SET store_id = 'Tienda Hombres'
WHERE store_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'hombres');

-- 4. Actualizar tabla cash_shifts (store_id)
-- ============================================================================
UPDATE cash_shifts 
SET store_id = 'Tienda Mujeres'
WHERE store_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'mujeres');

UPDATE cash_shifts 
SET store_id = 'Tienda Hombres'
WHERE store_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'hombres');

-- 5. Actualizar tabla users (stores array)
-- ============================================================================
UPDATE users
SET stores = ARRAY(
  SELECT CASE 
    WHEN unnest IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'mujeres') THEN 'Tienda Mujeres'
    WHEN unnest IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'hombres') THEN 'Tienda Hombres'
    ELSE unnest
  END
  FROM unnest(stores)
);

-- 6. Actualizar stores table si existe (de la migración 20260223000003)
-- ============================================================================
UPDATE stores 
SET code = 'Tienda Mujeres', name = 'Tienda Mujeres'
WHERE code IN ('MUJERES', 'Mujeres', 'TIENDA_MUJERES');

UPDATE stores 
SET code = 'Tienda Hombres', name = 'Tienda Hombres'
WHERE code IN ('HOMBRES', 'Hombres', 'TIENDA_HOMBRES');

-- 7. Verificar resultados
-- ============================================================================
DO $$
DECLARE
  stock_mujeres INTEGER;
  stock_hombres INTEGER;
  movements_mujeres INTEGER;
  movements_hombres INTEGER;
  sales_mujeres INTEGER;
  sales_hombres INTEGER;
BEGIN
  SELECT COUNT(*) INTO stock_mujeres FROM stock WHERE warehouse_id = 'Tienda Mujeres';
  SELECT COUNT(*) INTO stock_hombres FROM stock WHERE warehouse_id = 'Tienda Hombres';
  SELECT COUNT(*) INTO movements_mujeres FROM movements WHERE warehouse_id = 'Tienda Mujeres';
  SELECT COUNT(*) INTO movements_hombres FROM movements WHERE warehouse_id = 'Tienda Hombres';
  SELECT COUNT(*) INTO sales_mujeres FROM sales WHERE store_id = 'Tienda Mujeres';
  SELECT COUNT(*) INTO sales_hombres FROM sales WHERE store_id = 'Tienda Hombres';
  
  RAISE NOTICE '=== RESULTADOS DE LA MIGRACIÓN ===';
  RAISE NOTICE 'Stock - Tienda Mujeres: % registros', stock_mujeres;
  RAISE NOTICE 'Stock - Tienda Hombres: % registros', stock_hombres;
  RAISE NOTICE 'Movimientos - Tienda Mujeres: % registros', movements_mujeres;
  RAISE NOTICE 'Movimientos - Tienda Hombres: % registros', movements_hombres;
  RAISE NOTICE 'Ventas - Tienda Mujeres: % registros', sales_mujeres;
  RAISE NOTICE 'Ventas - Tienda Hombres: % registros', sales_hombres;
  RAISE NOTICE '===================================';
END $$;

-- 8. Comentarios para documentación
-- ============================================================================
COMMENT ON TABLE stock IS 'Inventario por tienda física: "Tienda Mujeres" y "Tienda Hombres"';
COMMENT ON TABLE movements IS 'Movimientos de inventario por tienda: "Tienda Mujeres" y "Tienda Hombres"';
COMMENT ON TABLE sales IS 'Ventas por tienda: "Tienda Mujeres" y "Tienda Hombres"';
COMMENT ON TABLE cash_shifts IS 'Turnos de caja por tienda: "Tienda Mujeres" y "Tienda Hombres"';
COMMENT ON COLUMN stock.warehouse_id IS 'ID de la tienda física donde está el stock: "Tienda Mujeres" o "Tienda Hombres"';
COMMENT ON COLUMN movements.warehouse_id IS 'ID de la tienda donde ocurrió el movimiento: "Tienda Mujeres" o "Tienda Hombres"';
COMMENT ON COLUMN sales.store_id IS 'ID de la tienda donde se realizó la venta: "Tienda Mujeres" o "Tienda Hombres"';
COMMENT ON COLUMN cash_shifts.store_id IS 'ID de la tienda del turno de caja: "Tienda Mujeres" o "Tienda Hombres"';
