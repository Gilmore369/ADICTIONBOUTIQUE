-- ============================================================================
-- DIAGNÓSTICO: Verificar base_code de productos
-- ============================================================================

-- Ver productos del modelo "Pantalón jean Denim"
SELECT 
  base_code,
  base_name,
  color,
  size,
  barcode,
  COUNT(*) OVER (PARTITION BY base_code) as productos_con_mismo_codigo
FROM products
WHERE base_name LIKE '%Pantalón jean Denim%'
ORDER BY base_code, color, size;

-- Ver agrupación por base_code
SELECT 
  base_code,
  base_name,
  STRING_AGG(DISTINCT color, ', ') as colores,
  STRING_AGG(DISTINCT size, ', ') as tallas,
  COUNT(*) as total_variantes
FROM products
WHERE base_name LIKE '%Pantalón jean Denim%'
GROUP BY base_code, base_name
ORDER BY base_code;

-- Ver stock por base_code y color
SELECT 
  p.base_code,
  p.base_name,
  p.color,
  COUNT(DISTINCT p.id) as variantes,
  SUM(s.quantity) as stock_total
FROM products p
LEFT JOIN stock s ON p.id = s.product_id
WHERE p.base_name LIKE '%Pantalón jean Denim%'
GROUP BY p.base_code, p.base_name, p.color
ORDER BY p.base_code, p.color;
