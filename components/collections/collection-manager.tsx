'use client'

/**
 * Collection Manager
 * Redesigned actions page:
 * - Left: Priority table (top debtors by score)
 * - Right: Client detail panel + action form + timeline history
 */

import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/contexts/store-context'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import {
  AlertTriangle, Phone, MessageCircle, Eye, ChevronRight,
  Loader2, RefreshCw, Clock, CheckCircle2, XCircle, HelpCircle,
  DollarSign, Users, Calendar, MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatSafeDate } from '@/lib/utils/date'

// ─── Types ─────────────────────────────────────────────────────────────────
interface DebtorRow {
  id: string; name: string; dni: string; phone: string; rating: string
  totalDebt: number; overdueDebt: number; maxDaysOverdue: number
  overdueCount: number; score: number
}

interface ClientInstallment {
  id: string; installment_number: number; amount: number; due_date: string
  paid_amount: number; status: string; days_overdue: number; is_overdue: boolean
}

interface ActionRecord {
  id: string; action_type: string; result: string; notes: string
  payment_promise_date: string | null; created_at: string
  user?: { name: string }
}

interface ClientDetail {
  id: string; name: string; dni: string; phone: string; address: string
  rating: string; totalDebt: number; overdueDebt: number; pendingCount: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getRisk(score: number) {
  if (score >= 3000) return { label: 'Crítico', cls: 'bg-red-100 text-red-700 border-red-200' }
  if (score >= 800) return { label: 'Alto', cls: 'bg-orange-100 text-orange-700 border-orange-200' }
  if (score >= 200) return { label: 'Medio', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
  return { label: 'Bajo', cls: 'bg-green-100 text-green-700 border-green-200' }
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}
const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6']
function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

const ACTION_LABELS: Record<string, string> = {
  LLAMADA: '📞 Llamada', WHATSAPP: '💬 WhatsApp', MENSAJE_REDES: '📲 Redes',
  EMAIL: '📧 Email', MOTORIZADO: '🏍️ Motorizado', CARTA_NOTARIAL: '📄 Carta Notarial', OTRO: '📋 Otro'
}
const RESULT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  PAGO_REALIZADO:         { label: 'Pagó', icon: CheckCircle2, color: 'text-green-600' },
  PROMETE_PAGAR_FECHA:    { label: 'Promete pagar', icon: Calendar, color: 'text-blue-600' },
  CLIENTE_COLABORADOR:    { label: 'Colabora', icon: CheckCircle2, color: 'text-teal-600' },
  NO_CONTESTA:            { label: 'No contesta', icon: HelpCircle, color: 'text-gray-500' },
  SE_NIEGA_PAGAR:         { label: 'Se niega', icon: XCircle, color: 'text-red-600' },
  CLIENTE_MOLESTO:        { label: 'Molesto', icon: AlertTriangle, color: 'text-orange-600' },
  SOLICITA_REFINANCIAMIENTO: { label: 'Refinanciamiento', icon: RefreshCw, color: 'text-purple-600' },
  SOLICITA_DESCUENTO:     { label: 'Pide descuento', icon: DollarSign, color: 'text-yellow-600' },
  TELEFONO_INVALIDO:      { label: 'Tel. inválido', icon: XCircle, color: 'text-gray-400' },
  DOMICILIO_INCORRECTO:   { label: 'Dom. incorrecto', icon: MapPin, color: 'text-gray-400' },
  CLIENTE_NO_UBICADO:     { label: 'No ubicado', icon: HelpCircle, color: 'text-gray-400' },
  OTRO:                   { label: 'Otro', icon: HelpCircle, color: 'text-gray-500' },
}

// ─── Timeline item ──────────────────────────────────────────────────────────
function TimelineItem({ action }: { action: ActionRecord }) {
  const res = RESULT_LABELS[action.result] || { label: action.result, icon: HelpCircle, color: 'text-gray-500' }
  const Icon = res.icon
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn('w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0', res.color)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="w-px flex-1 bg-gray-100 mt-1" />
      </div>
      <div className="pb-4 min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-700">{ACTION_LABELS[action.action_type] || action.action_type}</span>
          <span className="text-xs text-gray-400">{formatSafeDate(action.created_at, 'dd/MM/yy HH:mm')}</span>
        </div>
        <div className={cn('text-xs font-medium mt-0.5', res.color)}>{res.label}</div>
        {action.payment_promise_date && (
          <div className="text-xs text-blue-600 mt-0.5">
            📅 Promete: {formatSafeDate(action.payment_promise_date, 'dd/MM/yyyy')}
          </div>
        )}
        {action.notes && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{action.notes}</p>
        )}
        {action.user?.name && (
          <p className="text-xs text-gray-400 mt-0.5">por {action.user.name}</p>
        )}
      </div>
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────
export function CollectionManager() {
  const { storeId, selectedStore } = useStore()
  const router = useRouter()

  // Priority table
  const [debtors, setDebtors] = useState<DebtorRow[]>([])
  const [loadingDebtors, setLoadingDebtors] = useState(true)

  // Selected client detail
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null)
  const [clientInstallments, setClientInstallments] = useState<ClientInstallment[]>([])
  const [clientActions, setClientActions] = useState<ActionRecord[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Action form
  const [formActionType, setFormActionType] = useState('')
  const [formResult, setFormResult] = useState('')
  const [formPromiseDate, setFormPromiseDate] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

  // Load debtors
  const loadDebtors = useCallback(async () => {
    setLoadingDebtors(true)
    try {
      const params = selectedStore !== 'ALL' ? `?store_code=${selectedStore}` : ''
      const res = await fetch(`/api/collections/priority${params}`)
      const data = await res.json()
      setDebtors(data.data || [])
    } catch { toast.error('Error al cargar la lista') }
    finally { setLoadingDebtors(false) }
  }, [storeId, selectedStore])

  useEffect(() => { loadDebtors() }, [loadDebtors])

  // Load client detail
  const loadClientDetail = useCallback(async (clientId: string) => {
    setLoadingDetail(true)
    setSelectedId(clientId)
    setClientDetail(null)
    setClientInstallments([])
    setClientActions([])
    try {
      const res = await fetch(`/api/collections/client-detail?client_id=${clientId}`)
      const data = await res.json()
      setClientDetail(data.client)
      setClientInstallments(data.installments || [])
      setClientActions(data.actions || [])
    } catch { toast.error('Error al cargar el cliente') }
    finally { setLoadingDetail(false) }
  }, [])

  // Submit action
  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId || !clientDetail || !formActionType || !formResult) {
      toast.error('Completa todos los campos')
      return
    }
    if (formResult === 'PROMETE_PAGAR_FECHA' && !formPromiseDate) {
      toast.error('Ingresa la fecha de promesa de pago')
      return
    }
    setSubmittingAction(true)
    try {
      const fd = new FormData()
      fd.append('client_id', selectedId)
      fd.append('client_name', clientDetail.name)
      fd.append('action_type', formActionType)
      fd.append('result', formResult)
      if (formPromiseDate) fd.append('payment_promise_date', new Date(formPromiseDate).toISOString())
      if (formNotes) fd.append('notes', formNotes)

      const res = await fetch('/api/collections/actions', { method: 'POST', body: fd })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Error')

      toast.success('Acción registrada')
      setFormActionType('')
      setFormResult('')
      setFormPromiseDate('')
      setFormNotes('')
      // Refresh timeline
      await loadClientDetail(selectedId)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmittingAction(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* ── LEFT: Priority table (3/5) ──────────────────────────────────── */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Prioridad de Cobranza</h2>
              <p className="text-xs text-gray-500 mt-0.5">Ordenado por score de riesgo</p>
            </div>
            <button onClick={loadDebtors} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-100 transition-colors">
              <RefreshCw className={cn('h-4 w-4', loadingDebtors && 'animate-spin')} />
            </button>
          </div>

          {loadingDebtors ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
          ) : debtors.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-gray-200" />
              Sin deudas pendientes 🎉
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {debtors.map((d, i) => {
                const risk = getRisk(d.score)
                const isSelected = selectedId === d.id
                return (
                  <div
                    key={d.id}
                    onClick={() => loadClientDetail(d.id)}
                    className={cn(
                      'px-5 py-3.5 flex items-center gap-3 cursor-pointer transition-colors hover:bg-gray-50',
                      isSelected && 'bg-blue-50 hover:bg-blue-50'
                    )}
                  >
                    {/* Rank */}
                    <div className="w-6 text-center text-xs text-gray-400 flex-shrink-0">{i + 1}</div>

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: avatarColor(d.name) }}>
                      {getInitials(d.name)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{d.name}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">{d.dni}</span>
                        {d.maxDaysOverdue > 0 && (
                          <span className="text-xs text-red-500 font-medium">{d.maxDaysOverdue}d atraso</span>
                        )}
                      </div>
                    </div>

                    {/* Debt */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-gray-900">{formatCurrency(d.totalDebt)}</div>
                      {d.overdueDebt > 0 && (
                        <div className="text-xs text-red-500">{formatCurrency(d.overdueDebt)} venc.</div>
                      )}
                    </div>

                    {/* Risk badge */}
                    <span className={cn('hidden md:inline-flex px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0', risk.cls)}>
                      {risk.label}
                    </span>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {d.phone && (
                        <a href={`tel:${d.phone}`}
                          className="p-1.5 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Llamar">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {d.phone && (
                        <a href={`https://wa.me/51${d.phone.replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors"
                          title="WhatsApp">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    {isSelected && <ChevronRight className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Detail + Form + Timeline (2/5) ───────────────────────── */}
      <div className="lg:col-span-2 space-y-4">
        {!selectedId && !loadingDetail ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-500">Selecciona un cliente de la lista para ver su detalle y registrar una acción</p>
          </div>
        ) : loadingDetail ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        ) : clientDetail && (
          <>
            {/* Client info card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: avatarColor(clientDetail.name) }}>
                  {getInitials(clientDetail.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{clientDetail.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{clientDetail.dni} {clientDetail.phone ? `· ${clientDetail.phone}` : ''}</div>
                  {clientDetail.address && <div className="text-xs text-gray-400 mt-0.5 truncate">{clientDetail.address}</div>}
                </div>
                <button
                  onClick={() => router.push(`/clients/${clientDetail.id}`)}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                  title="Ver perfil completo"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50">
                <div className="text-center">
                  <div className="text-sm font-bold text-gray-900">{formatCurrency(clientDetail.totalDebt)}</div>
                  <div className="text-xs text-gray-400">Deuda total</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-red-600">{formatCurrency(clientDetail.overdueDebt)}</div>
                  <div className="text-xs text-gray-400">Vencida</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-gray-900">{clientDetail.pendingCount}</div>
                  <div className="text-xs text-gray-400">Cuotas</div>
                </div>
              </div>

              {/* Installments mini-list */}
              {clientInstallments.length > 0 && (
                <div className="mt-3 space-y-1.5 max-h-28 overflow-y-auto">
                  {clientInstallments.slice(0, 4).map(inst => (
                    <div key={inst.id} className="flex items-center justify-between text-xs gap-2 py-1">
                      <span className="text-gray-500">#{inst.installment_number} · {formatSafeDate(inst.due_date, 'dd/MM/yy')}</span>
                      <span className={cn('font-medium',
                        inst.is_overdue ? 'text-red-600' :
                        inst.status === 'PARTIAL' ? 'text-yellow-600' : 'text-gray-600'
                      )}>
                        {formatCurrency(Number(inst.amount) - Number(inst.paid_amount || 0))}
                        {inst.is_overdue && inst.days_overdue > 0 && <span className="text-red-400 ml-1">({inst.days_overdue}d)</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                {clientDetail.phone && (
                  <a href={`tel:${clientDetail.phone}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-colors">
                    <Phone className="h-3.5 w-3.5" /> Llamar
                  </a>
                )}
                {clientDetail.phone && (
                  <a href={`https://wa.me/51${clientDetail.phone.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium transition-colors">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
                <button
                  onClick={() => router.push(`/collections/payments`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-medium transition-colors">
                  <DollarSign className="h-3.5 w-3.5" /> Registrar Pago
                </button>
              </div>
            </div>

            {/* Action form */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Registrar Acción</h3>
              <form onSubmit={handleSubmitAction} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Tipo *</label>
                    <Select value={formActionType} onValueChange={setFormActionType}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LLAMADA">📞 Llamada</SelectItem>
                        <SelectItem value="WHATSAPP">💬 WhatsApp</SelectItem>
                        <SelectItem value="MENSAJE_REDES">📲 Redes</SelectItem>
                        <SelectItem value="EMAIL">📧 Email</SelectItem>
                        <SelectItem value="MOTORIZADO">🏍️ Motorizado</SelectItem>
                        <SelectItem value="CARTA_NOTARIAL">📄 Carta Notarial</SelectItem>
                        <SelectItem value="OTRO">📋 Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Resultado *</label>
                    <Select value={formResult} onValueChange={setFormResult}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PAGO_REALIZADO">💰 Pagó</SelectItem>
                        <SelectItem value="PROMETE_PAGAR_FECHA">📅 Promete pagar</SelectItem>
                        <SelectItem value="CLIENTE_COLABORADOR">😊 Colabora</SelectItem>
                        <SelectItem value="SOLICITA_REFINANCIAMIENTO">🔄 Refinanciamiento</SelectItem>
                        <SelectItem value="SOLICITA_DESCUENTO">💲 Pide descuento</SelectItem>
                        <SelectItem value="SE_NIEGA_PAGAR">❌ Se niega</SelectItem>
                        <SelectItem value="NO_CONTESTA">📵 No contesta</SelectItem>
                        <SelectItem value="TELEFONO_INVALIDO">☎️ Tel. inválido</SelectItem>
                        <SelectItem value="CLIENTE_MOLESTO">😠 Molesto</SelectItem>
                        <SelectItem value="DOMICILIO_INCORRECTO">🏚️ Dom. incorrecto</SelectItem>
                        <SelectItem value="CLIENTE_NO_UBICADO">🔍 No ubicado</SelectItem>
                        <SelectItem value="OTRO">📝 Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formResult === 'PROMETE_PAGAR_FECHA' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Fecha de promesa *</label>
                    <input
                      type="date"
                      value={formPromiseDate}
                      onChange={e => setFormPromiseDate(e.target.value)}
                      className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Notas</label>
                  <Textarea
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Detalles de la gestión..."
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>

                <Button type="submit" disabled={submittingAction || !formActionType || !formResult} size="sm" className="w-full">
                  {submittingAction ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Guardando...</> : 'Registrar Acción'}
                </Button>
              </form>
            </div>

            {/* Timeline */}
            {clientActions.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Historial</h3>
                <div>
                  {clientActions.map(action => (
                    <TimelineItem key={action.id} action={action} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
