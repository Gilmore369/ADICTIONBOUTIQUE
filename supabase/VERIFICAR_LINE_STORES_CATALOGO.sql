-- Verificar configuración de line_stores para catálogo visual
-- Este script verifica que las líneas estén correctamente asociadas a las tiendas

-- 1. Ver todas las tiendas
SELECT 
  id,
  code,
  name,
  active
FROM stores
WHERE active = true
ORDER BY name;

-- 2. Ver todos los almacenes por tienda
SELECT 
  w.id,
  w.name as almacen,
  s.name as tienda,
  s.code as codigo_tienda
FROM warehouses w
JOIN stores s ON w.store_id = s.id
WHERE w.active = true
ORDER BY s.name, w.name;

-- 3. Ver todas las líneas
SELECT 
  id,
  name,
  active
FROM lines
WHERE active = true
ORDER BY name;

-- 4. Ver relaciones line_stores actuales (líneas por TIENDA)
SELECT 
  ls.id,
  s.name as tienda,
  s.code as codigo,
  l.name as linea,
  ls.created_at
FROM line_stores ls
JOIN stores s ON ls.store_id = s.id
JOIN lines l ON ls.line_id = l.id
ORDER BY s.name, l.name;

-- 5. Verificar qué líneas ve cada tienda
SELECT 
  s.name as tienda,
  s.code as codigo,
  COUNT(DISTINCT ls.line_id) as lineas_disponibles,
  STRING_AGG(l.name, ', ' ORDER BY l.name) as lineas
FROM stores s
LEFT JOIN line_stores ls ON s.id = ls.store_id
LEFT JOIN lines l ON ls.line_id = l.id AND l.active = true
WHERE s.active = true
GROUP BY s.id, s.name, s.code
ORDER BY s.name;

-- 6. Verificar productos por línea y tienda
SELECT 
  s.name as tienda,
  l.name as linea,
  COUNT(DISTINCT p.id) as total_productos,
  COUNT(DISTINCT p.base_code) as total_modelos,
  SUM(st.quantity) as stock_total
FROM stores s
JOIN line_stores ls ON s.id = ls.store_id
JOIN lines l ON ls.line_id = l.id
LEFT JOIN products p ON p.line_id = l.id AND p.active = true
LEFT JOIN warehouses w ON w.store_id = s.id
LEFT JOIN stock st ON st.product_id = p.id AND st.warehouse_id = w.id
WHERE s.active = true AND l.active = true
GROUP BY s.id, s.name, l.id, l.name
ORDER BY s.name, l.name;

-- 7. Detectar líneas sin relación con tiendas
SELECT 
  l.id,
  l.name as linea_sin_tienda,
  COUNT(p.id) as productos_afectados
FROM lines l
LEFT JOIN line_stores ls ON l.id = ls.line_id
LEFT JOIN products p ON p.line_id = l.id AND p.active = true
WHERE l.active = true
  AND ls.id IS NULL
GROUP BY l.id, l.name
HAVING COUNT(p.id) > 0
ORDER BY COUNT(p.id) DESC;

-- 8. Detectar productos sin línea asignada
SELECT 
  COUNT(*) as productos_sin_linea
FROM products p
WHERE p.active = true
  AND p.line_id IS NULL;

-- 8b. Ejemplos de productos sin línea (primeros 10)
SELECT 
  p.id,
  p.name,
  p.barcode
FROM products p
WHERE p.active = true
  AND p.line_id IS NULL
LIMIT 10;
