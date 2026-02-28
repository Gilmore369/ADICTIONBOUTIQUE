-- ============================================================================
-- Migration: Fix collection_actions check constraints
-- Description: Comprehensive result/action_type values that cover both the
--              current form options and legacy data already stored in the DB.
-- Date: 2026-02-24
-- ============================================================================

-- Drop old constraints (idempotent)
ALTER TABLE collection_actions
  DROP CONSTRAINT IF EXISTS collection_actions_action_type_check;

ALTER TABLE collection_actions
  DROP CONSTRAINT IF EXISTS collection_actions_result_check;

-- ── action_type ──────────────────────────────────────────────────────────────
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

-- ── result ───────────────────────────────────────────────────────────────────
-- Includes current form values + legacy values already stored in DB
ALTER TABLE collection_actions
  ADD CONSTRAINT collection_actions_result_check
  CHECK (result IN (
    -- Current form values (new set)
    'COMPROMISO_PAGO',
    'PROMETE_PAGAR_FECHA',
    'PAGO_REALIZADO',
    'PAGO_PARCIAL',
    'CLIENTE_COLABORADOR',
    'SOLICITA_REFINANCIAMIENTO',
    'SOLICITA_DESCUENTO',
    'SE_NIEGA_PAGAR',
    'NO_CONTESTA',
    'TELEFONO_INVALIDO',
    'CLIENTE_MOLESTO',
    'DOMICILIO_INCORRECTO',
    'CLIENTE_NO_UBICADO',
    'OTRO',
    -- Legacy values present in existing DB rows (old migration set)
    'NUMERO_EQUIVOCADO',
    'SOLICITA_REFINANCIACION',
    'SOLICITA_PLAZO',
    'PROBLEMAS_ECONOMICOS',
    'RECLAMO_PRODUCTO',
    'CLIENTE_FALLECIDO',
    'CLIENTE_VIAJO',
    'REPROGRAMADO',
    'DERIVADO_LEGAL'
  ));

COMMENT ON COLUMN collection_actions.action_type IS
  'Tipo de gestión: LLAMADA, VISITA, WHATSAPP, MENSAJE_SMS, EMAIL, MOTORIZADO, CARTA_NOTARIAL, OTRO';

COMMENT ON COLUMN collection_actions.result IS
  'Resultado: COMPROMISO_PAGO, PROMETE_PAGAR_FECHA, PAGO_REALIZADO, PAGO_PARCIAL, SE_NIEGA_PAGAR, NO_CONTESTA, TELEFONO_INVALIDO, CLIENTE_MOLESTO, CLIENTE_COLABORADOR, DOMICILIO_INCORRECTO, CLIENTE_NO_UBICADO, SOLICITA_REFINANCIAMIENTO, SOLICITA_DESCUENTO, OTRO (+ legacy values)';
