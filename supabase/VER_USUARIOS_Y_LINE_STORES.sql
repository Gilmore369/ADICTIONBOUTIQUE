-- Ver usuarios y sus tiendas
SELECT 
  id,
  email,
  name,
  stores,
  roles
FROM users
LIMIT 5;

-- Ver line_stores completo
SELECT 
  ls.id,
  ls.store_id,
  ls.line_id,
  s.code as store_code,
  s.name as store_name,
  l.name as line_name
FROM line_stores ls
JOIN stores s ON ls.store_id = s.id
JOIN lines l ON ls.line_id = l.id
ORDER BY s.code, l.name;

-- Ver todas las líneas
SELECT id, name FROM lines WHERE active = true ORDER BY name;
