-- ============================================================================
-- UNIFICAR BASE_CODE: Script genérico para agrupar colores
-- ============================================================================
-- Usa este script cuando tengas productos del mismo modelo con diferentes
-- base_code que deberían estar agrupados
-- ============================================================================

-- INSTRUCCIONES:
-- 1. Ejecuta primero la sección de DIAGNÓSTICO
-- 2. Identifica el base_code CORRECTO (el que quieres mantener)
-- 3. Identifica los base_code INCORRECTOS (los que quieres cambiar)
-- 4. Actualiza las variables en la sección de CORRECCIÓN
-- 5. Ejecuta la sección de CORRECCIÓN

-- ============================================================================
-- SECCIÓN 1: DIAGNÓSTICO
-- ============================================================================

-- Ver todos los modelos con múltiples base_code
SELECT 
  base_name,
  COUNT(DISTINCT base_code) as codigos_diferentes,
  STRING_AGG(DISTINCT base_code, ', ') as codigos,
  STRING_AGG(DISTINCT color, ', ') as colores
FROM products
GROUP BY base_name
HAVING COUNT(DISTINCT base_code) > 1
ORDER BY base_name;

-- Ver detalle de un modelo específico
-- CAMBIA 'Pantalón jean Denim' por el nombre de tu modelo
SELECT 
  base_code,
  base_name,
  color,
  STRING_AGG(size, ', ' ORDER BY size) as tallas,
  COUNT(*) as variantes,
  SUM((SELECT quantity FROM stock WHERE product_id = products.id LIMIT 1)) as stock
FROM products
WHERE base_name = 'Pantalón jean Denim'  -- ← CAMBIA AQUÍ
GROUP BY base_code, base_name, color
ORDER BY base_code, color;

-- ============================================================================
-- SECCIÓN 2: CORRECCIÓN
-- ============================================================================

BEGIN;

-- PASO 1: Define las variables
-- CAMBIA ESTOS VALORES según tu caso:
DO $$
DECLARE
  base_code_correcto TEXT := 'JEA-0004';     -- ← El código que quieres MANTENER
  base_code_incorrecto TEXT := 'JEA-0033';   -- ← El código que quieres CAMBIAR
  nombre_modelo TEXT := 'Pantalón jean Denim'; -- ← Nombre del modelo
BEGIN
  -- PASO 2: Mostrar qué se va a cambiar
  RAISE NOTICE '=== CAMBIOS A REALIZAR ===';
  RAISE NOTICE 'Modelo: %', nombre_modelo;
  RAISE NOTICE 'Cambiar de: % → %', base_code_incorrecto, base_code_correcto;
  
  -- PASO 3: Contar productos afectados
  RAISE NOTICE 'Productos a actualizar: %', (
    SELECT COUNT(*) 
    FROM products 
    WHERE base_code = base_code_incorrecto 
      AND base_name = nombre_modelo
  );
  
  -- PASO 4: Ejecutar cambio
  UPDATE products
  SET base_code = base_code_correcto
  WHERE base_code = base_code_incorrecto
    AND base_name = nombre_modelo;
  
  RAISE NOTICE 'Actualización completada';
END $$;

-- PASO 5: Verificar resultado
SELECT 
  '=== RESULTADO ===' as info,
  base_code,
  STRING_AGG(DISTINCT color, ', ') as colores,
  COUNT(*) as total_variantes
FROM products
WHERE base_name = 'Pantalón jean Denim'  -- ← CAMBIA AQUÍ
GROUP BY base_code
ORDER BY base_code;

COMMIT;

-- ============================================================================
-- SECCIÓN 3: VERIFICACIÓN EN CATÁLOGO VISUAL
-- ============================================================================

-- Esta query simula cómo el catálogo visual agrupa los productos
SELECT 
  base_code,
  base_name,
  STRING_AGG(DISTINCT color, ', ' ORDER BY color) as colores_disponibles,
  STRING_AGG(DISTINCT size, ', ' ORDER BY size) as tallas_disponibles,
  COUNT(DISTINCT color) as cantidad_colores,
  COUNT(DISTINCT size) as cantidad_tallas,
  COUNT(*) as total_variantes,
  SUM((SELECT quantity FROM stock WHERE product_id = products.id LIMIT 1)) as stock_total
FROM products
WHERE base_name = 'Pantalón jean Denim'  -- ← CAMBIA AQUÍ
GROUP BY base_code, base_name
ORDER BY base_code;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- 
-- 1. El base_code es la clave de agrupación en el catálogo visual
-- 2. Todos los productos con el mismo base_code aparecen en la misma tarjeta
-- 3. Los colores y tallas se muestran como opciones dentro de esa tarjeta
-- 4. El barcode debe seguir siendo único (base_code + size)
-- 
-- EJEMPLO DE RESULTADO ESPERADO:
-- 
-- Antes:
--   JEA-0004 | Pantalón jean Denim | Beige | 32,34,36,38 | 20 uds
--   JEA-0033 | Pantalón jean Denim | Verde | 36,38     | 8 uds
-- 
-- Después:
--   JEA-0004 | Pantalón jean Denim | Beige, Verde | 32,34,36,38 | 28 uds
-- 
-- ============================================================================
