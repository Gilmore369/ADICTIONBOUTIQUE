-- ============================================================================
-- PRUEBA RÁPIDA: Supplier-Brands
-- ============================================================================
-- Ejecuta esto DESPUÉS de aplicar APLICAR_SUPPLIER_BRANDS.sql
-- Tiempo: 10 segundos
-- ============================================================================

-- 1️⃣ ¿Existe la tabla?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supplier_brands')
    THEN '✅ Tabla supplier_brands existe'
    ELSE '❌ ERROR: Tabla no existe'
  END as check_1;

-- 2️⃣ ¿Hay relaciones?
SELECT 
  CASE 
    WHEN COUNT(*) > 0 
    THEN '✅ ' || COUNT(*) || ' relaciones creadas'
    ELSE '❌ ERROR: No hay relaciones'
  END as check_2
FROM supplier_brands;

-- 3️⃣ ¿Todos los proveedores tienen marcas?
SELECT 
  CASE 
    WHEN COUNT(*) = 0 
    THEN '✅ Todos los proveedores tienen marcas'
    ELSE '⚠️ ' || COUNT(*) || ' proveedores sin marcas'
  END as check_3
FROM suppliers s
LEFT JOIN supplier_brands sb ON s.id = sb.supplier_id
WHERE s.active = true AND sb.id IS NULL;

-- 4️⃣ Ver primeras 5 relaciones
SELECT 
  s.name as proveedor,
  b.name as marca
FROM supplier_brands sb
JOIN suppliers s ON sb.supplier_id = s.id
JOIN brands b ON sb.brand_id = b.id
LIMIT 5;

-- ============================================================================
-- RESULTADO ESPERADO:
-- ✅ Tabla supplier_brands existe
-- ✅ X relaciones creadas (X > 0)
-- ✅ Todos los proveedores tienen marcas
-- Tabla con 5 filas mostrando proveedor-marca
-- ============================================================================
