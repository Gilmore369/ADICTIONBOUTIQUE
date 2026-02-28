-- ============================================================================
-- VERIFICACIÓN COMPLETA DEL ESTADO DE PRODUCTOS E IMÁGENES
-- ============================================================================

-- 1. Verificar productos y sus códigos base
SELECT 
  'PRODUCTOS' as tipo,
  COUNT(*) as total,
  COUNT(DISTINCT REGEXP_REPLACE(barcode, '-[^-]+$', '')) as modelos_unicos,
  COUNT(DISTINCT image_url) FILTER (WHERE image_url IS NOT NULL) as con_image_url
FROM products
WHERE active = true;

-- 2. Verificar tabla product_images
SELECT 
  'PRODUCT_IMAGES' as tipo,
  COUNT(*) as total_imagenes,
  COUNT(DISTINCT base_code) as modelos_con_imagenes,
  COUNT(*) FILTER (WHERE is_primary = true) as imagenes_primarias,
  COUNT(*) FILTER (WHERE color IS NOT NULL) as imagenes_con_color
FROM product_images;

-- 3. Ver ejemplos de productos con sus imágenes
SELECT 
  p.barcode,
  p.name,
  REGEXP_REPLACE(p.barcode, '-[^-]+$', '') as base_code,
  p.image_url as product_image_url,
  pi.public_url as product_images_url,
  pi.is_primary,
  pi.color
FROM products p
LEFT JOIN product_images pi ON REGEXP_REPLACE(p.barcode, '-[^-]+$', '') = pi.base_code
WHERE p.active = true
ORDER BY p.barcode
LIMIT 20;

-- 4. Verificar modelos que tienen imágenes en product_images
SELECT 
  pi.base_code,
  COUNT(*) as num_imagenes,
  COUNT(*) FILTER (WHERE is_primary = true) as num_primarias,
  STRING_AGG(DISTINCT color, ', ') as colores,
  MAX(public_url) as ejemplo_url
FROM product_images pi
GROUP BY pi.base_code
ORDER BY pi.base_code;

-- 5. Verificar storage bucket
SELECT 
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'product-images';

-- 6. Verificar políticas de storage
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%product%';
