'use client'

import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatSafeDate } from '@/lib/utils/date'

interface ReturnDetailsDialogProps {
  returnData: any
  onClose: () => void
}

export function ReturnDetailsDialog({ returnData, onClose }: ReturnDetailsDialogProps) {
  const getStatusColor = (status: string) => {
    const colors = {
      PENDIENTE: 'text-yellow-600 bg-yellow-50',
      APROBADA: 'text-blue-600 bg-blue-50',
      RECHAZADA: 'text-red-600 bg-red-50',
      COMPLETADA: 'text-green-600 bg-green-50'
    }
    return colors[status as keyof typeof colors] || 'text-gray-600 bg-gray-50'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Detalles de Devolución</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Número de Devolución</p>
              <p className="text-lg font-mono font-semibold">{returnData.return_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(returnData.status)}`}>
                {returnData.status}
              </span>
            </div>
          </div>

          {/* Sale Info */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Información de Venta</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Número de Venta</p>
                <p className="font-mono">{returnData.sale_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fecha de Devolución</p>
                <p>{formatSafeDate(returnData.return_date, 'dd/MM/yyyy HH:mm', '-')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Cliente</p>
                <p>{returnData.client_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Monto</p>
                <p className="font-semibold">{formatCurrency(returnData.total_amount)}</p>
              </div>
            </div>
          </div>

          {/* Return Info */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Detalles de Devolución</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Tipo</p>
                <p className="font-medium">{returnData.return_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Motivo</p>
                <p>{returnData.reason || '-'}</p>
              </div>
              {returnData.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notas</p>
                  <p className="text-sm">{returnData.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Extension Info */}
          {returnData.extension_requested && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Extensión de Plazo</h3>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="text-gray-500">Estado:</span>{' '}
                  <span className={returnData.extension_granted ? 'text-green-600' : 'text-yellow-600'}>
                    {returnData.extension_granted ? 'Aprobada' : 'Pendiente'}
                  </span>
                </p>
                {returnData.extension_reason && (
                  <p className="text-sm">
                    <span className="text-gray-500">Motivo:</span> {returnData.extension_reason}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-end">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}
