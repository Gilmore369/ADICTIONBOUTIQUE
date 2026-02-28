-- Verificar y crear tabla product_images si no existe

-- Crear tabla product_images
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

-- Verificar productos con imágenes
SELECT 
  COUNT(*) as total_productos,
  COUNT(image_url) as productos_con_imagen,
  ROUND(COUNT(image_url)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as porcentaje_con_imagen
FROM products
WHERE active = true;

-- Ver algunos productos con imágenes
SELECT 
  barcode,
  name,
  image_url
FROM products
WHERE active = true 
  AND image_url IS NOT NULL
LIMIT 10;

-- Ver imágenes en product_images
SELECT 
  base_code,
  color,
  is_primary,
  public_url
FROM product_images
ORDER BY base_code, is_primary DESC
LIMIT 10;
