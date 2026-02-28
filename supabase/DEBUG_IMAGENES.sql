-- ============================================================================
-- DEBUG IMAGENES - Diagnosticar por qué no se muestran las imágenes
-- ============================================================================

-- 1. Ver qué base_codes existen en products
SELECT DISTINCT
  REGEXP_REPLACE(barcode, '-[^-]+$', '') as base_code_producto,
  COUNT(*) as variantes,
  STRING_AGG(DISTINCT barcode, ', ') as ejemplos_barcodes
FROM products
WHERE active = true
GROUP BY REGEXP_REPLACE(barcode, '-[^-]+$', '')
ORDER BY variantes DESC
LIMIT 10;

-- 2. Ver qué base_codes existen en product_images
SELECT 
  base_code as base_code_imagen,
  color,
  is_primary,
  LEFT(public_url, 80) as url_preview
FROM product_images
ORDER BY base_code, is_primary DESC;

-- 3. Comparar: ¿Coinciden los base_codes?
SELECT 
  COALESCE(p.base_code, pi.base_code) as base_code,
  p.variantes as productos,
  pi.imagenes as imagenes,
  CASE 
    WHEN p.base_code IS NULL THEN '❌ Solo imagen (sin productos)'
    WHEN pi.base_code IS NULL THEN '❌ Solo productos (sin imagen)'
    ELSE '✅ OK'
  END as estado
FROM (
  SELECT 
    REGEXP_REPLACE(barcode, '-[^-]+$', '') as base_code,
    COUNT(*) as variantes
  FROM products
  WHERE active = true
  GROUP BY REGEXP_REPLACE(barcode, '-[^-]+$', '')
) p
FULL OUTER JOIN (
  SELECT 
    base_code,
    COUNT(*) as imagenes
  FROM product_images
  GROUP BY base_code
) pi ON p.base_code = pi.base_code
ORDER BY estado, base_code
LIMIT 20;

-- 4. Ver productos específicos con sus imágenes
SELECT 
  p.barcode,
  p.name,
  REGEXP_REPLACE(p.barcode, '-[^-]+$', '') as base_code_calculado,
  p.image_url as image_url_producto,
  pi.base_code as base_code_imagen,
  pi.public_url as public_url_imagen,
  pi.is_primary
FROM products p
LEFT JOIN product_images pi ON pi.base_code = REGEXP_REPLACE(p.barcode, '-[^-]+$', '')
  AND pi.is_primary = true
WHERE p.active = true
ORDER BY p.barcode
LIMIT 20;

-- 5. Verificar si hay productos con image_url
SELECT 
  barcode,
  name,
  image_url
FROM products
WHERE active = true
  AND image_url IS NOT NULL
  AND image_url != ''
LIMIT 10;
