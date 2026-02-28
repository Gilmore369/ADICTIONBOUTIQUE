-- ============================================================================
-- Migration: Update Collection Actions Options
-- Description: Mejora las opciones de action_type y result para ser más específicas
-- Date: 2024-02-23
-- ============================================================================

-- Eliminar las restricciones existentes
ALTER TABLE collection_actions 
  DROP CONSTRAINT IF EXISTS collection_actions_action_type_check;

ALTER TABLE collection_actions 
  DROP CONSTRAINT IF EXISTS collection_actions_result_check;

-- Agregar nuevas restricciones con opciones mejoradas
ALTER TABLE collection_actions 
  ADD CONSTRAINT collection_actions_action_type_check 
  CHECK (action_type IN (
    'LLAMADA',
    'VISITA',
    'WHATSAPP',
    'MENSAJE_SMS',
    'EMAIL',
    'MOTORIZADO',
    'CARTA_NOTARIAL',
    'OTRO'
  ));

ALTER TABLE collection_actions 
  ADD CONSTRAINT collection_actions_result_check 
  CHECK (result IN (
    'COMPROMISO_PAGO',
    'SE_NIEGA_PAGAR',
    'NO_CONTESTA',
    'TELEFONO_INVALIDO',
    'PAGO_REALIZADO',
    'PAGO_PARCIAL',
    'SOLICITA_REFINANCIAMIENTO',
    'SOLICITA_DESCUENTO',
    'PROMETE_PAGAR_FECHA',
    'CLIENTE_MOLESTO',
    'CLIENTE_COLABORADOR',
    'DOMICILIO_INCORRECTO',
    'CLIENTE_NO_UBICADO',
    'OTRO'
  ));

-- Comentarios para documentar las opciones
COMMENT ON COLUMN collection_actions.action_type IS 
  'Tipo de acción de cobranza: LLAMADA, VISITA, WHATSAPP, MENSAJE_SMS, EMAIL, MOTORIZADO, CARTA_NOTARIAL, OTRO';

COMMENT ON COLUMN collection_actions.result IS 
  'Resultado de la acción: COMPROMISO_PAGO, SE_NIEGA_PAGAR, NO_CONTESTA, TELEFONO_INVALIDO, PAGO_REALIZADO, PAGO_PARCIAL, SOLICITA_REFINANCIAMIENTO, SOLICITA_DESCUENTO, PROMETE_PAGAR_FECHA, CLIENTE_MOLESTO, CLIENTE_COLABORADOR, DOMICILIO_INCORRECTO, CLIENTE_NO_UBICADO, OTRO';
