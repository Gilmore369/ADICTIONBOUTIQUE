-- ============================================================================
-- TEST: Intentar crear una categoría manualmente en la base de datos
-- ============================================================================
-- Ejecuta esto para probar si la base de datos acepta la inserción

-- 1. Verificar que la línea "Hombres" existe
SELECT id, name FROM lines WHERE name = 'Hombres';

-- 2. Intentar crear una categoría de prueba
INSERT INTO categories (name, line_id, description)
VALUES (
  'TEST Zapatos',
  '11111111-0002-0000-0000-000000000000',
  'Categoría de prueba'
)
RETURNING *;

-- 3. Verificar que se creó
SELECT * FROM categories WHERE name = 'TEST Zapatos';

-- 4. Eliminar la categoría de prueba
DELETE FROM categories WHERE name = 'TEST Zapatos';
