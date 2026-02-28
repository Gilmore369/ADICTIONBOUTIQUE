-- Debug: Verificar cómo está almacenado el stock
-- Este script ayuda a identificar si el stock usa warehouse_id (TEXT) o warehouse_uuid (UUID)

-- 1. Ver algunos registros de stock
SELECT 
  id,
  product_id,
  warehouse_id,
  warehouse_uuid,
  quantity,
  created_at
FROM stock
LIMIT 10;

-- 2. Contar registros por tipo de warehouse
SELECT 
  'Con warehouse_id (TEXT)' as tipo,
  COUNT(*) as cantidad
FROM stock
WHERE warehouse_id IS NOT NULL AND warehouse_id != ''
UNION ALL
SELECT 
  'Con warehouse_uuid (UUID)' as tipo,
  COUNT(*) as cantidad
FROM stock
WHERE warehouse_uuid IS NOT NULL;

-- 3. Ver los warehouses disponibles
SELECT 
  id as warehouse_uuid,
  name as warehouse_name,
  store_id
FROM warehouses
ORDER BY name;

-- 4. Ver stock de un producto específico (ejemplo: primer producto)
SELECT 
  s.id,
  p.name as product_name,
  p.barcode,
  s.warehouse_id,
  s.warehouse_uuid,
  w.name as warehouse_name,
  s.quantity
FROM stock s
JOIN products p ON s.product_id = p.id
LEFT JOIN warehouses w ON s.warehouse_uuid = w.id
LIMIT 10;

-- 5. Verificar si hay stock con warehouse_id = 'TIENDA_MUJERES'
SELECT 
  COUNT(*) as registros_tienda_mujeres
FROM stock
WHERE warehouse_id = 'TIENDA_MUJERES';

-- 6. Verificar si hay stock con warehouse_uuid que corresponda a TIENDA_MUJERES
SELECT 
  COUNT(*) as registros_tienda_mujeres_uuid
FROM stock s
JOIN warehouses w ON s.warehouse_uuid = w.id
WHERE w.name = 'TIENDA_MUJERES' OR w.store_id = 'TIENDA_MUJERES';
