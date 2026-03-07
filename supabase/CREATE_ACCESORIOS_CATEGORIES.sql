-- Crear categorías para la línea Accesorios
-- Ejecutar en Supabase SQL Editor

-- Primero, obtener el ID de la línea Accesorios
DO $$
DECLARE
  v_line_id UUID;
BEGIN
  -- Obtener ID de línea Accesorios
  SELECT id INTO v_line_id FROM lines WHERE name = 'Accesorios' LIMIT 1;
  
  IF v_line_id IS NULL THEN
    RAISE EXCEPTION 'Línea Accesorios no encontrada';
  END IF;
  
  -- Crear categorías para Accesorios
  INSERT INTO categories (name, line_id, description, active, created_at, updated_at)
  VALUES
    ('Bolsos', v_line_id, 'Bolsos, carteras y mochilas', true, NOW(), NOW()),
    ('Cinturones', v_line_id, 'Cinturones y correas', true, NOW(), NOW()),
    ('Gorros', v_line_id, 'Gorros, sombreros y gorras', true, NOW(), NOW()),
    ('Bufandas', v_line_id, 'Bufandas y pañuelos', true, NOW(), NOW())
  ON CONFLICT (name, line_id) DO NOTHING;
  
  RAISE NOTICE 'Categorías de Accesorios creadas exitosamente';
END $$;

-- Verificar categorías creadas
SELECT 
  c.name as categoria,
  l.name as linea,
  c.description,
  c.active
FROM categories c
JOIN lines l ON c.line_id = l.id
WHERE l.name = 'Accesorios'
ORDER BY c.name;
