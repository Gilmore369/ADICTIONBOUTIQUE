-- ============================================================================
-- FIX CLIENT COORDINATES
-- ============================================================================
-- Problema: Muchos clientes en Trujillo no tienen coordenadas (lat/lng) registradas
-- Solución: Asignar coordenadas predeterminadas de Trujillo con pequeñas variaciones
--           para que aparezcan en el mapa de deudores
-- ============================================================================

-- Centro de Trujillo, Perú
-- Latitud: -8.1116
-- Longitud: -79.0288

-- Paso 1: Verificar cuántos clientes no tienen coordenadas
SELECT 
  COUNT(*) AS total_clientes,
  COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL) AS sin_coordenadas,
  COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS con_coordenadas
FROM clients;

-- Paso 2: Asignar coordenadas aleatorias dentro del área de Trujillo
-- Rango aproximado: 
-- Latitud: -8.08 a -8.14 (variación de ~0.06 grados = ~6.7 km)
-- Longitud: -79.00 a -79.06 (variación de ~0.06 grados = ~6.7 km)

UPDATE clients
SET 
  lat = -8.1116 + (random() * 0.06 - 0.03),  -- Variación de ±0.03 grados (~3.3 km)
  lng = -79.0288 + (random() * 0.06 - 0.03), -- Variación de ±0.03 grados (~3.3 km)
  updated_at = NOW()
WHERE lat IS NULL OR lng IS NULL;

-- Paso 3: Verificar resultados
SELECT 
  COUNT(*) AS total_clientes,
  COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL) AS sin_coordenadas,
  COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS con_coordenadas,
  MIN(lat) AS lat_min,
  MAX(lat) AS lat_max,
  MIN(lng) AS lng_min,
  MAX(lng) AS lng_max
FROM clients;

-- Paso 4: Mostrar algunos clientes con sus nuevas coordenadas
SELECT 
  id,
  name,
  address,
  lat,
  lng,
  credit_used,
  credit_limit
FROM clients
WHERE lat IS NOT NULL AND lng IS NOT NULL
ORDER BY credit_used DESC
LIMIT 10;

-- Nota: Para coordenadas más precisas, se recomienda:
-- 1. Usar la API de Google Geocoding para convertir direcciones a coordenadas
-- 2. Capturar ubicación GPS durante visitas de cobranza usando la app móvil
-- 3. Permitir que los cobradores actualicen coordenadas desde el mapa
