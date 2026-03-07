-- Verificar si Rosa Elena Mamani tiene foto
SELECT 
  id,
  name,
  dni,
  client_photo_url,
  dni_photo_url,
  lat,
  lng
FROM clients
WHERE name ILIKE '%Rosa Elena Mamani%';

-- Ver todos los clientes con fotos
SELECT 
  id,
  name,
  dni,
  client_photo_url IS NOT NULL as tiene_foto_cliente,
  dni_photo_url IS NOT NULL as tiene_foto_dni,
  lat IS NOT NULL as tiene_coordenadas
FROM clients
WHERE client_photo_url IS NOT NULL OR dni_photo_url IS NOT NULL
ORDER BY name;
