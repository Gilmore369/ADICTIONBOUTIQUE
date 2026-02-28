-- ============================================================================
-- SCRIPT SIMPLE: SOLO AGREGAR COORDENADAS A CLIENTES
-- ============================================================================
-- Este script SOLO agrega coordenadas a clientes que no las tienen
-- NO elimina ni modifica otros datos
-- ============================================================================

DO $$
DECLARE
  client_record RECORD;
  random_offset_lat DECIMAL;
  random_offset_lng DECIMAL;
  total_updated INTEGER := 0;
BEGIN
  RAISE NOTICE '=== AGREGANDO COORDENADAS A CLIENTES ===';
  
  -- Agregar coordenadas a clientes sin coordenadas
  FOR client_record IN 
    SELECT id, name FROM clients WHERE lat IS NULL OR lng IS NULL
  LOOP
    -- Generar offset aleatorio para distribuir clientes en Trujillo
    random_offset_lat := (RANDOM() * 0.04) - 0.02; -- ±0.02 grados (~2km)
    random_offset_lng := (RANDOM() * 0.04) - 0.02;
    
    -- Asignar coordenadas de Trujillo con variación
    UPDATE clients
    SET 
      lat = -8.1116 + random_offset_lat,
      lng = -79.0288 + random_offset_lng,
      updated_at = NOW()
    WHERE id = client_record.id;
    
    total_updated := total_updated + 1;
    
    IF total_updated <= 10 THEN
      RAISE NOTICE 'Cliente "%": coordenadas asignadas', client_record.name;
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== COMPLETADO ===';
  RAISE NOTICE 'Total clientes actualizados: %', total_updated;
  
  -- Verificación
  SELECT COUNT(*) INTO total_updated FROM clients WHERE lat IS NOT NULL AND lng IS NOT NULL;
  RAISE NOTICE 'Total clientes con coordenadas: %', total_updated;
  
END;
$$;

-- Verificar resultados
SELECT 
  CASE 
    WHEN lat IS NULL OR lng IS NULL THEN 'Sin coordenadas'
    ELSE 'Con coordenadas'
  END as estado,
  COUNT(*) as cantidad
FROM clients
GROUP BY estado;
