-- Debug: Verificar datos para el catálogo visual

-- 1. Ver productos activos y sus imágenes
SELECT 
  p.barcode,
  p.name,
  p.image_url as product_image_url,
  pi.public_url as product_images_url,
  pi.is_primary,
  pi.color
FROM products p
LEFT JOIN product_images pi ON (
  CASE 
    WHEN p.barcode LIKE '%-%' THEN regexp_replace(p.barcode, '-[^-]+$', '')
    ELSE p.id::text
  END
) = pi.base_code AND pi.is_primary = true
WHERE p.active = true
ORDER BY p.barcode
LIMIT 20;

-- 2. Contar productos con y sin imágenes
SELECT 
  COUNT(*) as total_productos,
  COUNT(p.image_url) as con_image_url,
  COUNT(pi.public_url) as con_product_images
FROM products p
LEFT JOIN product_images pi ON (
  CASE 
    WHEN p.barcode LIKE '%-%' THEN regexp_replace(p.barcode, '-[^-]+$', '')
    ELSE p.id::text
  END
) = pi.base_code AND pi.is_primary = true
WHERE p.active = true;

-- 3. Ver todas las imágenes en product_images
SELECT 
  base_code,
  color,
  is_primary,
  LEFT(public_url, 80) as url_preview
FROM product_images
ORDER BY base_code, is_primary DESC;

-- 4. Ver base_codes únicos de productos
SELECT 
  CASE 
    WHEN barcode LIKE '%-%' THEN regexp_replace(barcode, '-[^-]+$', '')
    ELSE id::text
  END as base_code,
  COUNT(*) as variantes
FROM products
WHERE active = true
GROUP BY 
  CASE 
    WHEN barcode LIKE '%-%' THEN regexp_replace(barcode, '-[^-]+$', '')
    ELSE id::text
  END
ORDER BY base_code
LIMIT 20;
