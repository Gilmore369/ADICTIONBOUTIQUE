-- ============================================================================
-- DEBUG: Verificar por qué el POS muestra Stock: 0
-- ============================================================================

-- 1. Ver estructura de la tabla stock
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'stock'
ORDER BY ordinal_position;

-- 2. Ver algunos registros de stock con sus warehouse_id y warehouse_uuid
SELECT 
  s.id,
  s.product_id,
  p.name as product_name,
  p.barcode,
  s.quantity,
  s.warehouse_id,
  s.warehouse_uuid,
  w.name as warehouse_name
FROM stock s
LEFT JOIN products p ON s.product_id = p.id
LEFT JOIN warehouses w ON s.warehouse_uuid = w.id
LIMIT 10;

-- 3. Ver qué valores únicos hay en warehouse_id
SELECT DISTINCT warehouse_id, COUNT(*) as count
FROM stock
GROUP BY warehouse_id
ORDER BY count DESC;

-- 4. Ver qué warehouses existen en la tabla warehouses
SELECT id, name, store_id
FROM warehouses
ORDER BY name;

-- 5. Buscar productos específicos que aparecen en el POS (ej: "cha")
SELECT 
  p.id,
  p.barcode,
  p.name,
  p.price,
  s.quantity,
  s.warehouse_id,
  s.warehouse_uuid,
  w.name as warehouse_name
FROM products p
LEFT JOIN stock s ON p.product_id = s.product_id
LEFT JOIN warehouses w ON s.warehouse_uuid = w.id
WHERE p.name ILIKE '%cha%'
ORDER BY p.name
LIMIT 20;

-- 6. Verificar si hay stock para TIENDA_MUJERES
SELECT 
  COUNT(*) as total_records,
  SUM(quantity) as total_quantity
FROM stock
WHERE warehouse_id = 'TIENDA_MUJERES';

-- 7. Verificar si hay stock por warehouse_uuid
SELECT 
  w.name as warehouse_name,
  COUNT(*) as total_records,
  SUM(s.quantity) as total_quantity
FROM stock s
JOIN warehouses w ON s.warehouse_uuid = w.id
GROUP BY w.name
ORDER BY total_quantity DESC;
