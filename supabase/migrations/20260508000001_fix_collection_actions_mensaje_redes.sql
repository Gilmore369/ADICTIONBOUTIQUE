-- =============================================================================
-- Migración: Agregar MENSAJE_REDES al constraint de collection_actions
-- Fecha: 2026-05-08
-- Problema: La constraint solo permitía MENSAJE_SMS pero el sistema envía
--           MENSAJE_REDES. Workaround actual: normaliza a OTRO antes de insertar.
--           Esta migración hace el fix permanente.
-- =============================================================================

SET search_path = public, pg_temp;

-- 1. Eliminar constraint anterior
ALTER TABLE collection_actions
  DROP CONSTRAINT IF EXISTS collection_actions_action_type_check;

-- 2. Crear constraint actualizada con MENSAJE_REDES incluido
ALTER TABLE collection_actions
  ADD CONSTRAINT collection_actions_action_type_check
  CHECK (action_type IN (
    'LLAMADA',
    'VISITA',
    'WHATSAPP',
    'MENSAJE_SMS',
    'MENSAJE_REDES',
    'EMAIL',
    'MOTORIZADO',
    'CARTA_NOTARIAL',
    'OTRO'
  ));

-- 3. Corregir registros existentes que quedaron guardados como OTRO
--    cuando en realidad eran MENSAJE_REDES
--    (opcional — no hay forma de distinguirlos, se deja como está)

-- Verificar que quedó bien:
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'collection_actions_action_type_check';
