-- ============================================================================
-- DEBUG: Verificar IDs de líneas y su validez
-- ============================================================================
-- Ejecutar en Supabase SQL Editor para diagnosticar el problema de "Invalid line ID"

-- 1. Ver todas las líneas con sus IDs reales
SELECT 
  id,
  name,
  active,
  created_at
FROM lines
ORDER BY name;

-- 2. Verificar si el UUID que se está enviando existe
SELECT 
  id,
  name,
  active
FROM lines
WHERE id = '11111111-0002-0000-0000-000000000000';

-- 3. Ver la estructura de la tabla lines
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'lines'
ORDER BY ordinal_position;

-- 4. Verificar constraints en la tabla categories
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'categories'
  AND tc.constraint_type IN ('FOREIGN KEY', 'PRIMARY KEY');

-- 5. Intentar insertar una categoría de prueba con una línea válida
-- (Esto nos dirá si el problema es de permisos, constraints, o el UUID)
DO $$
DECLARE
  v_line_id uuid;
  v_category_id uuid;
BEGIN
  -- Obtener el ID de la primera línea activa
  SELECT id INTO v_line_id FROM lines WHERE active = true LIMIT 1;
  
  RAISE NOTICE 'Line ID encontrado: %', v_line_id;
  
  -- Intentar insertar una categoría de prueba
  INSERT INTO categories (name, line_id, description)
  VALUES ('TEST_CATEGORIA_DEBUG', v_line_id, 'Prueba de inserción')
  RETURNING id INTO v_category_id;
  
  RAISE NOTICE 'Categoría creada exitosamente con ID: %', v_category_id;
  
  -- Eliminar la categoría de prueba
  DELETE FROM categories WHERE id = v_category_id;
  RAISE NOTICE 'Categoría de prueba eliminada';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR: %', SQLERRM;
END $$;
