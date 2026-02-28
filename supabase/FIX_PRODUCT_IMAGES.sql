-- ============================================================================
-- FIX PRODUCT IMAGES - Corregir configuración de imágenes de productos
-- ============================================================================

-- 1. Verificar tabla product_images existe
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_code TEXT NOT NULL,
  color TEXT,
  is_primary BOOLEAN DEFAULT false,
  public_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_images_base_code ON product_images(base_code);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON product_images(base_code, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_product_images_color ON product_images(base_code, color);

-- 2. Sincronizar image_url de products con product_images
-- Actualizar products.image_url con la imagen primaria de product_images
UPDATE products p
SET image_url = pi.public_url
FROM product_images pi
WHERE pi.base_code = REGEXP_REPLACE(p.barcode, '-[^-]+$', '')
  AND pi.is_primary = true
  AND pi.color IS NULL
  AND (p.image_url IS NULL OR p.image_url = '');

-- 3. Verificar estado actual
SELECT 
  'Total productos' as tipo,
  COUNT(*) as cantidad
FROM products
WHERE active = true

UNION ALL

SELECT 
  'Productos con image_url' as tipo,
  COUNT(*) as cantidad
FROM products
WHERE active = true AND image_url IS NOT NULL AND image_url != ''

UNION ALL

SELECT 
  'Imágenes en product_images' as tipo,
  COUNT(*) as cantidad
FROM product_images

UNION ALL

SELECT 
  'Imágenes primarias' as tipo,
  COUNT(*) as cantidad
FROM product_images
WHERE is_primary = true;

-- 4. Ver productos con imágenes
SELECT 
  REGEXP_REPLACE(p.barcode, '-[^-]+$', '') as base_code,
  p.name,
  p.image_url as product_image_url,
  pi.public_url as primary_image_url,
  pi.is_primary
FROM products p
LEFT JOIN product_images pi ON pi.base_code = REGEXP_REPLACE(p.barcode, '-[^-]+$', '')
  AND pi.is_primary = true
WHERE p.active = true
  AND (p.image_url IS NOT NULL OR pi.public_url IS NOT NULL)
LIMIT 20;

-- 5. Encontrar productos sin imagen que deberían tenerla
SELECT DISTINCT
  REGEXP_REPLACE(p.barcode, '-[^-]+$', '') as base_code,
  MAX(p.name) as product_name,
  COUNT(DISTINCT p.id) as variants,
  BOOL_OR(p.image_url IS NOT NULL) as has_product_image,
  BOOL_OR(pi.public_url IS NOT NULL) as has_product_images_entry
FROM products p
LEFT JOIN product_images pi ON pi.base_code = REGEXP_REPLACE(p.barcode, '-[^-]+$', '')
WHERE p.active = true
GROUP BY REGEXP_REPLACE(p.barcode, '-[^-]+$', '')
HAVING BOOL_OR(pi.public_url IS NOT NULL) = true
  AND BOOL_OR(p.image_url IS NOT NULL) = false
LIMIT 20;
