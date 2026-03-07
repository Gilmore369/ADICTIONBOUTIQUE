-- ============================================================================
-- Ver los IDs reales de las líneas en la base de datos
-- ============================================================================
-- Ejecuta esto en Supabase SQL Editor

SELECT 
  id,
  name,
  active,
  created_at
FROM lines
ORDER BY name;
