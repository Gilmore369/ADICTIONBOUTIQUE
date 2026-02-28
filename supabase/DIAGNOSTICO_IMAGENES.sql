-- ============================================================================
-- DIAGNÓSTICO DE IMÁGENES - Ver estado actual y problemas
-- ============================================================================

-- 1. Ver todas las imágenes en product_images
SELECT 
  base_code,
  color,
  is_primary,
  LEFT(public_url, 80) as url_preview,
  created_at
FROM product_images
ORDER BY base_code, is_primary DESC, created_at DESC;

-- 2. Ver productos con sus códigos base y colores
SELECT 
  REGEXP_REPLACE(barcode, '-[^-]+$', '') as base_code,
  barcode,
  REGEXP_REPLACE(name, ' - [^-\s][^-]*$', '') as base_name,
  size,
  color,
  image_url IS NOT NULL as tiene_image_url
FROM products
WHERE active = true
ORDER BY base_code, size
LIMIT 30;

-- 3. Contar productos por base_code
SELECT 
  REGEXP_REPLACE(barcode, '-[^-]+$', '') as base_code,
  COUNT(*) as variantes,
  STRING_AGG(DISTINCT size, ', ') as tallas,
  STRING_AGG(DISTINCT color, ', ') as colores,
  COUNT(DISTINCT CASE WHEN image_url IS NOT NULL THEN 1 END) as con_imagen
FROM products
WHERE active = true
GROUP BY REGEXP_REPLACE(barcode, '-[^-]+$', '')
ORDER BY variantes DESC
LIMIT 20;

-- 4. Ver qué base_codes tienen imágenes vs productos
SELECT 
  COALESCE(p.base_code, pi.base_code) as base_code,
  p.variantes as productos_count,
  pi.imagenes as imagenes_count,
  CASE 
    WHEN p.base_code IS NULL THEN 'Solo imágenes (huérfanas)'
    WHEN pi.base_code IS NULL THEN 'Solo productos (sin imágenes)'
    ELSE 'OK'
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
ORDER BY estado, base_code;

-- 5. Ver el bucket de storage
SELECT 
  name,
  id,
  created_at,
  updated_at
FROM storage.buckets
WHERE name = 'product-images';

-- 6. Ver archivos en el bucket
SELECT 
  name,
  bucket_id,
  LEFT(metadata::text, 100) as metadata_preview,
  created_at
FROM storage.objects
WHERE bucket_id = 'product-images'
ORDER BY created_at DESC
LIMIT 20;
