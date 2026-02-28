-- Script simple para verificar imágenes

-- 1. ¿Existe la tabla product_images?
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'product_images'
) as tabla_existe;

-- 2. ¿Cuántas imágenes hay?
SELECT COUNT(*) as total_imagenes FROM product_images;

-- 3. Ver todas las imágenes
SELECT 
  base_code,
  color,
  is_primary,
  public_url
FROM product_images
ORDER BY base_code, is_primary DESC;

-- 4. ¿Cuántos productos tienen image_url?
SELECT 
  COUNT(*) as total_productos,
  COUNT(image_url) as con_image_url
FROM products
WHERE active = true;

-- 5. Ver algunos productos con image_url
SELECT 
  barcode,
  name,
  image_url
FROM products
WHERE active = true 
  AND image_url IS NOT NULL
LIMIT 10;

-- 6. Verificar bucket de storage
SELECT 
  id,
  name,
  public
FROM storage.buckets
WHERE name = 'product-images';
