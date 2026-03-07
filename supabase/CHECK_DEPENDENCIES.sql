-- Script para verificar dependencias antes de eliminar
-- Usar este script para entender qué registros dependen de otros

-- Verificar productos que usan una categoría específica
SELECT 
  'products' as tabla,
  COUNT(*) as cantidad,
  category_id
FROM products 
WHERE category_id = 'CATEGORY_ID_AQUI'
  AND active = true
GROUP BY category_id;

-- Verificar productos que usan una línea específica
SELECT 
  'products' as tabla,
  COUNT(*) as cantidad,
  line_id
FROM products 
WHERE line_id = 'LINE_ID_AQUI'
  AND active = true
GROUP BY line_id;

-- Verificar categorías que usan una línea específica
SELECT 
  'categories' as tabla,
  COUNT(*) as cantidad,
  line_id
FROM categories 
WHERE line_id = 'LINE_ID_AQUI'
  AND active = true
GROUP BY line_id;

-- Verificar tallas que usan una categoría específica
SELECT 
  'sizes' as tabla,
  COUNT(*) as cantidad,
  category_id
FROM sizes 
WHERE category_id = 'CATEGORY_ID_AQUI'
  AND active = true
GROUP BY category_id;

-- Verificar productos que usan una marca específica
SELECT 
  'products' as tabla,
  COUNT(*) as cantidad,
  brand_id
FROM products 
WHERE brand_id = 'BRAND_ID_AQUI'
  AND active = true
GROUP BY brand_id;

-- Verificar productos que usan un proveedor específico
SELECT 
  'products' as tabla,
  COUNT(*) as cantidad,
  supplier_id
FROM products 
WHERE supplier_id = 'SUPPLIER_ID_AQUI'
  AND active = true
GROUP BY supplier_id;
