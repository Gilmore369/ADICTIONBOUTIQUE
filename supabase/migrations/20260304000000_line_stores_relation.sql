-- ============================================================================
-- Migration: Relación Líneas-Tiendas (Many-to-Many)
-- ============================================================================
-- Permite asignar líneas específicas a cada tienda
-- Ejemplo: Tienda Hombres solo tiene líneas Hombres, Accesorios
--          Tienda Mujeres solo tiene líneas Mujeres, Niños, Perfumes, Accesorios
-- ============================================================================

-- ============================================================================
-- 1. TABLA DE RELACIÓN LINE_STORES
-- ============================================================================
CREATE TABLE IF NOT EXISTS line_stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_id UUID NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(line_id, store_id)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_line_stores_line_id ON line_stores(line_id);
CREATE INDEX IF NOT EXISTS idx_line_stores_store_id ON line_stores(store_id);

-- ============================================================================
-- 2. ASIGNACIÓN INICIAL DE LÍNEAS A TIENDAS
-- ============================================================================

-- Obtener IDs de tiendas
DO $$
DECLARE
  store_mujeres_id UUID;
  store_hombres_id UUID;
  line_hombres_id UUID;
  line_mujeres_id UUID;
  line_ninos_id UUID;
  line_accesorios_id UUID;
  line_perfumes_id UUID;
BEGIN
  -- Obtener IDs de tiendas
  SELECT id INTO store_mujeres_id FROM stores WHERE code = 'MUJERES' LIMIT 1;
  SELECT id INTO store_hombres_id FROM stores WHERE code = 'HOMBRES' LIMIT 1;
  
  -- Obtener IDs de líneas
  SELECT id INTO line_hombres_id FROM lines WHERE LOWER(name) = 'hombres' LIMIT 1;
  SELECT id INTO line_mujeres_id FROM lines WHERE LOWER(name) = 'mujeres' LIMIT 1;
  SELECT id INTO line_ninos_id FROM lines WHERE LOWER(name) = 'niños' LIMIT 1;
  SELECT id INTO line_accesorios_id FROM lines WHERE LOWER(name) = 'accesorios' LIMIT 1;
  SELECT id INTO line_perfumes_id FROM lines WHERE LOWER(name) = 'perfumes' LIMIT 1;
  
  -- TIENDA HOMBRES: Hombres + Accesorios
  IF store_hombres_id IS NOT NULL THEN
    IF line_hombres_id IS NOT NULL THEN
      INSERT INTO line_stores (line_id, store_id) 
      VALUES (line_hombres_id, store_hombres_id)
      ON CONFLICT (line_id, store_id) DO NOTHING;
    END IF;
    
    IF line_accesorios_id IS NOT NULL THEN
      INSERT INTO line_stores (line_id, store_id) 
      VALUES (line_accesorios_id, store_hombres_id)
      ON CONFLICT (line_id, store_id) DO NOTHING;
    END IF;
  END IF;
  
  -- TIENDA MUJERES: Mujeres + Niños + Perfumes + Accesorios
  IF store_mujeres_id IS NOT NULL THEN
    IF line_mujeres_id IS NOT NULL THEN
      INSERT INTO line_stores (line_id, store_id) 
      VALUES (line_mujeres_id, store_mujeres_id)
      ON CONFLICT (line_id, store_id) DO NOTHING;
    END IF;
    
    IF line_ninos_id IS NOT NULL THEN
      INSERT INTO line_stores (line_id, store_id) 
      VALUES (line_ninos_id, store_mujeres_id)
      ON CONFLICT (line_id, store_id) DO NOTHING;
    END IF;
    
    IF line_perfumes_id IS NOT NULL THEN
      INSERT INTO line_stores (line_id, store_id) 
      VALUES (line_perfumes_id, store_mujeres_id)
      ON CONFLICT (line_id, store_id) DO NOTHING;
    END IF;
    
    IF line_accesorios_id IS NOT NULL THEN
      INSERT INTO line_stores (line_id, store_id) 
      VALUES (line_accesorios_id, store_mujeres_id)
      ON CONFLICT (line_id, store_id) DO NOTHING;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. FUNCIÓN HELPER: Obtener líneas por tienda
-- ============================================================================
CREATE OR REPLACE FUNCTION get_lines_by_store(p_store_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l.description,
    l.active,
    l.created_at,
    l.updated_at
  FROM lines l
  INNER JOIN line_stores ls ON l.id = ls.line_id
  WHERE ls.store_id = p_store_id
    AND l.active = true
  ORDER BY l.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. FUNCIÓN HELPER: Verificar si una línea pertenece a una tienda
-- ============================================================================
CREATE OR REPLACE FUNCTION line_belongs_to_store(p_line_id UUID, p_store_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM line_stores 
    WHERE line_id = p_line_id 
      AND store_id = p_store_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. VISTA: Líneas con sus tiendas asignadas
-- ============================================================================
CREATE OR REPLACE VIEW v_lines_with_stores AS
SELECT 
  l.id as line_id,
  l.name as line_name,
  l.description as line_description,
  l.active as line_active,
  s.id as store_id,
  s.code as store_code,
  s.name as store_name,
  ls.created_at as assigned_at
FROM lines l
LEFT JOIN line_stores ls ON l.id = ls.line_id
LEFT JOIN stores s ON ls.store_id = s.id
WHERE l.active = true
ORDER BY l.name, s.name;

-- ============================================================================
-- 6. COMENTARIOS
-- ============================================================================
COMMENT ON TABLE line_stores IS 'Relación many-to-many entre líneas y tiendas. Define qué líneas están disponibles en cada tienda.';
COMMENT ON FUNCTION get_lines_by_store IS 'Retorna todas las líneas activas asignadas a una tienda específica';
COMMENT ON FUNCTION line_belongs_to_store IS 'Verifica si una línea está asignada a una tienda';
COMMENT ON VIEW v_lines_with_stores IS 'Vista que muestra todas las líneas con sus tiendas asignadas';

-- ============================================================================
-- 7. QUERY DE VALIDACIÓN
-- ============================================================================
-- Ejecutar para verificar las asignaciones:
--
-- SELECT * FROM v_lines_with_stores ORDER BY line_name, store_name;
--
-- SELECT 
--   s.name as tienda,
--   COUNT(ls.line_id) as total_lineas,
--   STRING_AGG(l.name, ', ' ORDER BY l.name) as lineas
-- FROM stores s
-- LEFT JOIN line_stores ls ON s.id = ls.store_id
-- LEFT JOIN lines l ON ls.line_id = l.id
-- GROUP BY s.id, s.name
-- ORDER BY s.name;
