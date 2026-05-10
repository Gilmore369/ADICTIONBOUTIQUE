'use client'

/**
 * Smart Payment Panel
 * Full redesign of the payment registration:
 * - Client autocomplete + debt preview
 * - Pending installments list with status badges
 * - Live payment simulation (calls existing /api/collections/payment-preview)
 * - Payment method selector
 * - Receipt file upload
 * - Auto-register action checkbox
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { processPayment } from '@/actions/payments'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { PERU_TZ } from '@/lib/utils/timezone'
import { useStore } from '@/contexts/store-context'
import {
  Search, Loader2, AlertTriangle, CheckCircle2, Clock,
  Upload, X, ChevronDown, DollarSign, CreditCard, Smartphone,
  ArrowRight, Users, RefreshCw, Store,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

const STORE_TEXT: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface ClientOption { id: string; name: string; dni?: string; phone?: string; credit_used: number; credit_limit: number }
interface Installment { id: string; installment_number: number; amount: number; due_date: string; paid_amount: number; status: string; days_overdue?: number; is_overdue?: boolean; amount_to_apply?: number; store_id?: string }
interface ClientDetail { id: string; name: string; dni: string; phone: string; rating: string; totalDebt: number; overdueDebt: number; pendingCount: number }

// ─── Helpers ───────────────────────────────────────────────────────────────
const RATING_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-yellow-100 text-yellow-700',
  D: 'bg-orange-100 text-orange-700',
  E: 'bg-red-100 text-red-700',
}

function StatusBadge({ status, days, isOverdue }: { status: string; days?: number; isOverdue?: boolean }) {
  // Vencida: por fecha real (is_overdue) O por status en BD
  if (isOverdue || status === 'OVERDUE') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
      <AlertTriangle className="h-3 w-3" />
      Vencida {days ? `${days}d` : ''}
    </span>
  )
  if (status === 'PARTIAL') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
      <Clock className="h-3 w-3" />
      Parcial
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
      <Clock className="h-3 w-3" />
      Pendiente
    </span>
  )
}

const PAYMENT_METHODS = [
  { value: 'EFECTIVO', label: 'Efectivo', icon: DollarSign },
  { value: 'YAPE', label: 'Yape', icon: Smartphone },
  { value: 'PLIN', label: 'Plin', icon: Smartphone },
  { value: 'TRANSFERENCIA', label: 'Transferencia', icon: CreditCard },
]

// ─── Main Component ─────────────────────────────────────────────────────────
export function SmartPaymentPanel() {
  const { selectedStore } = useStore()

  // Client search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ClientOption[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null)
  const [clientLoading, setClientLoading] = useState(false)
  const [installments, setInstallments] = useState<Installment[]>([])

  // Payment
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO')
  const [notes, setNotes] = useState('')
  const [autoAction, setAutoAction] = useState(true)

  // Receipt upload
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Simulation
  const [simulation, setSimulation] = useState<{ installments: Installment[]; remaining: number } | null>(null)
  const [simLoading, setSimLoading] = useState(false)

  // Submit
  const [submitting, setSubmitting] = useState(false)

  // ── Store filtering ──────────────────────────────────────────────────────
  // Filter installments to only those matching the selected store
  const activeStoreText = selectedStore !== 'ALL' ? STORE_TEXT[selectedStore] : null
  const visibleInstallments = activeStoreText
    ? installments.filter(i => !i.store_id || i.store_id === activeStoreText)
    : installments
  const hasOtherStoreInstallments = activeStoreText
    ? installments.some(i => i.store_id && i.store_id !== activeStoreText)
    : false
  const canRegisterPayment = !activeStoreText || visibleInstallments.length > 0

  // ── Client search with debounce ──────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/clients/search?q=${encodeURIComponent(searchQuery)}&limit=8`)
        const json = await res.json()
        setSearchResults(json.data || [])
        setShowDropdown(true)
      } catch { setSearchResults([]) }
      finally { setSearchLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const selectClient = async (client: ClientOption) => {
    setShowDropdown(false)
    setSearchQuery(client.name)
    setClientLoading(true)
    try {
      const res = await fetch(`/api/collections/client-detail?client_id=${client.id}`)
      const data = await res.json()
      setSelectedClient(data.client)
      setInstallments(data.installments || [])
    } catch { toast.error('No se pudo cargar el detalle del cliente') }
    finally { setClientLoading(false) }
  }

  const clearClient = () => {
    setSelectedClient(null)
    setInstallments([])
    setSearchQuery('')
    setSimulation(null)
    setAmount('')
  }

  // ── Live simulation ─────────────────────────────────────────────────────
  useEffect(() => {
    const amt = parseFloat(amount)
    if (!selectedClient || !amt || amt <= 0) { setSimulation(null); return }
    const t = setTimeout(async () => {
      setSimLoading(true)
      try {
        const storeParam = activeStoreText ? `&store_id=${encodeURIComponent(activeStoreText)}` : ''
        const res = await fetch(`/api/collections/payment-preview?client_id=${selectedClient.id}&amount=${amt}${storeParam}`)
        const { data } = await res.json()
        if (data) setSimulation({ installments: data.installments || [], remaining: data.remaining_amount || 0 })
      } catch { setSimulation(null) }
      finally { setSimLoading(false) }
    }, 500)
    return () => clearTimeout(t)
  }, [amount, selectedClient])

  // ── Receipt upload ──────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setReceiptPreview(url)
    } else {
      setReceiptPreview('pdf')
    }
  }

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receiptFile) return null
    setUploadingReceipt(true)
    try {
      const fd = new FormData()
      fd.append('file', receiptFile)
      const res = await fetch('/api/upload/receipt', { method: 'POST', body: fd })
      const data = await res.json()
      return data.data?.public_url || null
    } catch { return null }
    finally { setUploadingReceipt(false) }
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClient) { toast.error('Selecciona un cliente'); return }
    if (!canRegisterPayment) {
      toast.error('No puedes registrar pagos de otra tienda desde la tienda seleccionada')
      return
    }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Ingresa un monto válido'); return }

    setSubmitting(true)
    try {
      let receiptUrl: string | null = null
      if (receiptFile) receiptUrl = await uploadReceipt()

      const formData = new FormData()
      formData.append('client_id', selectedClient.id)
      formData.append('amount', String(amt))
      formData.append('payment_date', new Date(paymentDate).toISOString())
      if (activeStoreText) formData.append('store_id', activeStoreText)
      // Idempotency: dedupes double-click / network retry on the server side.
      formData.append('idempotency_key', crypto.randomUUID())
      formData.append('payment_method', paymentMethod)
      if (receiptUrl) formData.append('receipt_url', receiptUrl)
      const notesText = [
        `[${paymentMethod}]`,
        notes.trim() || null
      ].filter(Boolean).join(' | ')
      formData.append('notes', notesText)

      const result = await processPayment(formData)
      if (!result.success) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Error al procesar el pago')
      }

      // Auto-register action if checked
      if (autoAction) {
        await fetch('/api/collections/actions', {
          method: 'POST',
          body: (() => {
            const fd = new FormData()
            fd.append('client_id', selectedClient.id)
            fd.append('client_name', selectedClient.name)
            fd.append('action_type', 'LLAMADA')
            fd.append('result', 'PAGO_REALIZADO')
            fd.append('notes', `Pago de S/${amt.toFixed(2)} registrado vía ${paymentMethod}`)
            return fd
          })()
        }).catch(() => {})
      }

      toast.success(`Pago registrado — S/${result.data?.amount_applied?.toFixed(2) ?? amt.toFixed(2)} aplicado a ${result.data?.installments_updated ?? '?'} cuota(s)`)
      clearClient()
      setAmount('')
      setNotes('')
      setReceiptFile(null)
      setReceiptPreview(null)
      setSimulation(null)
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar el pago')
    } finally {
      setSubmitting(false)
    }
  }

  const amountNum = parseFloat(amount) || 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* ── LEFT: Form (3/5) ─────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-5">
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">Registrar Pago</h2>

          {/* Client search */}
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium text-foreground/85">Cliente *</label>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) clearClient() }}
                  placeholder="Buscar por nombre, DNI o teléfono..."
                  className="w-full pl-9 pr-8 h-10 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
                {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground/70" />}
                {selectedClient && !searchLoading && (
                  <button type="button" onClick={clearClient} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {/* Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-card rounded-lg border border-border shadow-lg max-h-56 overflow-y-auto">
                  {searchResults.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">{c.name}</div>
                        <div className="text-xs text-muted-foreground/70">{c.dni} {c.phone ? `· ${c.phone}` : ''}</div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Client preview */}
          {clientLoading && (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando datos del cliente...
            </div>
          )}
          {selectedClient && !clientLoading && (
            <div className="bg-muted/30 rounded-lg p-3.5 mb-4 flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate">{selectedClient.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{selectedClient.dni} {selectedClient.phone ? `· ${selectedClient.phone}` : ''}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                <div className="text-center">
                  <div className="text-sm font-bold text-foreground">{formatCurrency(selectedClient.totalDebt)}</div>
                  <div className="text-xs text-muted-foreground/70">Deuda total</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-red-600">{formatCurrency(selectedClient.overdueDebt)}</div>
                  <div className="text-xs text-muted-foreground/70">Vencida</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-foreground">{selectedClient.pendingCount}</div>
                  <div className="text-xs text-muted-foreground/70">Cuotas</div>
                </div>
                {selectedClient.rating && (
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', RATING_COLORS[selectedClient.rating] || 'bg-muted text-muted-foreground')}>
                    {selectedClient.rating}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Store mismatch warning */}
          {hasOtherStoreInstallments && !canRegisterPayment && (
            <div className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg text-sm text-amber-800">
              <Store className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
              <span>Este cliente tiene deuda de <strong>{activeStoreText}</strong> pero sus cuotas corresponden a la otra tienda. No puedes registrar pagos desde la tienda seleccionada.</span>
            </div>
          )}
          {hasOtherStoreInstallments && canRegisterPayment && (
            <div className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-lg text-sm text-blue-800">
              <Store className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
              <span>Solo se muestran cuotas de <strong>{activeStoreText}</strong>. Algunas cuotas de otra tienda están ocultas.</span>
            </div>
          )}

          {/* Pending installments mini list */}
          {visibleInstallments.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Cuotas pendientes</div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {visibleInstallments.map(inst => {
                  const pending = Number(inst.amount) - Number(inst.paid_amount || 0)
                  return (
                    <div key={inst.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-card rounded-lg border border-border text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-gray-500 text-xs">#{inst.installment_number}</span>
                        <span className="text-muted-foreground text-xs truncate">
                          {new Date(inst.due_date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', timeZone: PERU_TZ })}
                        </span>
                        <StatusBadge status={inst.status} days={inst.days_overdue} isOverdue={inst.is_overdue} />
                      </div>
                      <span className="font-semibold text-foreground flex-shrink-0">{formatCurrency(pending)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Amount + date */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/85">Monto a pagar *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70 font-medium">S/</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="pl-8"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/85">Fecha de pago *</label>
              <Input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Payment method */}
          <div className="mb-4 space-y-1.5">
            <label className="text-sm font-medium text-foreground/85">Método de pago</label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentMethod(value)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-all',
                    paymentMethod === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700'
                      : 'border-border text-muted-foreground hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Receipt upload */}
          <div className="mb-4 space-y-1.5">
            <label className="text-sm font-medium text-foreground/85">Comprobante (opcional)</label>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="hidden" />
            {receiptPreview ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                {receiptPreview === 'pdf' ? (
                  <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center text-red-600 text-xs font-bold flex-shrink-0">PDF</div>
                ) : (
                  <img src={receiptPreview} alt="preview" className="w-10 h-10 object-cover rounded flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground/85 truncate">{receiptFile?.name}</div>
                  <div className="text-xs text-muted-foreground/70">{receiptFile ? (receiptFile.size / 1024).toFixed(0) + ' KB' : ''}</div>
                </div>
                <button type="button" onClick={() => { setReceiptFile(null); setReceiptPreview(null) }} className="text-muted-foreground/70 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 h-10 border border-dashed border-input rounded-lg text-sm text-muted-foreground hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Adjuntar foto o PDF
              </button>
            )}
          </div>

          {/* Notes */}
          <div className="mb-4 space-y-1.5">
            <label className="text-sm font-medium text-foreground/85">Notas (opcional)</label>
            <Textarea
              placeholder="Comentarios adicionales sobre el pago..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Auto action */}
          <label className="flex items-center gap-2.5 cursor-pointer mb-4 select-none">
            <input
              type="checkbox"
              checked={autoAction}
              onChange={e => setAutoAction(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm text-foreground/85">Registrar automáticamente acción "Pago recibido"</span>
          </label>

          <Button
            type="submit"
            disabled={submitting || !selectedClient || !amount || !canRegisterPayment}
            className="w-full h-10"
            title={!canRegisterPayment ? 'No puedes registrar pagos de otra tienda' : undefined}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-2" />Registrar Pago</>
            )}
          </Button>
        </div>
      </form>

      {/* ── RIGHT: Simulation (2/5) ──────────────────────────────────────── */}
      <div className="lg:col-span-2">
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 sticky top-20">
          <h3 className="text-sm font-semibold text-foreground mb-3">Simulación de pago</h3>
          {!selectedClient ? (
            <div className="py-8 text-center text-sm text-muted-foreground/70">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              Selecciona un cliente para ver cómo se aplicará el pago
            </div>
          ) : !amountNum ? (
            <div className="py-8 text-center text-sm text-muted-foreground/70">
              Ingresa un monto para ver la distribución
            </div>
          ) : simLoading ? (
            <div className="py-8 flex items-center justify-center text-sm text-muted-foreground/70 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculando...
            </div>
          ) : simulation ? (
            <div className="space-y-3">
              {simulation.installments.map(inst => (
                <div key={inst.id} className={cn(
                  'p-3 rounded-lg border text-sm',
                  (inst.amount_to_apply || 0) >= (inst.amount - inst.paid_amount)
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground/85">Cuota #{inst.installment_number}</span>
                    <span className={cn('text-sm font-bold',
                      (inst.amount_to_apply || 0) >= (inst.amount - inst.paid_amount)
                        ? 'text-green-700' : 'text-yellow-700'
                    )}>
                      + {formatCurrency(inst.amount_to_apply || 0)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Vence: {new Date(inst.due_date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit', timeZone: PERU_TZ })}</span>
                    <span>Pendiente: {formatCurrency(inst.amount - inst.paid_amount)}</span>
                  </div>
                </div>
              ))}

              <div className="border-t border-border pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monto a pagar</span>
                  <span className="font-semibold">{formatCurrency(amountNum)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cuotas afectadas</span>
                  <span className="font-semibold">{simulation.installments.length}</span>
                </div>
                {simulation.remaining > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Saldo restante</span>
                    <span className="font-semibold">{formatCurrency(simulation.remaining)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground/70">
              Sin cuotas pendientes para este cliente
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
