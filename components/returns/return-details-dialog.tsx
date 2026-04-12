'use client'

import { Button } from '@/components/ui/button'
import {
  X, Package, CheckCircle, XCircle, Clock,
  ThumbsUp, ThumbsDown, RotateCcw,
  Banknote, Receipt,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatSafeDate } from '@/lib/utils/date'
import type { ReturnRecord, ReturnedItem } from './returns-management-view'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReturnDetailsDialogProps {
  returnData: ReturnRecord
  onClose: () => void
  onApprove?: () => void
  onReject?: () => void
  approving?: boolean
  rejecting?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  DEFECTO_PRODUCTO: 'Producto defectuoso',
  TALLA_INCORRECTA: 'Talla incorrecta',
  COLOR_DIFERENTE:  'Color diferente',
  NO_SATISFECHO:    'No satisfecho',
  CAMBIO_OPINION:   'Cambió de opinión',
  OTRO:             'Otro',
}

const STATUS_STEPS = ['PENDIENTE', 'APROBADA', 'COMPLETADA']

function StatusTimeline({ status }: { status: string }) {
  if (status === 'RECHAZADA') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 rounded-lg border border-red-200">
        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-700">Devolución Rechazada</p>
          <p className="text-xs text-red-500">Esta devolución fue rechazada</p>
        </div>
      </div>
    )
  }

  const currentIdx = STATUS_STEPS.indexOf(status)

  return (
    <div className="flex items-center gap-0">
      {STATUS_STEPS.map((step, i) => {
        const isDone   = i <= currentIdx
        const isCurrent = i === currentIdx
        const isLast   = i === STATUS_STEPS.length - 1

        const labels: Record<string, string> = {
          PENDIENTE: 'Registrada',
          APROBADA: 'Aprobada',
          COMPLETADA: 'Completada',
        }

        return (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={[
                'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                isDone
                  ? isCurrent ? 'bg-primary text-white shadow-md' : 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-400',
              ].join(' ')}>
                {i < currentIdx
                  ? <CheckCircle className="h-4 w-4" />
                  : i === 0
                    ? <Receipt className="h-3.5 w-3.5" />
                    : i === 1
                      ? <ThumbsUp className="h-3.5 w-3.5" />
                      : <CheckCircle className="h-3.5 w-3.5" />
                }
              </div>
              <span className={`text-[10px] mt-1 font-medium ${isDone ? 'text-gray-700' : 'text-gray-400'}`}>
                {labels[step]}
              </span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < currentIdx ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReturnDetailsDialog({
  returnData,
  onClose,
  onApprove,
  onReject,
  approving,
  rejecting,
}: ReturnDetailsDialogProps) {
  const items: ReturnedItem[] = Array.isArray(returnData.returned_items)
    ? returnData.returned_items
    : []
  const isPending = returnData.status === 'PENDIENTE'
  const saleType = returnData.sales?.sale_type as 'CONTADO' | 'CREDITO' | undefined

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 rounded-lg">
              <RotateCcw className="h-4 w-4 text-rose-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{returnData.return_number}</h2>
              <p className="text-xs text-gray-500">Venta: {returnData.sale_number}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

          {/* ── Status timeline ─────────────────────────────────────────────── */}
          <StatusTimeline status={returnData.status} />

          {/* ── Two-column info ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left: client + date */}
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Cliente</p>
                <p className="text-sm font-semibold text-gray-900">
                  {returnData.client_name || 'Sin nombre'}
                </p>
                {returnData.clients?.dni && (
                  <p className="text-xs text-gray-500">DNI {returnData.clients.dni}</p>
                )}
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Fecha de registro</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatSafeDate(returnData.return_date || returnData.created_at, "dd/MM/yyyy 'a las' HH:mm")}
                </p>
              </div>
            </div>

            {/* Right: type + amount */}
            <div className="space-y-3">
              <div className="p-3 rounded-lg border bg-purple-50 border-purple-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Tipo de devolución</p>
                <p className="text-sm font-semibold flex items-center gap-1.5 text-purple-700">
                  <Banknote className="h-4 w-4" /> Reembolso de dinero
                </p>
                {saleType && (
                  <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
                    saleType === 'CREDITO'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    Venta {saleType}
                  </span>
                )}
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Monto devuelto</p>
                <p className="text-xl font-bold text-rose-700">
                  {formatCurrency(Number(returnData.total_amount))}
                </p>
              </div>
            </div>
          </div>

          {/* ── Reason ──────────────────────────────────────────────────────── */}
          <div className="p-3 border rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
              Motivo · {REASON_LABELS[returnData.reason_type] || returnData.reason_type}
            </p>
            <p className="text-sm text-gray-700">{returnData.reason || '—'}</p>
            {returnData.notes && (
              <p className="text-xs text-gray-500 mt-1.5 pt-1.5 border-t">{returnData.notes}</p>
            )}
          </div>

          {/* ── Returned products ───────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Productos devueltos
              {items.length > 0 && (
                <span className="font-normal normal-case text-gray-400">
                  ({items.length} línea{items.length !== 1 ? 's' : ''})
                </span>
              )}
            </p>

            {items.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-4 rounded-lg bg-gray-50 border border-dashed">
                <Package className="h-4 w-4 text-gray-300" />
                <span className="text-sm text-gray-400">Sin detalle de productos registrado</span>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-16">Cant.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-24">P. Unit.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-24">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-900 text-sm">
                            {item.product_name || `Producto ${idx + 1}`}
                          </p>
                          {item.product_id && (
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                              ID: {item.product_id.slice(0, 8)}…
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-50 text-rose-700 font-semibold text-xs">
                            {item.quantity}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600">
                          {formatCurrency(Number(item.unit_price))}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                          {formatCurrency(Number(item.subtotal || item.unit_price * item.quantity))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-rose-50 border-t">
                      <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-rose-700 uppercase">
                        Total a devolver
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-rose-700">
                        {formatCurrency(Number(returnData.total_amount))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ── Effects note ────────────────────────────────────────────────── */}
          {returnData.status === 'APROBADA' && (
            <div className="flex flex-col gap-1.5 px-3 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Efectos registrados al aprobar
              </p>
              {saleType === 'CONTADO' && (
                <p className="text-xs text-emerald-600">
                  💵 Egreso de {formatCurrency(Number(returnData.total_amount))} registrado en caja
                </p>
              )}
              {saleType === 'CREDITO' && (
                <>
                  <p className="text-xs text-emerald-600">
                    🏦 Plan de crédito cancelado y cuotas pendientes eliminadas
                  </p>
                  <p className="text-xs text-emerald-600">
                    ✅ Crédito del cliente restaurado por {formatCurrency(Number(returnData.total_amount))}
                  </p>
                </>
              )}
              {!saleType && (
                <p className="text-xs text-emerald-600">
                  💵 Efectos financieros registrados según tipo de venta
                </p>
              )}
              <p className="text-xs text-emerald-600">
                📦 Stock se restituirá al completar
              </p>
            </div>
          )}

          {/* ── Pending note ────────────────────────────────────────────────── */}
          {isPending && (
            <div className="flex items-start gap-2 px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Clock className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700">Pendiente de revisión</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {saleType === 'CONTADO' && 'Al aprobar se registrará un egreso en caja. La caja debe estar abierta en la tienda.'}
                  {saleType === 'CREDITO' && 'Al aprobar se cancelará el plan de crédito, se eliminarán las cuotas pendientes y se restaurará el límite de crédito del cliente.'}
                  {!saleType && 'Al aprobar se procesará el reembolso según el tipo de venta original.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t bg-gray-50/50 flex-shrink-0">
          <div>
            {isPending && onApprove && onReject && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={approving || rejecting}
                  onClick={onReject}
                  className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                >
                  {rejecting
                    ? <span className="h-3 w-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    : <ThumbsDown className="h-3.5 w-3.5" />
                  }
                  Rechazar
                </Button>
                <Button
                  size="sm"
                  disabled={approving || rejecting}
                  onClick={onApprove}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  {approving
                    ? <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <ThumbsUp className="h-3.5 w-3.5" />
                  }
                  Aprobar devolución
                </Button>
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}
