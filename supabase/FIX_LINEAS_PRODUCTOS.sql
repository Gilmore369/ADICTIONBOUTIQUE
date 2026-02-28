-- ============================================================================
-- CORRECCIÓN: Alinear line_id de productos con la línea de su categoría
-- ============================================================================
-- Este script corrige productos que tienen un line_id que no coincide
-- con la línea de su categoría
-- ============================================================================

BEGIN;

-- 1. Mostrar productos que se van a corregir
-- ============================================================================
SELECT 
  '=== PRODUCTOS A CORREGIR ===' as info,
  p.barcode,
  p.name,
  l.name as linea_actual,
  cl.name as linea_correcta,
  c.name as categoria
FROM products p
JOIN lines l ON p.line_id = l.id
JOIN categories c ON p.category_id = c.id
JOIN lines cl ON c.line_id = cl.id
WHERE l.id != cl.id
ORDER BY p.base_code;

-- 2. Corregir line_id de productos para que coincida con la línea de su categoría
-- ============================================================================
UPDATE products p
SET line_id = c.line_id
FROM categories c
WHERE p.category_id = c.id
  AND p.line_id != c.line_id;

-- 3. Actualizar stock para que coincida con la nueva línea
-- ============================================================================
-- Los productos de línea "Mujeres" deben estar en "Tienda Mujeres"
-- Los productos de línea "Hombres" deben estar en "Tienda Hombres"

UPDATE stock s
SET warehouse_id = CASE 
  WHEN l.name = 'Mujeres' THEN 'Tienda Mujeres'
  WHEN l.name = 'Hombres' THEN 'Tienda Hombres'
  WHEN l.name = 'Niños' THEN 'Tienda Mujeres'  -- Por defecto, niños en tienda mujeres
  ELSE s.warehouse_id
END
FROM products p
JOIN lines l ON p.line_id = l.id
WHERE s.product_id = p.id;

-- 4. Verificar corrección
-- ============================================================================
DO $$
DECLARE
  productos_corregidos INTEGER;
  inconsistencias INTEGER;
BEGIN
  -- Contar productos que fueron corregidos
  SELECT COUNT(*) INTO productos_corregidos
  FROM products p
  JOIN categories c ON p.category_id = c.id
  WHERE p.line_id = c.line_id;
  
  -- Verificar si aún hay inconsistencias
  SELECT COUNT(*) INTO inconsistencias
  FROM products p
  JOIN categories c ON p.category_id = c.id
  WHERE p.line_id != c.line_id;
  
  RAISE NOTICE '=== RESULTADO DE LA CORRECCIÓN ===';
  RAISE NOTICE 'Productos con line_id correcto: %', productos_corregidos;
  RAISE NOTICE 'Inconsistencias restantes: %', inconsistencias;
  
  IF inconsistencias > 0 THEN
    RAISE WARNING 'Aún hay % productos con inconsistencias', inconsistencias;
  ELSE
    RAISE NOTICE '✅ Todos los productos tienen line_id correcto';
  END IF;
END $$;

-- 5. Mostrar resumen final por tienda
-- ============================================================================
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
COMMENT ON TABLE products IS 'Productos: line_id debe coincidir con la línea de su categoría';
COMMENT ON COLUMN products.line_id IS 'Línea del producto - debe coincidir con categories.line_id';
COMMENT ON COLUMN products.category_id IS 'Categoría del producto - determina la línea correcta';
