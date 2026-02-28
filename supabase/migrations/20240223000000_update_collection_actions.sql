-- ============================================================================
-- ACTUALIZACIÓN DE OPCIONES DE ACCIONES DE COBRANZA
-- ============================================================================
-- Mejora las opciones de action_type y result para gestión profesional de cobranza
-- ============================================================================

-- Eliminar constraint anterior de action_type
ALTER TABLE collection_actions 
DROP CONSTRAINT IF EXISTS collection_actions_action_type_check;

-- Agregar nuevo constraint con más opciones profesionales
ALTER TABLE collection_actions 
ADD CONSTRAINT collection_actions_action_type_check 
CHECK (action_type IN (
  'LLAMADA',           -- Llamada telefónica
  'VISITA',            -- Visita presencial
  'WHATSAPP',          -- Mensaje por WhatsApp
  'EMAIL',             -- Correo electrónico
  'SMS',               -- Mensaje de texto
  'CARTA',             -- Carta formal
  'MOTORIZADO',        -- Envío de motorizado
  'VIDEOLLAMADA',      -- Videollamada
  'OTRO'               -- Otro tipo de acción
));

-- Eliminar constraint anterior de result
ALTER TABLE collection_actions 
DROP CONSTRAINT IF EXISTS collection_actions_result_check;

-- Agregar nuevo constraint con opciones más completas y profesionales
ALTER TABLE collection_actions 
ADD CONSTRAINT collection_actions_result_check 
CHECK (result IN (
  'COMPROMISO_PAGO',        -- Cliente se compromete a pagar
  'PAGO_REALIZADO',         -- Cliente realizó el pago
  'PAGO_PARCIAL',           -- Cliente realizó pago parcial
  'SE_NIEGA_PAGAR',         -- Cliente se niega a pagar
  'NO_CONTESTA',            -- No responde llamadas/mensajes
  'NUMERO_EQUIVOCADO',      -- Número telefónico incorrecto
  'SOLICITA_REFINANCIACION',-- Cliente solicita refinanciar deuda
  'SOLICITA_DESCUENTO',     -- Cliente solicita descuento
  'SOLICITA_PLAZO',         -- Cliente solicita más plazo
  'PROBLEMAS_ECONOMICOS',   -- Cliente reporta problemas económicos
  'RECLAMO_PRODUCTO',       -- Cliente tiene reclamo sobre producto
  'CLIENTE_FALLECIDO',      -- Cliente ha fallecido
  'CLIENTE_VIAJO',          -- Cliente está de viaje
  'REPROGRAMADO',           -- Seguimiento reprogramado
  'DERIVADO_LEGAL',         -- Caso derivado a área legal
  'OTRO'                    -- Otro resultado
));

-- Agregar comentarios descriptivos
COMMENT ON CONSTRAINT collection_actions_action_type_check ON collection_actions IS 
'Tipos de acción de cobranza: LLAMADA, VISITA, WHATSAPP, EMAIL, SMS, CARTA, MOTORIZADO, VIDEOLLAMADA, OTRO';

COMMENT ON CONSTRAINT collection_actions_result_check ON collection_actions IS 
'Resultados de acción de cobranza: COMPROMISO_PAGO, PAGO_REALIZADO, PAGO_PARCIAL, SE_NIEGA_PAGAR, NO_CONTESTA, NUMERO_EQUIVOCADO, SOLICITA_REFINANCIACION, SOLICITA_DESCUENTO, SOLICITA_PLAZO, PROBLEMAS_ECONOMICOS, RECLAMO_PRODUCTO, CLIENTE_FALLECIDO, CLIENTE_VIAJO, REPROGRAMADO, DERIVADO_LEGAL, OTRO';
