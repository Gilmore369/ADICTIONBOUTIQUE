/**
 * Test del normalizador de columnas Excel.
 * Simula EXACTAMENTE las columnas que la plantilla genera y que el usuario subió.
 */

// Copia exacta de schema.ts (no podemos importar TS desde mjs sin build)
const EXCEL_COLUMN_ALIASES = {
  'dni': 'dni',
  'documento': 'dni',
  'cedula': 'dni',
  'cédula': 'dni',
  'nombre': 'name',
  'nombres': 'name',
  'nombre completo': 'name',
  'cliente': 'name',
  'email': 'email',
  'correo': 'email',
  'correo electronico': 'email',
  'correo electrónico': 'email',
  'e-mail': 'email',
  'mail': 'email',
  'telefono': 'phone',
  'teléfono': 'phone',
  'celular': 'phone',
  'movil': 'phone',
  'móvil': 'phone',
  'direccion': 'address',
  'dirección': 'address',
  'domicilio': 'address',
  'distrito': 'district',
  'cumpleaños': 'birthday',
  'cumpleanos': 'birthday',
  'fecha nacimiento': 'birthday',
  'fecha de nacimiento': 'birthday',
  'nacimiento': 'birthday',
  'descripcion compra': 'purchase_description',
  'descripción compra': 'purchase_description',
  'descripcion': 'purchase_description',
  'descripción': 'purchase_description',
  'que compro': 'purchase_description',
  'qué compró': 'purchase_description',
  'producto': 'purchase_description',
  'productos': 'purchase_description',
  'detalle': 'purchase_description',
  'fecha compra': 'purchase_date',
  'fecha de compra': 'purchase_date',
  'fecha': 'purchase_date',
  'fecha venta': 'purchase_date',
  'monto total': 'original_total',
  'total': 'original_total',
  'monto': 'original_total',
  'deuda total': 'original_total',
  'monto original': 'original_total',
  'pagado': 'paid_so_far',
  'monto pagado': 'paid_so_far',
  'total pagado': 'paid_so_far',
  'abonado': 'paid_so_far',
  'fecha vencimiento': 'due_date',
  'fecha de vencimiento': 'due_date',
  'vencimiento': 'due_date',
  'notas': 'notes',
  'observaciones': 'notes',
  'comentarios': 'notes',
  'pagos historicos': 'historical_payments',
  'pagos históricos': 'historical_payments',
  'historial pagos': 'historical_payments',
  'historial de pagos': 'historical_payments',
  'historial pagos detallado': 'historical_payments',
}

function normalizeColumnKey(raw) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[\*\?:()\[\]]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normalizeRowKeys(rawRow) {
  const result = {}
  const aliasNoAccents = {}
  for (const [k, v] of Object.entries(EXCEL_COLUMN_ALIASES)) {
    aliasNoAccents[stripAccents(k)] = v
  }

  for (const [key, value] of Object.entries(rawRow)) {
    const norm = normalizeColumnKey(key)
    let mapped = EXCEL_COLUMN_ALIASES[norm]
    if (!mapped) mapped = aliasNoAccents[stripAccents(norm)]
    if (mapped) {
      result[mapped] = value
      continue
    }
    const tech = norm.replace(/\s+/g, '_')
    if (Object.values(EXCEL_COLUMN_ALIASES).includes(tech)) {
      result[tech] = value
      continue
    }
  }
  return result
}

// ─── Test: columnas exactas de la plantilla (con asterisco y underscore) ───
const userRow = {
  'dni*': '12345690',
  'nombre*': 'María Paula Pinedo',
  'email': 'garcia@gmail.com',
  'telefono': '987654321',
  'direccion': 'Av. España 123',
  'distrito': 'Trujillo',
  'cumpleaños': '1985-07-22',
  'descripcion_compra*': 'Casaca de cuero negra L + 2 polos',
  'fecha_compra*': '2024-08-15',
  'monto_total*': 450,
  'monto_pagado': 150,
  'fecha_vencimiento': '2026-06-30',
  'historial_pagos': '50:2024-09-15:EFECTIVO;100:2024-12-10:YAPE',
  'notas': 'Cliente paga cuando puede',
}

console.log('═══════════════════════════════════════════════════════════════')
console.log('  TEST: normalizeRowKeys con columnas de la plantilla real')
console.log('═══════════════════════════════════════════════════════════════')
console.log('\nInput (columnas con * y underscore):')
console.log(Object.keys(userRow))
console.log('\nOutput normalizado:')
const normalized = normalizeRowKeys(userRow)
console.log(normalized)
console.log('\nValidaciones:')

const expectedKeys = ['dni', 'name', 'email', 'phone', 'address', 'district', 'birthday',
  'purchase_description', 'purchase_date', 'original_total', 'paid_so_far',
  'due_date', 'historical_payments', 'notes']

let allPass = true
for (const key of expectedKeys) {
  const present = normalized[key] !== undefined
  const symbol = present ? '✅' : '❌'
  console.log(`  ${symbol} ${key.padEnd(25)} = ${JSON.stringify(normalized[key])}`)
  if (!present) allPass = false
}

console.log('\n' + (allPass ? '✅ TODOS LOS CAMPOS MAPEADOS CORRECTAMENTE' : '❌ FALTAN CAMPOS'))
