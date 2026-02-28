-- ============================================================================
-- CORRECCIÓN: Unificar base_code para colores del mismo modelo
-- ============================================================================
-- Este script corrige productos que deberían tener el mismo base_code
-- pero fueron creados con códigos diferentes
-- ============================================================================

BEGIN;

-- Paso 1: Identificar el problema
-- Ver productos con el mismo base_name pero diferentes base_code
SELECT 
  '=== PRODUCTOS A CORREGIR ===' as seccion,
  base_code,
  base_name,
  color,
  COUNT(*) as variantes
FROM products
WHERE base_name = 'Pantalón jean Denim'
GROUP BY base_code, base_name, color
ORDER BY base_code;

-- Paso 2: Corregir base_code
-- Cambiar JEA-0033 a JEA-0004 para que se agrupen
UPDATE products
SET base_code = 'JEA-0004'
WHERE base_code = 'JEA-0033'
  AND base_name = 'Pantalón jean Denim';

-- Paso 3: Actualizar barcodes si es necesario
-- Los barcodes deben ser únicos, así que verificamos que no haya conflictos
DO $$
DECLARE
  conflictos INTEGER;
BEGIN
  -- Contar barcodes duplicados
  SELECT COUNT(*) INTO conflictos
  FROM (
    SELECT barcode, COUNT(*) as cnt
    FROM products
    WHERE base_name = 'Pantalón jean Denim'
    GROUP BY barcode
    HAVING COUNT(*) > 1
  ) duplicados;
  
  IF conflictos > 0 THEN
    RAISE WARNING 'Hay % barcodes duplicados. Revisa manualmente.', conflictos;
  ELSE
    RAISE NOTICE 'No hay conflictos de barcodes. Corrección exitosa.';
  END IF;
END $$;

-- Paso 4: Verificar resultado
SELECT 
  '=== RESULTADO DESPUÉS DE CORRECCIÓN ===' as seccion,
  base_code,
  base_name,
  STRING_AGG(DISTINCT color, ', ') as colores,
  COUNT(*) as total_variantes,
  SUM((SELECT quantity FROM stock WHERE product_id = products.id LIMIT 1)) as stock_total
FROM products
WHERE base_name = 'Pantalón jean Denim'
GROUP BY base_code, base_name
ORDER BY base_code;

-- Paso 5: Ver detalle por color
SELECT 
  '=== DETALLE POR COLOR ===' as seccion,
  p.base_code,
  p.color,
  STRING_AGG(p.size, ', ' ORDER BY p.size) as tallas,
  COUNT(*) as variantes,
  SUM(s.quantity) as stock
FROM products p
LEFT JOIN stock s ON p.id = s.product_id
WHERE p.base_name = 'Pantalón jean Denim'
GROUP BY p.base_code, p.color
ORDER BY p.base_code, p.color;

COMMIT;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
-- Este script unifica el base_code de productos que deberían estar agrupados
-- Después de ejecutar, ambos colores aparecerán en la misma tarjeta del catálogo
