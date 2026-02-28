-- ============================================================================
-- SOLUCIÓN AUTOMÁTICA: Trigger para unificar base_code al crear productos
-- ============================================================================
-- Este trigger se ejecuta DESPUÉS de insertar un producto nuevo y verifica
-- si ya existe otro producto con el mismo base_name pero diferente base_code.
-- Si lo encuentra, actualiza el nuevo producto para usar el base_code existente.
-- ============================================================================

-- Paso 1: Crear la función del trigger
CREATE OR REPLACE FUNCTION unificar_base_code_automatico()
RETURNS TRIGGER AS $$
DECLARE
  base_code_existente TEXT;
  productos_actualizados INTEGER;
BEGIN
  -- Solo procesar si el producto tiene base_name
  IF NEW.base_name IS NULL OR NEW.base_name = '' THEN
    RETURN NEW;
  END IF;

  -- Buscar si ya existe un producto con el mismo base_name pero diferente base_code
  SELECT base_code INTO base_code_existente
  FROM products
  WHERE base_name = NEW.base_name
    AND base_code IS NOT NULL
    AND base_code != ''
    AND base_code != NEW.base_code
    AND id != NEW.id
  ORDER BY created_at ASC
  LIMIT 1;

  -- Si encontramos un base_code existente diferente, actualizar el nuevo producto
  IF base_code_existente IS NOT NULL AND base_code_existente != NEW.base_code THEN
    RAISE NOTICE '[UNIFICAR] Producto nuevo "%" tiene base_code "%" pero ya existe "%". Unificando...', 
      NEW.base_name, NEW.base_code, base_code_existente;
    
    -- Actualizar el producto recién insertado
    UPDATE products
    SET base_code = base_code_existente
    WHERE id = NEW.id;
    
    -- También actualizar cualquier otro producto con el mismo base_name que tenga base_code diferente
    UPDATE products
    SET base_code = base_code_existente
    WHERE base_name = NEW.base_name
      AND base_code != base_code_existente
      AND id != NEW.id;
    
    GET DIAGNOSTICS productos_actualizados = ROW_COUNT;
    
    RAISE NOTICE '[UNIFICAR] ✅ Unificados % productos adicionales con base_code "%"', 
      productos_actualizados, base_code_existente;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Paso 2: Crear el trigger (eliminar si ya existe)
DROP TRIGGER IF EXISTS trigger_unificar_base_code ON products;

CREATE TRIGGER trigger_unificar_base_code
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION unificar_base_code_automatico();

-- Paso 3: Verificar que el trigger fue creado
SELECT 
  '=== TRIGGER CREADO EXITOSAMENTE ===' as status,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_unificar_base_code';

-- ============================================================================
-- PRUEBA DEL TRIGGER
-- ============================================================================

-- Primero, ejecutar la corrección de productos existentes
DO $$
DECLARE
  modelos_corregidos INTEGER := 0;
BEGIN
  -- Crear tabla temporal con los base_code correctos (el más antiguo)
  CREATE TEMP TABLE IF NOT EXISTS correct_base_codes AS
  SELECT DISTINCT ON (base_name)
    base_name,
    base_code as correct_base_code,
    created_at
  FROM products
  WHERE base_name IS NOT NULL
    AND base_name != ''
    AND base_code IS NOT NULL
    AND base_code != ''
  ORDER BY base_name, created_at ASC;

  -- Aplicar corrección
  WITH updated AS (
    UPDATE products p
    SET base_code = c.correct_base_code
    FROM correct_base_codes c
    WHERE p.base_name = c.base_name
      AND p.base_code != c.correct_base_code
    RETURNING p.base_name
  )
  SELECT COUNT(DISTINCT base_name) INTO modelos_corregidos FROM updated;

  RAISE NOTICE '=== CORRECCIÓN INICIAL ===';
  RAISE NOTICE '✅ Modelos corregidos: %', modelos_corregidos;
  
  -- Limpiar tabla temporal
  DROP TABLE IF EXISTS correct_base_codes;
END $$;

-- Verificar estado actual
SELECT 
  '=== ESTADO ACTUAL: MODELOS CON MÚLTIPLES BASE_CODE ===' as seccion,
  base_name,
  COUNT(DISTINCT base_code) as codigos_diferentes,
  STRING_AGG(DISTINCT base_code, ', ') as codigos
FROM products
WHERE base_name IS NOT NULL
  AND base_name != ''
GROUP BY base_name
HAVING COUNT(DISTINCT base_code) > 1
ORDER BY base_name;

-- ============================================================================
-- CÓMO FUNCIONA
-- ============================================================================
-- 
-- ANTES (sin trigger):
-- 1. Usuario crea "Pantalón jean Denim - Beige" → base_code: JEA-0004
-- 2. Usuario crea "Pantalón jean Denim - Verde" → base_code: JEA-0033 ❌
-- 3. En el catálogo aparecen SEPARADOS
--
-- DESPUÉS (con trigger):
-- 1. Usuario crea "Pantalón jean Denim - Beige" → base_code: JEA-0004
-- 2. Usuario crea "Pantalón jean Denim - Verde" → base_code: JEA-0033
--    → TRIGGER detecta que ya existe JEA-0004 para "Pantalón jean Denim"
--    → TRIGGER cambia automáticamente JEA-0033 → JEA-0004 ✅
-- 3. En el catálogo aparecen JUNTOS
--
-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
--
-- 1. El trigger se ejecuta DESPUÉS de cada INSERT en la tabla products
-- 2. Solo afecta productos con base_name definido
-- 3. Usa el base_code del producto MÁS ANTIGUO con el mismo base_name
-- 4. Es completamente automático, no requiere intervención manual
-- 5. También corrige productos existentes que tengan el mismo problema
--
-- ============================================================================
-- DESACTIVAR EL TRIGGER (si es necesario)
-- ============================================================================
--
-- Para desactivar temporalmente:
-- ALTER TABLE products DISABLE TRIGGER trigger_unificar_base_code;
--
-- Para reactivar:
-- ALTER TABLE products ENABLE TRIGGER trigger_unificar_base_code;
--
-- Para eliminar completamente:
-- DROP TRIGGER IF EXISTS trigger_unificar_base_code ON products;
-- DROP FUNCTION IF EXISTS unificar_base_code_automatico();
--
-- ============================================================================
