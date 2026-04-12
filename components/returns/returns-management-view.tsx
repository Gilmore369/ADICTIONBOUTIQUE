'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  RotateCcw, Search, CheckCircle, XCircle, Clock,
  Package, TrendingDown, ArrowLeftRight, Eye,
  ThumbsUp, ThumbsDown, Filter,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatSafeDate } from '@/lib/utils/date'
import { CreateReturnDialog } from './create-return-dialog'
import { ReturnDetailsDialog } from './return-details-dialog'
import { toast } from 'sonner'
import { approveReturnAction, rejectReturnAction } from '@/actions/returns'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ReturnRecord {
  id: string
  return_number: string
  sale_number: string
  sale_id?: string
  return_date: string
  created_at: string
  client_name: string
  reason_type: string
  reason: string
  return_type: string
  total_amount: number
  status: string
  notes?: string
  returned_items?: ReturnedItem[]
  clients: { id: string; name: string; dni: string | null } | null
  sales?: { sale_type: string } | null
}

export interface ReturnedItem {
  sale_item_id?: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  product_name?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDIENTE:  { label: 'Pendiente',  color: 'bg-amber-100 text-amber-700 border-amber-200',   icon: <Clock className="h-3 w-3" /> },
  APROBADA:   { label: 'Aprobada',   color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: <CheckCircle className="h-3 w-3" /> },
  RECHAZADA:  { label: 'Rechazada',  color: 'bg-red-100 text-red-700 border-red-200',          icon: <XCircle className="h-3 w-3" /> },
  COMPLETADA: { label: 'Completada', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle className="h-3 w-3" /> },
}

const REASON_LABELS: Record<string, string> = {
  DEFECTO_PRODUCTO: 'Producto defectuoso',
  TALLA_INCORRECTA: 'Talla incorrecta',
  COLOR_DIFERENTE:  'Color diferente',
  NO_SATISFECHO:    'No satisfecho',
  CAMBIO_OPINION:   'Cambió de opinión',
  OTRO:             'Otro',
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-600 border-gray-200', icon: null }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ReturnsManagementViewProps {
  initialReturns: ReturnRecord[]
}

export function ReturnsManagementView({ initialReturns }: ReturnsManagementViewProps) {
  const [returns, setReturns]               = useState<ReturnRecord[]>(initialReturns)
  const [searchTerm, setSearchTerm]         = useState('')
  const [filterStatus, setFilterStatus]     = useState('ALL')
  const [filterType, setFilterType]         = useState('ALL')
  const [showCreate, setShowCreate]         = useState(false)
  const [selected, setSelected]             = useState<ReturnRecord | null>(null)
  const [approvingId, setApprovingId]       = useState<string | null>(null)
  const [rejectingId, setRejectingId]       = useState<string | null>(null)

  // ── Metrics ─────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const pending    = returns.filter(r => r.status === 'PENDIENTE').length
    const approved   = returns.filter(r => r.status === 'APROBADA').length
    const completed  = returns.filter(r => r.status === 'COMPLETADA').length
    const totalAmount = returns.reduce((s, r) => s + Number(r.total_amount), 0)
    const reembolsos = returns.filter(r => r.return_type === 'REEMBOLSO').length
    return { pending, approved, completed, totalAmount, total: returns.length, reembolsos }
  }, [returns])

  // ── Filters ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => returns.filter(r => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      if (
        !r.return_number.toLowerCase().includes(q) &&
        !r.sale_number.toLowerCase().includes(q) &&
        !(r.client_name?.toLowerCase().includes(q))
      ) return false
    }
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false
    if (filterType   !== 'ALL' && r.return_type !== filterType) return false
    return true
  }), [returns, searchTerm, filterStatus, filterType])

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleApprove = async (ret: ReturnRecord) => {
    setApprovingId(ret.id)
    const result = await approveReturnAction(ret.id)
    setApprovingId(null)
    if (result.success) {
      toast.success(`Devolución ${ret.return_number} aprobada`, {
        description: (result as any).saleType === 'CREDITO'
          ? 'Plan de crédito cancelado y crédito del cliente restaurado.'
          : 'Egreso registrado en caja.',
      })
      setReturns(prev => prev.map(r => r.id === ret.id ? { ...r, status: 'APROBADA' } : r))
      if (selected?.id === ret.id) setSelected(s => s ? { ...s, status: 'APROBADA' } : s)
    } else {
      toast.error('No se pudo aprobar', { description: result.error })
    }
  }

  const handleReject = async (ret: ReturnRecord) => {
    setRejectingId(ret.id)
    const result = await rejectReturnAction(ret.id, 'Rechazada por administrador')
    setRejectingId(null)
    if (result.success) {
      toast.success(`Devolución ${ret.return_number} rechazada`)
      setReturns(prev => prev.map(r => r.id === ret.id ? { ...r, status: 'RECHAZADA' } : r))
      if (selected?.id === ret.id) setSelected(s => s ? { ...s, status: 'RECHAZADA' } : s)
    } else {
      toast.error(result.error || 'Error al rechazar')
    }
  }

  return (
    <div className="space-y-5 p-1">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-rose-500" />
            Devoluciones
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestiona reembolsos de productos
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 bg-rose-600 hover:bg-rose-700">
          <RotateCcw className="h-4 w-4" />
          Nueva Devolución
        </Button>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 border-l-4 border-l-amber-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Pendientes</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{metrics.pending}</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </div>
          <p className="text-xs text-amber-600 mt-1.5 font-medium">Por revisar</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Aprobadas</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{metrics.approved}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-blue-500" />
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-1.5 font-medium">En proceso</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total devuelto</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{formatCurrency(metrics.totalAmount)}</p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <TrendingDown className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{metrics.total} devoluciones totales</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Tipos</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{metrics.reembolsos}</p>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg">
              <ArrowLeftRight className="h-5 w-5 text-purple-500" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            reembolsos totales
          </p>
        </Card>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Buscar por número, venta o cliente..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="h-8 px-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="APROBADA">Aprobada</option>
              <option value="RECHAZADA">Rechazada</option>
              <option value="COMPLETADA">Completada</option>
            </select>
            {/* filterType removed — only REEMBOLSO exists */}
          </div>
          {(searchTerm || filterStatus !== 'ALL' || filterType !== 'ALL') && (
            <button
              onClick={() => { setSearchTerm(''); setFilterStatus('ALL'); setFilterType('ALL') }}
              className="text-xs text-rose-600 hover:underline"
            >
              Limpiar
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </Card>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Número</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Venta</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Motivo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Productos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <RotateCcw className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No se encontraron devoluciones</p>
                  </td>
                </tr>
              ) : (
                filtered.map(ret => {
                  const items = Array.isArray(ret.returned_items) ? ret.returned_items : []
                  const isPending = ret.status === 'PENDIENTE'
                  const isApproving = approvingId === ret.id
                  const isRejecting = rejectingId === ret.id

                  return (
                    <tr key={ret.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Number */}
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-gray-900 text-xs">
                          {ret.return_number}
                        </span>
                      </td>

                      {/* Sale */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-600">{ret.sale_number}</span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatSafeDate(ret.return_date || ret.created_at, 'dd/MM/yyyy')}
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3">
                        <span className="text-gray-900 font-medium">{ret.client_name || '-'}</span>
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {REASON_LABELS[ret.reason_type] || ret.reason_type}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                          ret.return_type === 'REEMBOLSO'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-sky-50 text-sky-700 border-sky-200'
                        }`}>
                          {ret.return_type === 'REEMBOLSO' ? '💵' : '🔄'}
                          {ret.return_type === 'REEMBOLSO' ? 'Reembolso' : 'Cambio'}
                        </span>
                      </td>

                      {/* Items count */}
                      <td className="px-4 py-3">
                        {items.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <Package className="h-3 w-3" />
                            {items.length} prod.
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(Number(ret.total_amount))}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={ret.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelected(ret)}
                            className="h-7 w-7 p-0"
                            title="Ver detalle"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {isPending && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isApproving || isRejecting}
                                onClick={() => handleApprove(ret)}
                                className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1"
                                title="Aprobar"
                              >
                                {isApproving
                                  ? <span className="h-3 w-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                  : <ThumbsUp className="h-3.5 w-3.5" />
                                }
                                <span className="hidden sm:inline">Aprobar</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isApproving || isRejecting}
                                onClick={() => handleReject(ret)}
                                className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
                                title="Rechazar"
                              >
                                {isRejecting
                                  ? <span className="h-3 w-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                  : <ThumbsDown className="h-3.5 w-3.5" />
                                }
                                <span className="hidden sm:inline">Rechazar</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateReturnDialog
          onClose={() => setShowCreate(false)}
          onSuccess={newReturn => {
            setReturns(prev => [newReturn as ReturnRecord, ...prev])
            setShowCreate(false)
            toast.success('Devolución registrada — pendiente de aprobación')
          }}
        />
      )}

      {selected && (
        <ReturnDetailsDialog
          returnData={selected}
          onClose={() => setSelected(null)}
          onApprove={() => handleApprove(selected)}
          onReject={() => handleReject(selected)}
          approving={approvingId === selected.id}
          rejecting={rejectingId === selected.id}
        />
      )}
    </div>
  )
}
