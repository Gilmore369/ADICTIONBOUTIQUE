-- Verificar que las fotos de clientes se están guardando correctamente

-- Ver cliente recién creado con sus fotos
SELECT 
  id,
  dni,
  name,
  phone,
  email,
  address,
  lat,
  lng,
  credit_limit,
  dni_photo_url,
  client_photo_url,
  referred_by,
  created_at
FROM clients
WHERE dni = '01069627'
ORDER BY created_at DESC
LIMIT 1;

-- Ver todos los clientes con fotos
SELECT 
  id,
  dni,
  name,
  CASE 
    WHEN dni_photo_url IS NOT NULL THEN '✓ Tiene foto DNI'
    ELSE '✗ Sin foto DNI'
  END as dni_photo_status,
  CASE 
    WHEN client_photo_url IS NOT NULL THEN '✓ Tiene foto cliente'
    ELSE '✗ Sin foto cliente'
  END as client_photo_status,
  CASE 
    WHEN lat IS NOT NULL AND lng IS NOT NULL THEN '✓ Tiene coordenadas'
    ELSE '✗ Sin coordenadas'
  END as coordinates_status,
  created_at
FROM clients
WHERE active = true
ORDER BY created_at DESC
LIMIT 10;

-- Ver cliente con su referidor
SELECT 
  c.id,
  c.dni,
  c.name as client_name,
  r.name as referred_by_name,
  r.dni as referred_by_dni,
  c.created_at
FROM clients c
LEFT JOIN clients r ON c.referred_by = r.id
WHERE c.dni = '01069627';
