-- ============================================================================
-- CORRECCIÓN COMPLETA: Tiendas + Líneas
-- ============================================================================
-- Este script ejecuta dos correcciones:
-- 1. Estandariza nombres de tiendas (TIENDA_MUJERES → Tienda Mujeres)
-- 2. Corrige line_id de productos para que coincida con su categoría
-- ============================================================================

BEGIN;

-- ============================================================================
-- PARTE 1: ESTANDARIZAR NOMBRES DE TIENDAS
-- ============================================================================

-- 1.1 Stock
UPDATE stock 
SET warehouse_id = 'Tienda Mujeres'
WHERE warehouse_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'tienda_mujeres');

UPDATE stock 
SET warehouse_id = 'Tienda Hombres'
WHERE warehouse_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'tienda_hombres');

-- 1.2 Movements
UPDATE movements 
SET warehouse_id = 'Tienda Mujeres'
WHERE warehouse_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'tienda_mujeres');

UPDATE movements 
SET warehouse_id = 'Tienda Hombres'
WHERE warehouse_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'tienda_hombres');

-- 1.3 Sales
UPDATE sales 
SET store_id = 'Tienda Mujeres'
WHERE store_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'tienda_mujeres');

UPDATE sales 
SET store_id = 'Tienda Hombres'
WHERE store_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'tienda_hombres');

-- 1.4 Cash Shifts
UPDATE cash_shifts 
SET store_id = 'Tienda Mujeres'
WHERE store_id IN ('TIENDA_MUJERES', 'Mujeres', 'MUJERES', 'tienda_mujeres');

UPDATE cash_shifts 
SET store_id = 'Tienda Hombres'
WHERE store_id IN ('TIENDA_HOMBRES', 'Hombres', 'HOMBRES', 'tienda_hombres');

-- 1.5 Users
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
-- PARTE 2: CORREGIR LINE_ID DE PRODUCTOS
-- ============================================================================

-- 2.1 Corregir line_id para que coincida con la línea de su categoría
UPDATE products p
SET line_id = c.line_id
FROM categories c
WHERE p.category_id = c.id
  AND p.line_id != c.line_id;

-- 2.2 Actualizar warehouse_id en stock según la línea correcta
UPDATE stock s
SET warehouse_id = CASE 
  WHEN l.name = 'Mujeres' THEN 'Tienda Mujeres'
  WHEN l.name = 'Hombres' THEN 'Tienda Hombres'
  WHEN l.name = 'Niños' THEN 'Tienda Mujeres'  -- Niños en tienda mujeres por defecto
  WHEN l.name = 'Accesorios' THEN 'Tienda Mujeres'  -- Accesorios en tienda mujeres por defecto
  ELSE s.warehouse_id
END
FROM products p
JOIN lines l ON p.line_id = l.id
WHERE s.product_id = p.id;

-- ============================================================================
-- VERIFICACIÓN Y RESUMEN
-- ============================================================================

-- Verificar que no quedan inconsistencias
DO $$
DECLARE
  stock_mujeres INTEGER;
  stock_hombres INTEGER;
  productos_incorrectos INTEGER;
BEGIN
  -- Contar stock por tienda
  SELECT COUNT(*) INTO stock_mujeres FROM stock WHERE warehouse_id = 'Tienda Mujeres';
  SELECT COUNT(*) INTO stock_hombres FROM stock WHERE warehouse_id = 'Tienda Hombres';
  
  -- Verificar productos con line_id incorrecto
  SELECT COUNT(*) INTO productos_incorrectos
  FROM products p
  JOIN categories c ON p.category_id = c.id
  WHERE p.line_id != c.line_id;
  
  RAISE NOTICE '=== CORRECCIÓN COMPLETADA ===';
  RAISE NOTICE 'Stock en Tienda Mujeres: %', stock_mujeres;
  RAISE NOTICE 'Stock en Tienda Hombres: %', stock_hombres;
  RAISE NOTICE 'Productos con line_id incorrecto: %', productos_incorrectos;
  
  IF productos_incorrectos = 0 THEN
    RAISE NOTICE 'ÉXITO: Todos los productos tienen line_id correcto';
  ELSE
    RAISE WARNING 'Aún hay % productos con line_id incorrecto', productos_incorrectos;
  END IF;
END $$;

-- Mostrar resumen detallado por tienda y línea
SELECT 
  '=== RESUMEN FINAL: LÍNEAS POR TIENDA ===' as seccion,
  s.warehouse_id as tienda,
  l.name as linea,
  COUNT(DISTINCT p.base_code) as modelos,
  COUNT(DISTINCT p.id) as variantes,
  SUM(s.quantity) as stock_total
FROM stock s
JOIN products p ON s.product_id = p.id
JOIN lines l ON p.line_id = l.id
GROUP BY s.warehouse_id, l.name
ORDER BY s.warehouse_id, l.name;

COMMIT;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
COMMENT ON TABLE stock IS 'Inventario por tienda: "Tienda Mujeres" o "Tienda Hombres"';
COMMENT ON TABLE products IS 'Productos: line_id debe coincidir con la línea de su categoría';
COMMENT ON COLUMN products.line_id IS 'Línea del producto - debe coincidir con categories.line_id';
COMMENT ON COLUMN products.category_id IS 'Categoría del producto - determina la línea correcta';
