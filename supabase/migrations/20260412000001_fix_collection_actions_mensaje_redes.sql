-- ============================================================================
-- Migration: Add MENSAJE_REDES to collection_actions action_type constraint
-- The form uses MENSAJE_REDES ("Mensaje por Redes Sociales") but the previous
-- constraint only allowed MENSAJE_SMS. This fixes the constraint violation.
-- Date: 2026-04-12
-- ============================================================================

-- Drop existing action_type constraint
ALTER TABLE collection_actions
  DROP CONSTRAINT IF EXISTS collection_actions_action_type_check;

-- Recreate with MENSAJE_REDES included (keep MENSAJE_SMS for legacy data)
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
