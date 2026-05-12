/**
 * Legacy Debt Import — Schemas y tipos
 *
 * Una "fila" de importación = un cliente + su deuda + pagos históricos.
 * Si el cliente ya existe (match por DNI), solo se le agrega la deuda.
 * Si no existe, se crea el cliente.
 */

import { z } from 'zod'

// ── Helpers ────────────────────────────────────────────────────────────────
const isoDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha debe ser YYYY-MM-DD')

const optionalIsoDate = z.union([
  isoDate,
  z.literal(''),
  z.null(),
  z.undefined(),
]).transform(v => (v === '' || v == null) ? undefined : v as string)

const optionalString = z.union([
  z.string().trim(),
  z.null(),
  z.undefined(),
]).transform(v => {
  if (v == null) return undefined
  const t = (v as string).trim()
  return t === '' ? undefined : t
})

// Acepta números con coma decimal (es-PE: "1,234.50") o punto
const decimalCoerce = z.preprocess((v) => {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^\d.,-]/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '')
    const n = parseFloat(cleaned)
    return isNaN(n) ? undefined : n
  }
  return undefined
}, z.number().min(0))

const positiveDecimal = z.preprocess((v) => {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^\d.,-]/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '')
    const n = parseFloat(cleaned)
    return isNaN(n) ? undefined : n
  }
  return undefined
}, z.number().positive('Debe ser mayor a 0'))

function parseMoneyInput(value: string): number {
  const raw = value.replace(/[^\d.,-]/g, '').trim()
  const lastComma = raw.lastIndexOf(',')
  const lastDot = raw.lastIndexOf('.')

  let normalized = raw
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '')
  } else if (lastComma >= 0) {
    normalized = raw.replace(',', '.')
  }

  return parseFloat(normalized)
}

function normalizeHistoricalPaymentDate(value: string): string {
  const date = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date

  const match = date.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return date
}

// ── Pago histórico (sub-record) ────────────────────────────────────────────
export const HistoricalPaymentSchema = z.object({
  amount: positiveDecimal,
  payment_date: isoDate,
  method: optionalString.optional(),  // 'EFECTIVO' | 'YAPE' | etc.
  notes: optionalString.optional(),
})

export type HistoricalPayment = z.infer<typeof HistoricalPaymentSchema>

// ── Fila de deuda (input principal) ────────────────────────────────────────
export const LegacyDebtRowSchema = z.object({
  // ── Cliente ──
  dni: z.string().trim().min(8, 'DNI debe tener al menos 8 caracteres').max(20),
  name: z.string().trim().min(2, 'Nombre requerido'),
  email: optionalString.optional(),
  phone: optionalString.optional(),
  address: optionalString.optional(),
  district: optionalString.optional(),  // se concatena en address si llega
  birthday: optionalIsoDate.optional(),

  // ── Deuda ──
  purchase_description: z.string().trim().min(2, 'Describe qué compró'),
  purchase_date: isoDate,
  original_total: positiveDecimal,                 // monto original de la deuda
  paid_so_far: decimalCoerce.optional().default(0),// total pagado a la fecha (suma de pagos históricos)
  due_date: optionalIsoDate.optional(),            // fecha pactada de pago final (opcional)
  notes: optionalString.optional(),

  // ── Pagos históricos opcionales (string CSV o array) ──
  // Formato CSV: "monto:fecha;monto:fecha"  ej: "100:2024-05-10;200:2024-06-15"
  historical_payments: z.union([
    z.string(),
    z.array(HistoricalPaymentSchema),
    z.null(),
    z.undefined(),
  ]).optional(),
}).refine(d => d.paid_so_far === undefined || d.paid_so_far <= d.original_total, {
  message: 'El monto pagado no puede ser mayor al total original',
  path: ['paid_so_far'],
})

export type LegacyDebtRow = z.infer<typeof LegacyDebtRowSchema>

// ── Output: resultado de procesar una fila ─────────────────────────────────
export interface LegacyImportRowResult {
  row_index: number
  status: 'success' | 'error'
  client_id?: string
  client_was_created?: boolean
  credit_plan_id?: string
  payments_created?: number
  remaining_debt?: number
  error?: string
  // Snapshot del input para auditoría
  input?: LegacyDebtRow
}

// ── Output: resultado del batch completo ───────────────────────────────────
export interface LegacyImportBatchResult {
  success: boolean
  batch_id?: string
  total_rows: number
  successful_rows: number
  failed_rows: number
  total_debt_amount: number
  results: LegacyImportRowResult[]
  error?: string
}

// ── Parsea historical_payments string a array ─────────────────────────────
export function parseHistoricalPayments(input: unknown): HistoricalPayment[] {
  if (Array.isArray(input)) {
    return input.map(p => HistoricalPaymentSchema.parse(p))
  }
  if (typeof input !== 'string' || !input.trim()) return []

  // Formato: "100:2024-05-10;200:2024-06-15"  o
  //         "100:2024-05-10:EFECTIVO;200:2024-06-15:YAPE"
  const parts = input.split(/[;\n]+/).map(s => s.trim()).filter(Boolean)
  return parts.map(part => {
    const separator = part.includes('|') ? '|' : ':'
    const tokens = part.split(separator).map(s => s.trim())
    const [amountStr, dateStr, method, ...notesArr] = tokens
    const amount = parseMoneyInput(amountStr)
    if (isNaN(amount) || amount <= 0) {
      throw new Error(`Pago inválido: "${part}" — formato esperado "monto:YYYY-MM-DD[:metodo[:nota]]"`)
    }
    const paymentDate = normalizeHistoricalPaymentDate(dateStr || '')
    if (!paymentDate || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      throw new Error(`Fecha de pago inválida en "${part}" — usar YYYY-MM-DD o DD/MM/YYYY`)
    }
    return HistoricalPaymentSchema.parse({
      amount,
      payment_date: paymentDate,
      method: method || undefined,
      notes: notesArr.length > 0 ? notesArr.join(':') : undefined,
    })
  })
}

// ── Columnas esperadas del Excel/CSV (orden + alias) ──────────────────────
// Permite que el usuario use cualquier capitalización o variante
export const EXCEL_COLUMN_ALIASES: Record<string, keyof LegacyDebtRow> = {
  // DNI
  'dni': 'dni',
  'documento': 'dni',
  'cedula': 'dni',
  'cédula': 'dni',
  // Nombre
  'nombre': 'name',
  'nombres': 'name',
  'nombre completo': 'name',
  'cliente': 'name',
  // Email
  'email': 'email',
  'correo': 'email',
  'correo electronico': 'email',
  'correo electrónico': 'email',
  'e-mail': 'email',
  'mail': 'email',
  // Phone
  'telefono': 'phone',
  'teléfono': 'phone',
  'celular': 'phone',
  'movil': 'phone',
  'móvil': 'phone',
  // Address
  'direccion': 'address',
  'dirección': 'address',
  'domicilio': 'address',
  // District
  'distrito': 'district',
  // Birthday
  'cumpleaños': 'birthday',
  'cumpleanos': 'birthday',
  'fecha nacimiento': 'birthday',
  'fecha de nacimiento': 'birthday',
  'nacimiento': 'birthday',
  // Purchase desc
  'descripcion compra': 'purchase_description',
  'descripción compra': 'purchase_description',
  'descripcion': 'purchase_description',
  'descripción': 'purchase_description',
  'que compro': 'purchase_description',
  'qué compró': 'purchase_description',
  'producto': 'purchase_description',
  'productos': 'purchase_description',
  'detalle': 'purchase_description',
  // Purchase date
  'fecha compra': 'purchase_date',
  'fecha de compra': 'purchase_date',
  'fecha': 'purchase_date',
  'fecha venta': 'purchase_date',
  // Original total
  'monto total': 'original_total',
  'total': 'original_total',
  'monto': 'original_total',
  'deuda total': 'original_total',
  'monto original': 'original_total',
  // Paid so far
  'pagado': 'paid_so_far',
  'monto pagado': 'paid_so_far',
  'total pagado': 'paid_so_far',
  'abonado': 'paid_so_far',
  // Due date
  'fecha vencimiento': 'due_date',
  'fecha de vencimiento': 'due_date',
  'vencimiento': 'due_date',
  // Notes
  'notas': 'notes',
  'observaciones': 'notes',
  'comentarios': 'notes',
  // Historical payments
  'pagos historicos': 'historical_payments',
  'pagos históricos': 'historical_payments',
  'historial pagos': 'historical_payments',
  'historial de pagos': 'historical_payments',
  'historial pagos detallado': 'historical_payments',
}

/**
 * Normaliza una clave de columna Excel/CSV:
 * - lowercase
 * - sin espacios alrededor
 * - sin asteriscos (`*` marca campos obligatorios visualmente)
 * - sin signos de interrogación, paréntesis, dos puntos
 * - underscores → espacios (para que `descripcion_compra` coincida con `descripcion compra`)
 * - acentos preservados (los aliases incluyen ambas versiones)
 */
function normalizeColumnKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[\*\?:()\[\]]/g, '')   // sin marcadores ni signos
    .replace(/_/g, ' ')              // underscores → espacios
    .replace(/\s+/g, ' ')            // múltiples espacios → uno
    .trim()
}

/** Versión sin acentos para fallback ("descripción" → "descripcion") */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Mapea una fila cruda (objeto con keys en español) a LegacyDebtRow
export function normalizeRowKeys(rawRow: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}

  // Construir mapa de aliases sin acentos también (para tolerancia)
  const aliasNoAccents: Record<string, keyof LegacyDebtRow> = {}
  for (const [k, v] of Object.entries(EXCEL_COLUMN_ALIASES)) {
    aliasNoAccents[stripAccents(k)] = v
  }

  for (const [key, value] of Object.entries(rawRow)) {
    const norm = normalizeColumnKey(key)

    // 1) match directo con alias
    let mapped = EXCEL_COLUMN_ALIASES[norm]

    // 2) match sin acentos
    if (!mapped) mapped = aliasNoAccents[stripAccents(norm)]

    if (mapped) {
      result[mapped] = value
      continue
    }

    // 3) match contra el nombre técnico (snake_case interno)
    const tech = norm.replace(/\s+/g, '_')
    if (Object.values(EXCEL_COLUMN_ALIASES).includes(tech as any)) {
      result[tech] = value
      continue
    }

    // 4) descarte: no es una columna reconocida (silencioso)
  }
  return result
}
