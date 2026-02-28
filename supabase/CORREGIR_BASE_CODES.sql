-- ============================================================================
-- CORREGIR BASE CODES - Actualizar base_codes en product_images
-- ============================================================================

-- 1. Ver el problema actual
SELECT 
  pi.base_code as base_code_actual,
  STRING_AGG(DISTINCT REGEXP_REPLACE(p.barcode, '-[^-]+$', ''), ', ') as base_codes_productos_similares
FROM product_images pi
LEFT JOIN products p ON p.barcode LIKE pi.base_code || '%' OR pi.base_code LIKE REGEXP_REPLACE(p.barcode, '-[^-]+$', '') || '%'
WHERE p.active = true
GROUP BY pi.base_code;

-- 2. Actualizar base_codes incorrectos
-- Ejemplo: Si tienes "CHA-001" en product_images pero los productos son "CHA-L", "CHA-M"
-- Necesitas cambiar "CHA-001" a "CHA"

-- OPCIÓN A: Si tus imágenes tienen formato "XXX-001" y productos "XXX-L"
UPDATE product_images
SET base_code = REGEXP_REPLACE(base_code, '-\d+$', '')
WHERE base_code ~ '-\d+$';

-- OPCIÓN B: Si tus imágenes tienen códigos de barras largos como "7501234567894"
-- y necesitas mapearlos manualmente, usa:
-- UPDATE product_images SET base_code = 'CHA' WHERE base_code = '7501234567894';

-- 3. Verificar resultado
SELECT 
  pi.base_code,
  COUNT(DISTINCT p.id) as productos_vinculados,
  STRING_AGG(DISTINCT p.barcode, ', ') as ejemplos_productos
FROM product_images pi
LEFT JOIN products p ON REGEXP_REPLACE(p.barcode, '-[^-]+$', '') = pi.base_code
WHERE p.active = true
GROUP BY pi.base_code
ORDER BY productos_vinculados DESC;

-- 4. Copiar image_url de products a product_images si no existe
INSERT INTO product_images (base_code, color, is_primary, public_url, storage_path)
SELECT DISTINCT
  REGEXP_REPLACE(barcode, '-[^-]+$', '') as base_code,
  NULL as color,
  true as is_primary,
  image_url as public_url,
  image_url as storage_path
FROM products
WHERE active = true
  AND image_url IS NOT NULL
  AND image_url != ''
  AND NOT EXISTS (
    SELECT 1 
    FROM product_images pi 
    WHERE pi.base_code = REGEXP_REPLACE(products.barcode, '-[^-]+$', '')
      AND pi.is_primary = true
  )
ON CONFLICT DO NOTHING;

-- 5. Actualizar products.image_url con las imágenes de product_images
UPDATE products p
SET image_url = pi.public_url
FROM product_images pi
WHERE pi.base_code = REGEXP_REPLACE(p.barcode, '-[^-]+$', '')
  AND pi.is_primary = true
  AND (p.image_url IS NULL OR p.image_url = '');
