/**
 * Constantes para Acciones de Cobranza
 * 
 * Define los tipos de acciones y resultados disponibles para la gestión de cobranza
 */

export const COLLECTION_ACTION_TYPES = [
  { value: 'LLAMADA', label: 'Llamada Telefónica', icon: '📞' },
  { value: 'VISITA', label: 'Visita Presencial', icon: '🚶' },
  { value: 'WHATSAPP', label: 'Mensaje WhatsApp', icon: '💬' },
  { value: 'EMAIL', label: 'Correo Electrónico', icon: '📧' },
  { value: 'SMS', label: 'Mensaje de Texto', icon: '📱' },
  { value: 'CARTA', label: 'Carta Formal', icon: '📄' },
  { value: 'MOTORIZADO', label: 'Envío Motorizado', icon: '🏍️' },
  { value: 'VIDEOLLAMADA', label: 'Videollamada', icon: '📹' },
  { value: 'OTRO', label: 'Otro', icon: '📋' },
] as const

export const COLLECTION_RESULTS = [
  { 
    value: 'COMPROMISO_PAGO', 
    label: 'Compromiso de Pago', 
    icon: '🤝',
    color: 'text-blue-600',
    requiresDate: true,
    description: 'Cliente se compromete a pagar en fecha específica'
  },
  { 
    value: 'PAGO_REALIZADO', 
    label: 'Pago Realizado', 
    icon: '✅',
    color: 'text-green-600',
    requiresDate: false,
    description: 'Cliente realizó el pago completo'
  },
  { 
    value: 'PAGO_PARCIAL', 
    label: 'Pago Parcial', 
    icon: '💰',
    color: 'text-green-500',
    requiresDate: true,
    description: 'Cliente realizó pago parcial, pendiente saldo'
  },
  { 
    value: 'SE_NIEGA_PAGAR', 
    label: 'Se Niega a Pagar', 
    icon: '❌',
    color: 'text-red-600',
    requiresDate: false,
    description: 'Cliente se niega explícitamente a pagar'
  },
  { 
    value: 'NO_CONTESTA', 
    label: 'No Contesta', 
    icon: '📵',
    color: 'text-gray-500',
    requiresDate: true,
    description: 'No responde llamadas ni mensajes'
  },
  { 
    value: 'NUMERO_EQUIVOCADO', 
    label: 'Número Equivocado', 
    icon: '☎️',
    color: 'text-gray-600',
    requiresDate: false,
    description: 'Número telefónico incorrecto o desactualizado'
  },
  { 
    value: 'SOLICITA_REFINANCIACION', 
    label: 'Solicita Refinanciación', 
    icon: '🔄',
    color: 'text-orange-600',
    requiresDate: true,
    description: 'Cliente solicita refinanciar su deuda'
  },
  { 
    value: 'SOLICITA_DESCUENTO', 
    label: 'Solicita Descuento', 
    icon: '💸',
    color: 'text-orange-500',
    requiresDate: true,
    description: 'Cliente solicita descuento en la deuda'
  },
  { 
    value: 'SOLICITA_PLAZO', 
    label: 'Solicita Más Plazo', 
    icon: '⏰',
    color: 'text-yellow-600',
    requiresDate: true,
    description: 'Cliente solicita extensión de plazo'
  },
  { 
    value: 'PROBLEMAS_ECONOMICOS', 
    label: 'Problemas Económicos', 
    icon: '💔',
    color: 'text-red-500',
    requiresDate: true,
    description: 'Cliente reporta dificultades económicas'
  },
  { 
    value: 'RECLAMO_PRODUCTO', 
    label: 'Reclamo sobre Producto', 
    icon: '⚠️',
    color: 'text-yellow-500',
    requiresDate: true,
    description: 'Cliente tiene reclamo sobre el producto/servicio'
  },
  { 
    value: 'CLIENTE_FALLECIDO', 
    label: 'Cliente Fallecido', 
    icon: '🕊️',
    color: 'text-gray-700',
    requiresDate: false,
    description: 'Se informa fallecimiento del cliente'
  },
  { 
    value: 'CLIENTE_VIAJO', 
    label: 'Cliente de Viaje', 
    icon: '✈️',
    color: 'text-blue-500',
    requiresDate: true,
    description: 'Cliente está de viaje temporalmente'
  },
  { 
    value: 'REPROGRAMADO', 
    label: 'Reprogramado', 
    icon: '📅',
    color: 'text-purple-600',
    requiresDate: true,
    description: 'Seguimiento reprogramado para otra fecha'
  },
  { 
    value: 'DERIVADO_LEGAL', 
    label: 'Derivado a Legal', 
    icon: '⚖️',
    color: 'text-red-700',
    requiresDate: false,
    description: 'Caso derivado al área legal'
  },
  { 
    value: 'OTRO', 
    label: 'Otro', 
    icon: '📝',
    color: 'text-gray-600',
    requiresDate: false,
    description: 'Otro resultado no especificado'
  },
] as const

export type CollectionActionType = typeof COLLECTION_ACTION_TYPES[number]['value']
export type CollectionResult = typeof COLLECTION_RESULTS[number]['value']

/**
 * Obtiene el label de un tipo de acción
 */
export function getActionTypeLabel(value: string): string {
  return COLLECTION_ACTION_TYPES.find(t => t.value === value)?.label || value
}

/**
 * Obtiene el label de un resultado
 */
export function getResultLabel(value: string): string {
  return COLLECTION_RESULTS.find(r => r.value === value)?.label || value
}

/**
 * Obtiene el color de un resultado
 */
export function getResultColor(value: string): string {
  return COLLECTION_RESULTS.find(r => r.value === value)?.color || 'text-gray-600'
}

/**
 * Verifica si un resultado requiere fecha de seguimiento
 */
export function requiresFollowUpDate(result: string): boolean {
  return COLLECTION_RESULTS.find(r => r.value === result)?.requiresDate || false
}
