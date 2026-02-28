-- ============================================================================
-- DIAGNÓSTICO: Validar Líneas vs Tiendas
-- ============================================================================
-- Este script analiza la relación entre líneas de producto y tiendas
-- para identificar inconsistencias
-- ============================================================================

-- 1. Ver todas las líneas disponibles
-- ============================================================================
SELECT 
  '=== LÍNEAS DISPONIBLES ===' as seccion,
  id,
  name as linea,
  description
FROM lines
ORDER BY name;

-- 2. Ver todas las categorías y sus líneas
-- ============================================================================
SELECT 
  '=== CATEGORÍAS POR LÍNEA ===' as seccion,
  l.name as linea,
  c.name as categoria,
  c.id as categoria_id
FROM categories c
JOIN lines l ON c.line_id = l.id
ORDER BY l.name, c.name;

-- 3. Ver productos con su línea y warehouse
-- ============================================================================
SELECT 
  '=== PRODUCTOS: LÍNEA vs WAREHOUSE ===' as seccion,
  p.base_code,
  p.base_name,
  l.name as linea_producto,
  c.name as categoria,
  s.warehouse_id as tienda_stock,
  COUNT(*) as variantes
FROM products p
JOIN lines l ON p.line_id = l.id
JOIN categories c ON p.category_id = c.id
LEFT JOIN stock s ON p.id = s.product_id
GROUP BY p.base_code, p.base_name, l.name, c.name, s.warehouse_id
ORDER BY l.name, p.base_code;

-- 4. Identificar INCONSISTENCIAS: Productos de línea X en tienda Y
-- ============================================================================
SELECT 
  '=== ⚠️ INCONSISTENCIAS DETECTADAS ===' as seccion,
  p.base_code,
  p.base_name,
  l.name as linea_producto,
  s.warehouse_id as tienda_actual,
  CASE 
    WHEN l.name = 'Mujeres' THEN 'Tienda Mujeres'
    WHEN l.name = 'Hombres' THEN 'Tienda Hombres'
    WHEN l.name = 'Niños' THEN 'Tienda Niños (si existe)'
    ELSE 'Sin asignar'
  END as tienda_esperada,
  COUNT(DISTINCT p.id) as productos_afectados
FROM products p
JOIN lines l ON p.line_id = l.id
LEFT JOIN stock s ON p.id = s.product_id
WHERE 
  (l.name = 'Mujeres' AND s.warehouse_id != 'Tienda Mujeres' AND s.warehouse_id != 'Mujeres')
  OR (l.name = 'Hombres' AND s.warehouse_id != 'Tienda Hombres' AND s.warehouse_id != 'Hombres')
GROUP BY p.base_code, p.base_name, l.name, s.warehouse_id
ORDER BY l.name, p.base_code;

-- 5. Resumen por tienda: ¿Qué líneas tiene cada tienda?
-- ============================================================================
SELECT 
  '=== RESUMEN: LÍNEAS POR TIENDA ===' as seccion,
  s.warehouse_id as tienda,
  l.name as linea,
  COUNT(DISTINCT p.base_code) as modelos,
  COUNT(DISTINCT p.id) as variantes_totales,
  SUM(s.quantity) as stock_total
FROM stock s
JOIN products p ON s.product_id = p.id
JOIN lines l ON p.line_id = l.id
GROUP BY s.warehouse_id, l.name
ORDER BY s.warehouse_id, l.name;

-- 6. Productos problemáticos específicos
-- ============================================================================
SELECT 
  '=== PRODUCTOS CON CATEGORÍA DE UNA LÍNEA Y LINE_ID DE OTRA ===' as seccion,
  p.barcode,
  p.name,
  l.name as linea_asignada,
  c.name as categoria,
  cl.name as linea_de_categoria
FROM products p
JOIN lines l ON p.line_id = l.id
JOIN categories c ON p.category_id = c.id
JOIN lines cl ON c.line_id = cl.id
WHERE l.id != cl.id
ORDER BY p.base_code;

-- 7. Recomendación de corrección
-- ============================================================================
SELECT 
  '=== 💡 RECOMENDACIÓN ===' as info,
  'Los productos deben tener line_id que coincida con la línea de su categoría' as regla,
  'Ejemplo: Si categoria es "Pantalones" (línea Mujeres), entonces line_id debe ser Mujeres' as ejemplo;
