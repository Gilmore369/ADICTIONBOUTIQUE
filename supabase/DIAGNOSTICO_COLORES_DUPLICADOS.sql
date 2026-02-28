-- ============================================================================
-- DIAGNÓSTICO: Productos con mismo nombre pero diferentes base_code
-- ============================================================================

-- Ver productos con el mismo base_name pero diferentes base_code
SELECT 
  base_code,
  base_name,
  color,
  COUNT(DISTINCT id) as variantes,
  SUM((SELECT quantity FROM stock WHERE product_id = products.id LIMIT 1)) as stock_total,
  STRING_AGG(DISTINCT size, ', ' ORDER BY size) as tallas
FROM products
WHERE base_name = 'Pantalón jean Denim'
GROUP BY base_code, base_name, color
ORDER BY base_code;

-- Ver detalles completos de estos productos
SELECT 
  id,
  barcode,
  name,
  base_code,
  base_name,
  color,
  size,
  (SELECT quantity FROM stock WHERE product_id = products.id LIMIT 1) as stock
FROM products
WHERE base_name = 'Pantalón jean Denim'
ORDER BY base_code, size;

-- Verificar cuál debería ser el base_code correcto (el más antiguo)
SELECT 
  base_code,
  MIN(created_at) as fecha_creacion,
  COUNT(*) as total_variantes
FROM products
WHERE base_name = 'Pantalón jean Denim'
GROUP BY base_code
ORDER BY MIN(created_at);
