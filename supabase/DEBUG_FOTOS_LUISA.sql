-- Verificar datos de Luisa Isabel Bazauri Marquina
SELECT 
  id,
  name,
  dni,
  client_photo_url,
  dni_photo_url,
  lat,
  lng,
  LENGTH(client_photo_url) as longitud_url_foto,
  client_photo_url LIKE '%supabase%' as es_url_supabase
FROM clients
WHERE dni = '01069627' OR name ILIKE '%Luisa%Bazauri%';

-- Ver si las URLs de fotos son accesibles
SELECT 
  name,
  CASE 
    WHEN client_photo_url IS NULL THEN 'Sin foto'
    WHEN client_photo_url LIKE 'https://%' THEN 'URL completa'
    ELSE 'URL incompleta'
  END as estado_url_foto
FROM clients
WHERE dni = '01069627';
