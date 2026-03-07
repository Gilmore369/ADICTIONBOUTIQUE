-- Diagnóstico completo de la estructura de tiendas y usuarios

-- 1. Ver estructura de tabla USERS
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. Ver usuarios y sus tiendas asignadas
SELECT 
  id,
  email,
  name,
  stores,
  roles,
  active
FROM users
LIMIT 10;

-- 3. Ver tabla STORES (nueva estructura UUID)
SELECT * FROM stores;

-- 4. Ver tabla WAREHOUSES (nueva estructura UUID)
SELECT 
  w.id,
  w.name as warehouse_name,
  s.name as store_name,
  s.code as store_code
FROM warehouses w
JOIN stores s ON w.store_id = s.id;

-- 5. Ver LINE_STORES (relación líneas-tiendas)
SELECT 
  ls.id,
  s.code as store_code,
  s.name as store_name,
  l.name as line_name
FROM line_stores ls
JOIN stores s ON ls.store_id = s.id
JOIN lines l ON ls.line_id = l.id
ORDER BY s.name, l.name;

-- 6. Ver STOCK (usa warehouse_id como TEXT)
SELECT 
  warehouse_id,
  COUNT(*) as productos,
  SUM(quantity) as stock_total
FROM stock
GROUP BY warehouse_id;

-- 7. Mapeo entre nombres TEXT y UUIDs
SELECT 
  s.id as store_uuid,
  s.code as store_code,
  s.name as store_name,
  w.id as warehouse_uuid,
  w.name as warehouse_name
FROM stores s
LEFT JOIN warehouses w ON w.store_id = s.id
ORDER BY s.name;
