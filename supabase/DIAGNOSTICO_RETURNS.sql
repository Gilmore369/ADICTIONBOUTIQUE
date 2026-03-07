-- ============================================================================
-- DIAGNÓSTICO: Estado actual de la tabla returns
-- ============================================================================
-- Ejecuta este script para ver qué existe y qué falta

-- 1. ¿Existe la tabla returns?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'returns')
    THEN '✅ Tabla returns EXISTE'
    ELSE '❌ Tabla returns NO EXISTE'
  END AS estado_tabla;

-- 2. ¿Qué índices existen?
SELECT 
  '📋 Índices existentes:' AS tipo,
  indexname AS nombre
FROM pg_indexes 
WHERE tablename = 'returns'
ORDER BY indexname;

-- 3. ¿Qué funciones existen?
SELECT 
  '🔧 Funciones existentes:' AS tipo,
  proname AS nombre
FROM pg_proc 
WHERE proname IN ('generate_return_number', 'check_return_eligibility', 'update_updated_at_column')
ORDER BY proname;

-- 4. ¿Qué políticas RLS existen?
SELECT 
  '🔒 Políticas RLS existentes:' AS tipo,
  policyname AS nombre
FROM pg_policies 
WHERE tablename = 'returns'
ORDER BY policyname;

-- 5. ¿Qué triggers existen?
SELECT 
  '⚡ Triggers existentes:' AS tipo,
  trigger_name AS nombre
FROM information_schema.triggers
WHERE event_object_table = 'returns'
ORDER BY trigger_name;

-- 6. ¿Cuántos registros hay?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'returns')
    THEN (SELECT '📊 Registros en returns: ' || COUNT(*)::TEXT FROM returns)
    ELSE '❌ No se puede contar, tabla no existe'
  END AS registros;

-- 7. Estructura de la tabla (si existe)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'returns'
ORDER BY ordinal_position;
