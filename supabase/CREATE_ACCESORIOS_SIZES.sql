-- Crear tallas para categorías de Accesorios
-- Ejecutar en Supabase SQL Editor DESPUÉS de CREATE_ACCESORIOS_CATEGORIES.sql

DO $$
DECLARE
  v_bolsos_id UUID;
  v_cinturones_id UUID;
  v_gorros_id UUID;
  v_bufandas_id UUID;
BEGIN
  -- Obtener IDs de categorías
  SELECT id INTO v_bolsos_id FROM categories WHERE name = 'Bolsos' LIMIT 1;
  SELECT id INTO v_cinturones_id FROM categories WHERE name = 'Cinturones' LIMIT 1;
  SELECT id INTO v_gorros_id FROM categories WHERE name = 'Gorros' LIMIT 1;
  SELECT id INTO v_bufandas_id FROM categories WHERE name = 'Bufandas' LIMIT 1;
  
  -- Tallas para Bolsos (tamaños estándar)
  IF v_bolsos_id IS NOT NULL THEN
    INSERT INTO sizes (name, category_id, active, created_at, updated_at)
    VALUES
      ('Pequeño', v_bolsos_id, true, NOW(), NOW()),
      ('Mediano', v_bolsos_id, true, NOW(), NOW()),
      ('Grande', v_bolsos_id, true, NOW(), NOW()),
      ('Único', v_bolsos_id, true, NOW(), NOW())
    ON CONFLICT (name, category_id) DO NOTHING;
    RAISE NOTICE 'Tallas para Bolsos creadas';
  END IF;
  
  -- Tallas para Cinturones (medidas en cm)
  IF v_cinturones_id IS NOT NULL THEN
    INSERT INTO sizes (name, category_id, active, created_at, updated_at)
    VALUES
      ('80cm', v_cinturones_id, true, NOW(), NOW()),
      ('85cm', v_cinturones_id, true, NOW(), NOW()),
      ('90cm', v_cinturones_id, true, NOW(), NOW()),
      ('95cm', v_cinturones_id, true, NOW(), NOW()),
      ('100cm', v_cinturones_id, true, NOW(), NOW()),
      ('105cm', v_cinturones_id, true, NOW(), NOW()),
      ('110cm', v_cinturones_id, true, NOW(), NOW()),
      ('Único', v_cinturones_id, true, NOW(), NOW())
    ON CONFLICT (name, category_id) DO NOTHING;
    RAISE NOTICE 'Tallas para Cinturones creadas';
  END IF;
  
  -- Tallas para Gorros (talla única o estándar)
  IF v_gorros_id IS NOT NULL THEN
    INSERT INTO sizes (name, category_id, active, created_at, updated_at)
    VALUES
      ('Único', v_gorros_id, true, NOW(), NOW()),
      ('S', v_gorros_id, true, NOW(), NOW()),
      ('M', v_gorros_id, true, NOW(), NOW()),
      ('L', v_gorros_id, true, NOW(), NOW())
    ON CONFLICT (name, category_id) DO NOTHING;
    RAISE NOTICE 'Tallas para Gorros creadas';
  END IF;
  
  -- Tallas para Bufandas (talla única)
  IF v_bufandas_id IS NOT NULL THEN
    INSERT INTO sizes (name, category_id, active, created_at, updated_at)
    VALUES
      ('Único', v_bufandas_id, true, NOW(), NOW()),
      ('Corta', v_bufandas_id, true, NOW(), NOW()),
      ('Larga', v_bufandas_id, true, NOW(), NOW())
    ON CONFLICT (name, category_id) DO NOTHING;
    RAISE NOTICE 'Tallas para Bufandas creadas';
  END IF;
  
  RAISE NOTICE 'Todas las tallas de Accesorios creadas exitosamente';
END $$;

-- Verificar tallas creadas
SELECT 
  c.name as categoria,
  l.name as linea,
  s.name as talla,
  s.active
FROM sizes s
JOIN categories c ON s.category_id = c.id
JOIN lines l ON c.line_id = l.id
WHERE l.name = 'Accesorios'
ORDER BY c.name, s.name;
