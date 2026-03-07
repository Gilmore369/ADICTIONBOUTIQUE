-- Verificar estructura de tablas relacionadas con stores, warehouses y line_stores

-- 1. Estructura de la tabla STORES
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'stores'
ORDER BY ordinal_position;

-- 2. Estructura de la tabla WAREHOUSES
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'warehouses'
ORDER BY ordinal_position;

-- 3. Estructura de la tabla LINE_STORES
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'line_stores'
ORDER BY ordinal_position;

-- 4. Estructura de la tabla PROFILES
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 5. Ver datos de ejemplo de STORES
SELECT * FROM stores LIMIT 5;

-- 6. Ver datos de ejemplo de WAREHOUSES
SELECT * FROM warehouses LIMIT 5;

-- 7. Ver datos de ejemplo de LINE_STORES
SELECT * FROM line_stores LIMIT 10;

-- 8. Ver datos de ejemplo de PROFILES (solo columnas relevantes)
SELECT id, email, warehouse_id FROM profiles LIMIT 5;
