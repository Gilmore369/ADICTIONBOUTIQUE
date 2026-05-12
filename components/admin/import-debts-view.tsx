'use client'

/**
 * ImportDebtsView — Importación masiva de deudas legacy
 *
 * 3 modos:
 *   - Manual: 1 cliente por vez (formulario completo)
 *   - Lote:   hasta 10 filas dentro de la app (tabla editable)
 *   - Archivo: subir Excel/CSV (con preview antes de confirmar)
 *
 * En todos los casos:
 *   1. Validación con Zod (se muestran errores antes de tocar BD)
 *   2. Preview: el usuario ve qué se va a crear
 *   3. Confirmar → llama a importLegacyDebts (server action)
 *   4. Resultado por fila: éxito / error con detalle
 */

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx-js-style'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  User,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Eye,
  Save,
  History,
  Info,
} from 'lucide-react'
import { generateLegacyImportTemplate } from '@/lib/legacy-import/template'
import {
  validateLegacyDebtRows,
  importLegacyDebts,
  listLegacyImportBatches,
} from '@/actions/legacy-import'
import type { LegacyImportRowResult, LegacyImportBatchResult } from '@/lib/legacy-import/schema'

type Mode = 'manual' | 'batch' | 'file' | 'history'

// ── Forma de fila editable en UI (todos los campos como string para inputs) ──
interface EditableRow {
  id: string
  dni: string
  name: string
  email: string
  phone: string
  address: string
  district: string
  birthday: string
  purchase_description: string
  purchase_date: string
  original_total: string
  paid_so_far: string
  due_date: string
  historical_payments: string
  notes: string
}

const emptyRow = (): EditableRow => ({
  id: crypto.randomUUID(),
  dni: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  district: '',
  birthday: '',
  purchase_description: '',
  purchase_date: '',
  original_total: '',
  paid_so_far: '',
  due_date: '',
  historical_payments: '',
  notes: '',
})

// Convierte EditableRow → objeto plano para enviar al backend
function parseDraftMoney(value: string): number {
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

  const amount = parseFloat(normalized)
  return Number.isFinite(amount) ? amount : 0
}

function getHistoricalPaymentsDraftSummary(value: string): { count: number; total: number } {
  const entries = value
    .split(/[;\n]+/)
    .map(part => part.trim())
    .filter(Boolean)

  const total = entries.reduce((sum, entry) => {
    const separator = entry.includes('|') ? '|' : ':'
    const [amount] = entry.split(separator)
    return sum + parseDraftMoney(amount || '')
  }, 0)

  return {
    count: entries.length,
    total: Math.round(total * 100) / 100,
  }
}

function rowToPayload(r: EditableRow) {
  const historySummary = getHistoricalPaymentsDraftSummary(r.historical_payments)
  const paidSoFar = r.paid_so_far || (historySummary.total > 0 ? String(historySummary.total) : 0)

  return {
    dni: r.dni,
    name: r.name,
    email: r.email || undefined,
    phone: r.phone || undefined,
    address: r.address || undefined,
    district: r.district || undefined,
    birthday: r.birthday || undefined,
    purchase_description: r.purchase_description,
    purchase_date: r.purchase_date,
    original_total: r.original_total,
    paid_so_far: paidSoFar,
    due_date: r.due_date || undefined,
    historical_payments: r.historical_payments || undefined,
    notes: r.notes || undefined,
  }
}

export function ImportDebtsView() {
  const [mode, setMode] = useState<Mode>('manual')

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <Card className="p-1.5">
        <div className="flex flex-wrap gap-1">
          <ModeTab active={mode === 'manual'} onClick={() => setMode('manual')} icon={User} label="Individual (1 a la vez)" />
          <ModeTab active={mode === 'batch'} onClick={() => setMode('batch')} icon={Users} label="Lote (hasta 10)" />
          <ModeTab active={mode === 'file'} onClick={() => setMode('file')} icon={FileSpreadsheet} label="Archivo Excel/CSV" />
          <ModeTab active={mode === 'history'} onClick={() => setMode('history')} icon={History} label="Historial de importaciones" />
        </div>
      </Card>

      {/* Help banner */}
      {mode !== 'history' && (
        <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/30 border-blue-200">
          <div className="flex gap-2 items-start">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed">
              Las deudas importadas quedan etiquetadas como <strong>Legacy</strong> y pueden ser
              consultadas, editadas y cobradas como cualquier otra deuda del sistema. Si el cliente ya
              existe (DNI duplicado), solo se le agrega la deuda nueva. Si no existe, se crea
              automáticamente.
            </div>
          </div>
        </Card>
      )}

      {mode === 'manual' && <ManualMode />}
      {mode === 'batch' && <BatchMode />}
      {mode === 'file' && <FileMode />}
      {mode === 'history' && <HistoryMode />}
    </div>
  )
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: any
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-foreground/70 hover:bg-accent'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL — 1 cliente por vez
// ─────────────────────────────────────────────────────────────────────────────
function ManualMode() {
  const [row, setRow] = useState<EditableRow>(emptyRow())
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<LegacyImportRowResult | null>(null)

  const update = (key: keyof EditableRow, value: string) =>
    setRow(r => ({ ...r, [key]: value }))

  const handleSubmit = async () => {
    setSubmitting(true)
    setLastResult(null)
    try {
      const payload = rowToPayload(row)
      const result = await importLegacyDebts([payload], { sourceLabel: 'Manual (individual)' })
      const firstResult = result.results[0]
      setLastResult(firstResult || null)

      if (firstResult?.status === 'success') {
        toast.success(
          firstResult.client_was_created ? 'Cliente creado y deuda registrada' : 'Deuda agregada al cliente existente',
          { description: `Saldo pendiente: S/ ${(firstResult.remaining_debt ?? 0).toFixed(2)}` }
        )
        setRow(emptyRow())
      } else {
        toast.error('Error', { description: firstResult?.error || 'No se pudo importar' })
      }
    } catch (e) {
      toast.error('Error inesperado', { description: e instanceof Error ? e.message : '' })
    } finally {
      setSubmitting(false)
    }
  }

  const historySummary = getHistoricalPaymentsDraftSummary(row.historical_payments)
  const effectivePaid = row.paid_so_far
    ? parseDraftMoney(row.paid_so_far)
    : historySummary.total
  const remaining = Math.max(0, (parseFloat(row.original_total) || 0) - effectivePaid)

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        <User className="h-4 w-4" /> Datos del cliente y la deuda
      </h2>

      <div className="space-y-4">
        {/* Cliente */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="DNI *" value={row.dni} onChange={v => update('dni', v)} placeholder="12345678" />
          <Field label="Nombre completo *" value={row.name} onChange={v => update('name', v)} placeholder="María García" className="md:col-span-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Correo electrónico" type="email" value={row.email} onChange={v => update('email', v)} placeholder="cliente@gmail.com" />
          <Field label="Teléfono" value={row.phone} onChange={v => update('phone', v)} placeholder="987654321" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Dirección" value={row.address} onChange={v => update('address', v)} placeholder="Av. España 123" className="md:col-span-2" />
          <Field label="Distrito" value={row.district} onChange={v => update('district', v)} placeholder="Trujillo" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Cumpleaños" type="date" value={row.birthday} onChange={v => update('birthday', v)} />
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold mb-3">Detalle de la deuda</h3>
          <div className="space-y-3">
            <Field label="¿Qué compró? *" value={row.purchase_description} onChange={v => update('purchase_description', v)} placeholder="Casaca de cuero negra L + 2 polos" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Fecha de compra *" type="date" value={row.purchase_date} onChange={v => update('purchase_date', v)} />
              <Field label="Monto total (S/) *" type="number" value={row.original_total} onChange={v => update('original_total', v)} placeholder="450.00" />
              <Field label="Monto ya pagado (S/)" type="number" value={row.paid_so_far} onChange={v => update('paid_so_far', v)} placeholder="150.00" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Fecha de vencimiento" type="date" value={row.due_date} onChange={v => update('due_date', v)} />
              <div className="bg-muted/30 rounded-lg p-3 flex flex-col justify-center">
                <span className="text-xs text-muted-foreground">Saldo pendiente</span>
                <span className="text-xl font-bold tabular-nums text-foreground">
                  S/ {remaining.toFixed(2)}
                </span>
              </div>
            </div>
            <div>
              <Label className="text-xs">Historial de pagos detallado (opcional)</Label>
              <Textarea
                value={row.historical_payments}
                onChange={e => update('historical_payments', e.target.value)}
                placeholder={'300 | 30/12/2024 | EFECTIVO | Pago inicial\n270 | 30/11/2025 | YAPE | Abono con captura'}
                className="font-mono text-xs min-h-20"
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Un pago por linea: <code>monto | fecha | metodo | nota</code>. Fecha: YYYY-MM-DD o DD/MM/YYYY.
              </p>
              {historySummary.count > 0 && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                  {historySummary.count} pago(s) detallado(s) por S/ {historySummary.total.toFixed(2)}
                  {!row.paid_so_far ? ' se usaran como monto ya pagado.' : '.'}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <Textarea
                value={row.notes}
                onChange={e => update('notes', e.target.value)}
                placeholder="Cliente del sistema anterior, paga a plazos…"
                className="text-sm"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Result */}
        {lastResult && (
          <div className={`p-3 rounded-lg border ${
            lastResult.status === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200'
          }`}>
            {lastResult.status === 'success' ? (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">Importación exitosa</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {lastResult.client_was_created ? 'Nuevo cliente creado' : 'Cliente existente actualizado'} ·
                    Saldo pendiente: S/ {(lastResult.remaining_debt ?? 0).toFixed(2)} ·
                    {lastResult.payments_created ?? 0} pago(s) histórico(s) registrado(s)
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-rose-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-rose-900 dark:text-rose-100">Error</p>
                  <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{lastResult.error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t">
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitting ? 'Importando…' : 'Importar deuda'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  className?: string
}) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LOTE — hasta 10 filas en una tabla editable
// ─────────────────────────────────────────────────────────────────────────────
function BatchMode() {
  const [rows, setRows] = useState<EditableRow[]>([emptyRow()])
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<LegacyImportRowResult[] | null>(null)

  const addRow = () => {
    if (rows.length >= 10) {
      toast.warning('Máximo 10 filas por lote. Usa el modo Archivo para más.')
      return
    }
    setRows([...rows, emptyRow()])
  }

  const removeRow = (id: string) => {
    if (rows.length === 1) {
      setRows([emptyRow()])
      return
    }
    setRows(rows.filter(r => r.id !== id))
  }

  const updateRow = (id: string, key: keyof EditableRow, value: string) => {
    setRows(rs => rs.map(r => (r.id === id ? { ...r, [key]: value } : r)))
  }

  const handleSubmit = async () => {
    const valid = rows.filter(r => r.dni.trim() && r.name.trim() && r.original_total)
    if (valid.length === 0) {
      toast.error('Llena al menos una fila completa')
      return
    }

    setSubmitting(true)
    setResults(null)
    try {
      const payload = valid.map(rowToPayload)
      const result = await importLegacyDebts(payload, { sourceLabel: `Lote (${valid.length} filas)` })
      setResults(result.results)
      if (result.success) {
        toast.success(`${result.successful_rows} deuda(s) importada(s)`, {
          description: `S/ ${result.total_debt_amount.toFixed(2)} en saldo total`,
        })
        // Limpiar solo las filas exitosas
        const failedIndexes = new Set(
          result.results.filter(r => r.status === 'error').map(r => r.row_index)
        )
        const remaining = valid.filter((_, i) => failedIndexes.has(i))
        setRows(remaining.length > 0 ? remaining : [emptyRow()])
      } else {
        toast.error(`Errores: ${result.failed_rows} de ${result.total_rows}`, {
          description: result.error || 'Revisa el detalle abajo',
        })
      }
    } catch (e) {
      toast.error('Error inesperado', { description: e instanceof Error ? e.message : '' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" /> Lote · {rows.length}/10 filas
        </h2>
        <Button onClick={addRow} variant="outline" size="sm" className="gap-2" disabled={rows.length >= 10}>
          <Plus className="h-4 w-4" /> Agregar fila
        </Button>
      </div>

      <div className="space-y-3">
        {rows.map((r, idx) => {
          const result = results?.find(x => x.row_index === idx)
          const historySummary = getHistoricalPaymentsDraftSummary(r.historical_payments)
          return (
            <div
              key={r.id}
              className={`border rounded-lg p-3 space-y-2 ${
                result?.status === 'success' ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20' :
                result?.status === 'error' ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20' :
                'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Fila {idx + 1}</span>
                <div className="flex items-center gap-2">
                  {result?.status === 'success' && (
                    <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      Importada
                    </Badge>
                  )}
                  {result?.status === 'error' && (
                    <Badge variant="outline" className="gap-1 bg-rose-50 text-rose-700 border-rose-200" title={result.error}>
                      <XCircle className="h-3 w-3" />
                      Error
                    </Badge>
                  )}
                  <button
                    onClick={() => removeRow(r.id)}
                    className="p-1 text-muted-foreground hover:text-rose-500"
                    title="Quitar fila"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Cliente — datos básicos */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <CompactField placeholder="DNI*" value={r.dni} onChange={v => updateRow(r.id, 'dni', v)} />
                <CompactField placeholder="Nombre*" value={r.name} onChange={v => updateRow(r.id, 'name', v)} className="md:col-span-3" />
                <CompactField placeholder="Teléfono" value={r.phone} onChange={v => updateRow(r.id, 'phone', v)} />
                <CompactField placeholder="Cumpleaños" type="date" value={r.birthday} onChange={v => updateRow(r.id, 'birthday', v)} />
              </div>

              {/* Cliente — contacto y ubicación */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                <CompactField placeholder="Correo electrónico" type="email" value={r.email} onChange={v => updateRow(r.id, 'email', v)} className="md:col-span-2" />
                <CompactField placeholder="Dirección" value={r.address} onChange={v => updateRow(r.id, 'address', v)} className="md:col-span-3" />
                <CompactField placeholder="Distrito" value={r.district} onChange={v => updateRow(r.id, 'district', v)} />
              </div>

              <CompactField placeholder="¿Qué compró?* (descripción)" value={r.purchase_description} onChange={v => updateRow(r.id, 'purchase_description', v)} />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <CompactField placeholder="Fecha compra*" type="date" value={r.purchase_date} onChange={v => updateRow(r.id, 'purchase_date', v)} />
                <CompactField placeholder="Total S/*" type="number" value={r.original_total} onChange={v => updateRow(r.id, 'original_total', v)} />
                <CompactField placeholder="Pagado S/ (opcional)" type="number" value={r.paid_so_far} onChange={v => updateRow(r.id, 'paid_so_far', v)} />
                <CompactField placeholder="Vencimiento" type="date" value={r.due_date} onChange={v => updateRow(r.id, 'due_date', v)} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Historial de pagos detallado</Label>
                  <Textarea
                    value={r.historical_payments}
                    onChange={e => updateRow(r.id, 'historical_payments', e.target.value)}
                    placeholder={'300 | 30/12/2024 | EFECTIVO | Pago inicial\n270 | 30/11/2025 | YAPE | Abono con captura'}
                    rows={2}
                    className="mt-1 min-h-16 font-mono text-xs"
                  />
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>Un pago por linea: monto | fecha | metodo | nota.</span>
                    {historySummary.count > 0 && (
                      <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">
                        {historySummary.count} pago(s) · S/ {historySummary.total.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {!r.paid_so_far && historySummary.total > 0 && (
                    <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                      Se usara como pagado si dejas "Pagado S/" vacio.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Notas de la deuda / seguimiento</Label>
                  <Textarea
                    value={r.notes}
                    onChange={e => updateRow(r.id, 'notes', e.target.value)}
                    placeholder="Ej: buscarlo en su casa, prometio pagar el viernes, referencia del sistema anterior..."
                    rows={2}
                    className="mt-1 min-h-16 text-xs"
                  />
                </div>
              </div>

              {result?.status === 'error' && (
                <p className="text-xs text-rose-700 dark:text-rose-400 italic">{result.error}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end pt-2 border-t">
        <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {submitting ? 'Importando…' : `Importar ${rows.length} fila(s)`}
        </Button>
      </div>
    </Card>
  )
}

function CompactField({
  placeholder,
  value,
  onChange,
  type = 'text',
  className = '',
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  type?: string
  className?: string
}) {
  return (
    <Input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`h-8 text-xs ${className}`}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO — Excel/CSV con preview
// ─────────────────────────────────────────────────────────────────────────────
function FileMode() {
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([])
  const [validationResults, setValidationResults] = useState<LegacyImportRowResult[] | null>(null)
  const [importResult, setImportResult] = useState<LegacyImportBatchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const downloadTemplate = () => {
    try {
      const blob = generateLegacyImportTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla-importacion-deudas.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Plantilla descargada', { description: 'plantilla-importacion-deudas.xlsx' })
    } catch (e) {
      toast.error('Error al generar plantilla', { description: e instanceof Error ? e.message : '' })
    }
  }

  const handleFileChange = async (f: File | null) => {
    if (!f) return
    setFile(f)
    setValidationResults(null)
    setImportResult(null)
    setBusy(true)
    try {
      const ext = f.name.split('.').pop()?.toLowerCase()
      let rows: Record<string, any>[] = []

      if (ext === 'csv') {
        const text = await f.text()
        const parsed = Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true })
        rows = parsed.data
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buf = await f.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array', cellDates: true })
        // Buscar hoja "Plantilla" o usar la primera
        const sheetName = wb.SheetNames.find(n => /plantilla|datos|sheet1/i.test(n)) || wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: false })
      } else {
        throw new Error('Formato no soportado. Usa .xlsx, .xls o .csv')
      }

      // Limpiar filas vacías
      rows = rows.filter(r => Object.values(r).some(v => v != null && String(v).trim() !== ''))
      // Limpiar marcadores de obligatorio en headers (ej: "dni*" → "dni")
      rows = rows.map(r => {
        const out: Record<string, any> = {}
        for (const [k, v] of Object.entries(r)) {
          out[k.replace(/\*$/, '').trim()] = v
        }
        return out
      })

      setParsedRows(rows)
      toast.info(`${rows.length} fila(s) leída(s) del archivo`)
    } catch (e) {
      toast.error('Error al leer archivo', { description: e instanceof Error ? e.message : '' })
      setParsedRows([])
    } finally {
      setBusy(false)
    }
  }

  const validateNow = async () => {
    if (parsedRows.length === 0) {
      toast.warning('Sube un archivo primero')
      return
    }
    setBusy(true)
    try {
      const result = await validateLegacyDebtRows(parsedRows)
      setValidationResults(result.results)
      const errors = result.results.filter(r => r.status === 'error').length
      if (errors === 0) {
        toast.success(`Validación OK · ${result.results.length} fila(s) listas para importar`)
      } else {
        toast.warning(`${errors} fila(s) con errores`, { description: 'Revisa el detalle y corrige el archivo' })
      }
    } catch (e) {
      toast.error('Error al validar', { description: e instanceof Error ? e.message : '' })
    } finally {
      setBusy(false)
    }
  }

  const importNow = async () => {
    if (!validationResults) {
      toast.warning('Valida el archivo primero')
      return
    }
    const validCount = validationResults.filter(r => r.status === 'success').length
    if (validCount === 0) {
      toast.error('No hay filas válidas para importar')
      return
    }
    if (!confirm(`¿Confirmar importación de ${validCount} deuda(s)?\nEsta acción crea registros reales en el sistema y queda auditada.`)) {
      return
    }
    setBusy(true)
    try {
      const result = await importLegacyDebts(parsedRows, {
        sourceLabel: `Archivo: ${file?.name ?? 'sin nombre'}`,
        sourceFilename: file?.name,
      })
      setImportResult(result)
      if (result.successful_rows > 0) {
        toast.success(`${result.successful_rows} deuda(s) importada(s)`, {
          description: `S/ ${result.total_debt_amount.toFixed(2)} en saldo · Lote: ${result.batch_id?.slice(0, 8)}`,
        })
      }
      if (result.failed_rows > 0) {
        toast.error(`${result.failed_rows} fila(s) fallaron`, {
          description: 'Revisa el detalle por fila',
        })
      }
    } catch (e) {
      toast.error('Error al importar', { description: e instanceof Error ? e.message : '' })
    } finally {
      setBusy(false)
    }
  }

  const successCount = validationResults?.filter(r => r.status === 'success').length ?? 0
  const errorCount = validationResults?.filter(r => r.status === 'error').length ?? 0

  return (
    <div className="space-y-4">
      {/* Template download */}
      <Card className="p-5 bg-gradient-to-r from-emerald-50/60 to-transparent dark:from-emerald-950/20 border-emerald-200">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Plantilla de importación
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Descarga la plantilla Excel con las columnas correctas, instrucciones y ejemplos.
              Llénala y súbela aquí mismo. Acepta <code>.xlsx</code>, <code>.xls</code> y <code>.csv</code>.
            </p>
          </div>
          <Button onClick={downloadTemplate} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Download className="h-4 w-4" />
            Descargar plantilla
          </Button>
        </div>
      </Card>

      {/* Upload */}
      <Card className="p-5">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Upload className="h-4 w-4" /> Subir archivo
        </h2>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border hover:border-primary/40 rounded-lg p-8 text-center cursor-pointer transition-colors bg-muted/20"
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">
            {file ? file.name : 'Click para seleccionar un archivo'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {file ? `${parsedRows.length} fila(s) detectadas` : 'Excel (.xlsx) o CSV'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => handleFileChange(e.target.files?.[0] || null)}
          />
        </div>

        {parsedRows.length > 0 && (
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={validateNow} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Validar ({parsedRows.length})
            </Button>
            <Button
              onClick={importNow}
              disabled={busy || !validationResults || successCount === 0}
              className="gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Importar {successCount > 0 ? `${successCount} fila(s)` : ''}
            </Button>
          </div>
        )}
      </Card>

      {/* Validation summary */}
      {validationResults && (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              {errorCount === 0
                ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Validación exitosa</>
                : <><AlertTriangle className="h-4 w-4 text-amber-600" /> Validación con errores</>
              }
            </h2>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {successCount} OK
              </Badge>
              {errorCount > 0 && (
                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                  {errorCount} con error
                </Badge>
              )}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b sticky top-0">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Estado</th>
                  <th className="text-left p-2">DNI</th>
                  <th className="text-left p-2">Nombre</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-right p-2">Pagado</th>
                  <th className="text-right p-2">Saldo</th>
                  <th className="text-left p-2">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {validationResults.map((r, i) => {
                  const raw = parsedRows[r.row_index] || {}
                  const importStatus = importResult?.results[i]
                  return (
                    <tr key={i} className={`border-b ${
                      r.status === 'error' ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''
                    }`}>
                      <td className="p-2 text-muted-foreground">{r.row_index + 1}</td>
                      <td className="p-2">
                        {importStatus?.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> Importada
                          </span>
                        ) : importStatus?.status === 'error' ? (
                          <span className="inline-flex items-center gap-1 text-rose-600">
                            <XCircle className="h-3 w-3" /> Falló
                          </span>
                        ) : r.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> Lista
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600">
                            <XCircle className="h-3 w-3" /> Error
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono">{raw.dni || raw.DNI || '-'}</td>
                      <td className="p-2">{raw.nombre || raw.name || '-'}</td>
                      <td className="p-2 text-right tabular-nums">
                        {r.input ? `S/ ${r.input.original_total.toFixed(2)}` : '-'}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {r.input?.paid_so_far ? `S/ ${r.input.paid_so_far.toFixed(2)}` : '-'}
                      </td>
                      <td className="p-2 text-right tabular-nums font-semibold">
                        {r.remaining_debt != null ? `S/ ${r.remaining_debt.toFixed(2)}` : '-'}
                      </td>
                      <td className="p-2 text-rose-600 italic">{importStatus?.error || r.error || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORIAL — lotes de importación previos
// ─────────────────────────────────────────────────────────────────────────────
function HistoryMode() {
  const [batches, setBatches] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await listLegacyImportBatches()
      if (result.success) setBatches(result.data || [])
      else toast.error(result.error || 'Error al cargar historial')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <History className="h-4 w-4" /> Historial de importaciones
        </h2>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cargar historial'}
        </Button>
      </div>

      {batches === null && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Click en "Cargar historial" para ver los lotes importados previamente.
        </p>
      )}

      {batches && batches.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay importaciones registradas todavía.
        </p>
      )}

      {batches && batches.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left p-2.5">Fecha</th>
                <th className="text-left p-2.5">Origen</th>
                <th className="text-left p-2.5">Importado por</th>
                <th className="text-right p-2.5">OK</th>
                <th className="text-right p-2.5">Errores</th>
                <th className="text-right p-2.5">Saldo total</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b: any) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="p-2.5">{new Date(b.imported_at).toLocaleString('es-PE')}</td>
                  <td className="p-2.5">
                    <p className="font-medium">{b.source_label}</p>
                    {b.source_filename && <p className="text-xs text-muted-foreground">{b.source_filename}</p>}
                  </td>
                  <td className="p-2.5 text-xs">{b.users?.name || b.users?.email || b.imported_by}</td>
                  <td className="p-2.5 text-right tabular-nums text-emerald-600 font-semibold">{b.successful_rows}</td>
                  <td className="p-2.5 text-right tabular-nums text-rose-600">{b.failed_rows || 0}</td>
                  <td className="p-2.5 text-right tabular-nums font-semibold">
                    S/ {Number(b.total_debt_amount || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
