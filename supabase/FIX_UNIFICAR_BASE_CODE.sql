-- ============================================================================
-- CORRECCIÓN: Unificar base_code para productos del mismo modelo
-- ============================================================================
-- Este script corrige productos que deberían tener el mismo base_code
-- pero fueron creados con códigos diferentes
-- ============================================================================

BEGIN;

-- Paso 1: Identificar el base_code correcto (el más antiguo)
-- Para "Pantalón jean Denim", el código correcto es JEA-0004

-- Paso 2: Actualizar todos los productos con base_name "Pantalón jean Denim"
-- para que usen el mismo base_code

UPDATE products
SET base_code = 'JEA-0004'
WHERE base_name = 'Pantalón jean Denim'
  AND base_code != 'JEA-0004';

-- Paso 3: Verificar el resultado
SELECT 
  '=== RESULTADO DE LA CORRECCIÓN ===' as seccion,
  base_code,
  base_name,
  color,
  COUNT(DISTINCT id) as variantes,
  STRING_AGG(DISTINCT size, ', ' ORDER BY size) as tallas
FROM products
WHERE base_name = 'Pantalón jean Denim'
GROUP BY base_code, base_name, color
ORDER BY base_code, color;

-- Paso 4: Mostrar resumen
DO $$
DECLARE
  total_productos INTEGER;
  codigos_unicos INTEGER;
BEGIN
  SELECT COUNT(DISTINCT id) INTO total_productos
  FROM products
  WHERE base_name = 'Pantalón jean Denim';
  
  SELECT COUNT(DISTINCT base_code) INTO codigos_unicos
  FROM products
  WHERE base_name = 'Pantalón jean Denim';
  
  RAISE NOTICE '=== RESUMEN ===';
  RAISE NOTICE 'Total de variantes: %', total_productos;
  RAISE NOTICE 'Códigos base únicos: %', codigos_unicos;
  
  IF codigos_unicos = 1 THEN
    RAISE NOTICE '✅ ÉXITO: Todos los productos ahora comparten el mismo base_code';
  ELSE
    RAISE WARNING '⚠️ Aún hay % códigos diferentes', codigos_unicos;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
-- Este script unifica el base_code para que todos los colores del mismo
-- modelo aparezcan agrupados en el catálogo visual
