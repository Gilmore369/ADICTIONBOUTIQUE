-- ============================================================================
-- CORRECCIÓN GENÉRICA: Unificar modelos duplicados
-- ============================================================================
-- Este script encuentra y corrige automáticamente todos los productos que
-- tienen el mismo base_name pero diferentes base_code
-- ============================================================================

BEGIN;

-- Paso 1: Crear tabla temporal con los base_code correctos
-- (el más antiguo para cada base_name)
CREATE TEMP TABLE correct_base_codes AS
SELECT DISTINCT ON (base_name)
  base_name,
  base_code as correct_base_code,
  created_at
FROM products
WHERE base_name IS NOT NULL
  AND base_name != ''
ORDER BY base_name, created_at ASC;

-- Paso 2: Mostrar qué se va a corregir
SELECT 
  '=== MODELOS QUE SERÁN CORREGIDOS ===' as seccion,
  p.base_name,
  p.base_code as codigo_actual,
  c.correct_base_code as codigo_correcto,
  COUNT(DISTINCT p.id) as variantes_afectadas
FROM products p
JOIN correct_base_codes c ON p.base_name = c.base_name
WHERE p.base_code != c.correct_base_code
GROUP BY p.base_name, p.base_code, c.correct_base_code
ORDER BY p.base_name;

-- Paso 3: Aplicar la corrección
UPDATE products p
SET base_code = c.correct_base_code
FROM correct_base_codes c
WHERE p.base_name = c.base_name
  AND p.base_code != c.correct_base_code;

-- Paso 4: Verificar que no quedan duplicados
SELECT 
  '=== VERIFICACIÓN: MODELOS CON MÚLTIPLES BASE_CODE ===' as seccion,
  base_name,
  COUNT(DISTINCT base_code) as codigos_diferentes,
  STRING_AGG(DISTINCT base_code, ', ') as codigos
FROM products
WHERE base_name IS NOT NULL
  AND base_name != ''
GROUP BY base_name
HAVING COUNT(DISTINCT base_code) > 1
ORDER BY base_name;

-- Paso 5: Mostrar resumen final
DO $$
DECLARE
  modelos_corregidos INTEGER;
  variantes_actualizadas INTEGER;
BEGIN
  -- Contar modelos que fueron corregidos
  SELECT COUNT(DISTINCT p.base_name) INTO modelos_corregidos
  FROM products p
  JOIN correct_base_codes c ON p.base_name = c.base_name
  WHERE p.base_code = c.correct_base_code;
  
  -- Contar variantes actualizadas
  GET DIAGNOSTICS variantes_actualizadas = ROW_COUNT;
  
  RAISE NOTICE '=== RESUMEN FINAL ===';
  RAISE NOTICE 'Modelos procesados: %', modelos_corregidos;
  RAISE NOTICE 'Variantes actualizadas: %', variantes_actualizadas;
  RAISE NOTICE '✅ Corrección completada';
END $$;

-- Paso 6: Mostrar estado final por modelo
SELECT 
  '=== ESTADO FINAL: PRODUCTOS POR MODELO ===' as seccion,
  base_code,
  base_name,
  COUNT(DISTINCT color) as colores,
  COUNT(DISTINCT size) as tallas,
  COUNT(DISTINCT id) as total_variantes,
  SUM((SELECT COALESCE(quantity, 0) FROM stock WHERE product_id = products.id LIMIT 1)) as stock_total
FROM products
WHERE base_name IS NOT NULL
  AND base_name != ''
GROUP BY base_code, base_name
ORDER BY base_name, base_code;

-- Limpiar tabla temporal
DROP TABLE correct_base_codes;

COMMIT;

-- ============================================================================
-- NOTAS DE USO
-- ============================================================================
-- Este script:
-- 1. Encuentra todos los modelos con base_name duplicado
-- 2. Identifica el base_code más antiguo (correcto) para cada modelo
-- 3. Actualiza todos los productos para usar el base_code correcto
-- 4. Verifica que no queden duplicados
-- 5. Muestra un resumen del estado final
--
-- Es seguro ejecutarlo múltiples veces
-- ============================================================================
