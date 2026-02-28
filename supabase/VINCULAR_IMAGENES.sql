-- ============================================================================
-- VINCULAR IMAGENES - Diagnosticar y corregir vínculos entre imágenes y productos
-- ============================================================================

-- 1. Ver qué base_codes existen en products
SELECT DISTINCT
  REGEXP_REPLACE(barcode, '-[^-]+$', '') as base_code_producto,
  COUNT(*) as variantes,
  STRING_AGG(DISTINCT size, ', ') as tallas,
  MAX(name) as ejemplo_nombre
FROM products
WHERE active = true
GROUP BY REGEXP_REPLACE(barcode, '-[^-]+$', '')
ORDER BY variantes DESC
LIMIT 20;

-- 2. Ver qué base_codes existen en product_images
SELECT 
  base_code as base_code_imagen,
  color,
  is_primary,
  LEFT(public_url, 80) as url_preview
FROM product_images
ORDER BY base_code, is_primary DESC;

-- 3. Comparar: ¿Qué imágenes NO tienen productos?
SELECT 
  pi.base_code as imagen_sin_producto,
  pi.color,
  pi.public_url
FROM product_images pi
WHERE NOT EXISTS (
  SELECT 1 
  FROM products p 
  WHERE REGEXP_REPLACE(p.barcode, '-[^-]+$', '') = pi.base_code
    AND p.active = true
);

-- 4. Comparar: ¿Qué productos NO tienen imágenes?
SELECT 
  REGEXP_REPLACE(p.barcode, '-[^-]+$', '') as producto_sin_imagen,
  MAX(p.name) as nombre,
  COUNT(*) as variantes
FROM products p
WHERE p.active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM product_images pi 
    WHERE pi.base_code = REGEXP_REPLACE(p.barcode, '-[^-]+$', '')
  )
GROUP BY REGEXP_REPLACE(p.barcode, '-[^-]+$', '')
LIMIT 20;

-- 5. SOLUCIÓN: Actualizar products.image_url con las imágenes de product_images
UPDATE products p
SET image_url = (
  SELECT pi.public_url
  FROM product_images pi
  WHERE pi.base_code = REGEXP_REPLACE(p.barcode, '-[^-]+$', '')
    AND pi.is_primary = true
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM product_images pi
  WHERE pi.base_code = REGEXP_REPLACE(p.barcode, '-[^-]+$', '')
    AND pi.is_primary = true
)
AND p.active = true;

-- 6. Verificar resultado
SELECT 
  REGEXP_REPLACE(barcode, '-[^-]+$', '') as base_code,
  barcode,
  name,
  CASE 
    WHEN image_url IS NOT NULL THEN 'SI'
    ELSE 'NO'
  END as tiene_imagen,
  LEFT(image_url, 60) as url_preview
FROM products
WHERE active = true
ORDER BY base_code, size
LIMIT 30;

-- 7. Contar productos con y sin imagen
SELECT 
  'Con imagen' as estado,
  COUNT(DISTINCT REGEXP_REPLACE(barcode, '-[^-]+$', '')) as modelos
FROM products
WHERE active = true AND image_url IS NOT NULL

UNION ALL

SELECT 
  'Sin imagen' as estado,
  COUNT(DISTINCT REGEXP_REPLACE(barcode, '-[^-]+$', '')) as modelos
FROM products
WHERE active = true AND (image_url IS NULL OR image_url = '');
