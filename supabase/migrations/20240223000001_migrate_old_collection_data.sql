-- ============================================================================
-- Migration: Migrate Old Collection Actions Data (OPCIONAL)
-- Description: Convierte valores antiguos a los nuevos valores
-- Date: 2024-02-23
-- ============================================================================
-- NOTA: Este script es OPCIONAL. Solo ejecutar si tienes datos antiguos que migrar.
-- ============================================================================

-- Mapeo de valores antiguos a nuevos
-- PROMESA_PAGO -> COMPROMISO_PAGO
-- SIN_INTENCION -> SE_NIEGA_PAGAR
-- NO_RESPONDE -> NO_CONTESTA
-- PAGO -> PAGO_REALIZADO
-- REPROGRAMADO -> SOLICITA_REFINANCIAMIENTO

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  
  RAISE NOTICE 'Iniciando migración de datos antiguos...';
  
  -- Contar registros a migrar
  SELECT COUNT(*) INTO v_count
  FROM collection_actions
  WHERE result IN ('PROMESA_PAGO', 'SIN_INTENCION', 'NO_RESPONDE', 'PAGO', 'REPROGRAMADO');
  
  RAISE NOTICE 'Registros a migrar: %', v_count;
  
  IF v_count > 0 THEN
    -- Migrar PROMESA_PAGO -> COMPROMISO_PAGO
    UPDATE collection_actions
    SET result = 'COMPROMISO_PAGO'
    WHERE result = 'PROMESA_PAGO';
    
    RAISE NOTICE 'Migrados: PROMESA_PAGO -> COMPROMISO_PAGO';
    
    -- Migrar SIN_INTENCION -> SE_NIEGA_PAGAR
    UPDATE collection_actions
    SET result = 'SE_NIEGA_PAGAR'
    WHERE result = 'SIN_INTENCION';
    
    RAISE NOTICE 'Migrados: SIN_INTENCION -> SE_NIEGA_PAGAR';
    
    -- Migrar NO_RESPONDE -> NO_CONTESTA
    UPDATE collection_actions
    SET result = 'NO_CONTESTA'
    WHERE result = 'NO_RESPONDE';
    
    RAISE NOTICE 'Migrados: NO_RESPONDE -> NO_CONTESTA';
    
    -- Migrar PAGO -> PAGO_REALIZADO
    UPDATE collection_actions
    SET result = 'PAGO_REALIZADO'
    WHERE result = 'PAGO';
    
    RAISE NOTICE 'Migrados: PAGO -> PAGO_REALIZADO';
    
    -- Migrar REPROGRAMADO -> SOLICITA_REFINANCIAMIENTO
    UPDATE collection_actions
    SET result = 'SOLICITA_REFINANCIAMIENTO'
    WHERE result = 'REPROGRAMADO';
    
    RAISE NOTICE 'Migrados: REPROGRAMADO -> SOLICITA_REFINANCIAMIENTO';
    
    RAISE NOTICE '✅ Migración completada exitosamente';
  ELSE
    RAISE NOTICE 'No hay datos antiguos para migrar';
  END IF;
  
END $$;

-- Verificar resultados
SELECT 
  result,
  COUNT(*) as cantidad
FROM collection_actions
GROUP BY result
ORDER BY cantidad DESC;
