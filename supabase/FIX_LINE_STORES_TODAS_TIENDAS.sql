-- Asociar todas las líneas activas a todas las tiendas activas
-- Ejecuta este script si quieres que TODAS las tiendas vean TODAS las líneas

-- 1. Primero, ver el estado actual
SELECT 
  s.name as tienda,
  s.code as codigo,
  COUNT(DISTINCT ls.line_id) as lineas_actuales
FROM stores s
LEFT JOIN line_stores ls ON s.id = ls.store_id
WHERE s.active = true
GROUP BY s.id, s.name, s.code
ORDER BY s.name;

-- 2. Insertar relaciones faltantes (todas las líneas a todas las tiendas)
INSERT INTO line_stores (store_id, line_id)
SELECT 
  s.id as store_id,
  l.id as line_id
FROM stores s
CROSS JOIN lines l
WHERE s.active = true
  AND l.active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM line_stores ls 
    WHERE ls.store_id = s.id 
      AND ls.line_id = l.id
  )
ON CONFLICT (line_id, store_id) DO NOTHING;

-- 3. Verificar resultado
SELECT 
  s.name as tienda,
  s.code as codigo,
  COUNT(DISTINCT ls.line_id) as lineas_disponibles,
  STRING_AGG(l.name, ', ' ORDER BY l.name) as lineas
FROM stores s
LEFT JOIN line_stores ls ON s.id = ls.store_id
LEFT JOIN lines l ON ls.line_id = l.id AND l.active = true
WHERE s.active = true
GROUP BY s.id, s.name, s.code
ORDER BY s.name;

-- 4. Contar total de relaciones creadas
SELECT 
  COUNT(*) as total_relaciones,
  COUNT(DISTINCT store_id) as tiendas,
  COUNT(DISTINCT line_id) as lineas
FROM line_stores;
