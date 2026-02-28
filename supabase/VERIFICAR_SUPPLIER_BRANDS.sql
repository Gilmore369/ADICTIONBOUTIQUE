-- ============================================================================
-- SCRIPT DE VERIFICACIÓN: Supplier-Brands
-- ============================================================================
-- Descripción: Verifica que la migración se aplicó correctamente
-- Instrucciones: Ejecutar en Supabase SQL Editor DESPUÉS de aplicar migración
-- ============================================================================

-- ============================================================================
-- CHECK 1: Verificar que tabla existe
-- ============================================================================

SELECT 
  'CHECK 1: Tabla supplier_brands' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'supplier_brands'
    ) THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as resultado;

-- ============================================================================
-- CHECK 2: Verificar índices
-- ============================================================================

SELECT 
  'CHECK 2: Índices' as test,
  COUNT(*) as indices_creados,
  CASE 
    WHEN COUNT(*) >= 2 THEN '✅ OK'
    ELSE '❌ FALTAN ÍNDICES'
  END as resultado
FROM pg_indexes
WHERE tablename = 'supplier_brands';

-- ============================================================================
-- CHECK 3: Verificar que hay relaciones
-- ============================================================================

SELECT 
  'CHECK 3: Relaciones' as test,
  COUNT(*) as total_relaciones,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ OK'
    ELSE '❌ NO HAY RELACIONES'
  END as resultado
FROM supplier_brands;

-- ============================================================================
-- CHECK 4: Verificar integridad referencial
-- ============================================================================

SELECT 
  'CHECK 4: Integridad' as test,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM supplier_brands sb
      LEFT JOIN suppliers s ON sb.supplier_id = s.id
      LEFT JOIN brands b ON sb.brand_id = b.id
      WHERE s.id IS NULL OR b.id IS NULL
    ) THEN '✅ OK'
    ELSE '❌ HAY REFERENCIAS ROTAS'
  END as resultado;

-- ============================================================================
-- CHECK 5: Verificar que API puede leer datos
-- ============================================================================

SELECT 
  'CHECK 5: Datos legibles' as test,
  COUNT(*) as proveedores_con_marcas,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ OK'
    ELSE '❌ NO HAY DATOS'
  END as resultado
FROM (
  SELECT DISTINCT supplier_id
  FROM supplier_brands
) sub;

-- ============================================================================
-- RESUMEN: Relaciones por proveedor
-- ============================================================================

SELECT 
  s.name as proveedor,
  COUNT(sb.brand_id) as cantidad_marcas,
  STRING_AGG(b.name, ', ' ORDER BY b.name) as marcas
FROM suppliers s
LEFT JOIN supplier_brands sb ON s.id = sb.supplier_id
LEFT JOIN brands b ON sb.brand_id = b.id
WHERE s.active = true
GROUP BY s.id, s.name
ORDER BY s.name;

-- ============================================================================
-- RESUMEN: Proveedores por marca
-- ============================================================================

SELECT 
  b.name as marca,
  COUNT(sb.supplier_id) as cantidad_proveedores,
  STRING_AGG(s.name, ', ' ORDER BY s.name) as proveedores
FROM brands b
LEFT JOIN supplier_brands sb ON b.id = sb.brand_id
LEFT JOIN suppliers s ON sb.supplier_id = s.id
WHERE b.active = true
GROUP BY b.id, b.name
ORDER BY b.name;

-- ============================================================================
-- DIAGNÓSTICO: Proveedores sin marcas
-- ============================================================================

SELECT 
  'ADVERTENCIA: Proveedores sin marcas' as alerta,
  s.name as proveedor,
  '⚠️ Agregar marcas' as accion
FROM suppliers s
LEFT JOIN supplier_brands sb ON s.id = sb.supplier_id
WHERE s.active = true
AND sb.id IS NULL;

-- ============================================================================
-- DIAGNÓSTICO: Marcas sin proveedores
-- ============================================================================

SELECT 
  'ADVERTENCIA: Marcas sin proveedores' as alerta,
  b.name as marca,
  '⚠️ Agregar proveedores' as accion
FROM brands b
LEFT JOIN supplier_brands sb ON b.id = sb.brand_id
WHERE b.active = true
AND sb.id IS NULL;

-- ============================================================================
-- RESULTADO ESPERADO
-- ============================================================================
-- Todos los CHECKs deben mostrar ✅ OK
-- Resumen debe mostrar proveedores con sus marcas
-- No debe haber advertencias (o muy pocas)
-- ============================================================================
