'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RotateCcw, Search, CheckCircle, XCircle, Clock, Package } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatSafeDate } from '@/lib/utils/date'
import { CreateReturnDialog } from './create-return-dialog'
import { ReturnDetailsDialog } from './return-details-dialog'
import { toast } from 'sonner'
import { approveReturnAction, rejectReturnAction, completeReturnAction } from '@/actions/returns'

interface Return {
  id: string
  return_number: string
  sale_number: string
  return_date: string
  client_name: string
  reason_type: string
  return_type: string
  total_amount: number
  status: string
  clients: {
    id: string
    name: string
    dni: string | null
  } | null
}

interface ReturnsManagementViewProps {
  initialReturns: Return[]
}

export function ReturnsManagementView({ initialReturns }: ReturnsManagementViewProps) {
  const [returns, setReturns] = useState<Return[]>(initialReturns)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null)

  // Calculate metrics
  const metrics = useMemo(() => {
    const pending = returns.filter(r => r.status === 'PENDIENTE').length
    const approved = returns.filter(r => r.status === 'APROBADA').length
    const completed = returns.filter(r => r.status === 'COMPLETADA').length
    const totalAmount = returns.reduce((sum, r) => sum + r.total_amount, 0)

    return { pending, approved, completed, totalAmount, total: returns.length }
  }, [returns])

  // Filter returns
  const filteredReturns = useMemo(() => {
    return returns.filter(ret => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchesNumber = ret.return_number.toLowerCase().includes(term)
        const matchesSale = ret.sale_number.toLowerCase().includes(term)
        const matchesClient = ret.client_name?.toLowerCase().includes(term)
        if (!matchesNumber && !matchesSale && !matchesClient) return false
      }

      if (filterStatus !== 'ALL' && ret.status !== filterStatus) return false
      if (filterType !== 'ALL' && ret.return_type !== filterType) return false

      return true
    })
  }, [returns, searchTerm, filterStatus, filterType])

  const handleApprove = async (returnId: string) => {
    const result = await approveReturnAction(returnId)
    if (result.success) {
      toast.success('Devolución aprobada')
      setReturns(prev => prev.map(r => r.id === returnId ? { ...r, status: 'APROBADA' } : r))
    } else {
      toast.error('Error al aprobar devolución')
    }
  }

  const handleReject = async (returnId: string) => {
    const result = await rejectReturnAction(returnId, 'Rechazada por administrador')
    if (result.success) {
      toast.success('Devolución rechazada')
      setReturns(prev => prev.map(r => r.id === returnId ? { ...r, status: 'RECHAZADA' } : r))
    } else {
      toast.error('Error al rechazar devolución')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDIENTE: 'bg-yellow-100 text-yellow-700',
      APROBADA: 'bg-blue-100 text-blue-700',
      RECHAZADA: 'bg-red-100 text-red-700',
      COMPLETADA: 'bg-green-100 text-green-700'
    }
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'
  }

  const getReasonLabel = (reasonType: string) => {
    const labels = {
      DEFECTO_PRODUCTO: 'Defecto',
      TALLA_INCORRECTA: 'Talla',
      COLOR_DIFERENTE: 'Color',
      NO_SATISFECHO: 'No satisfecho',
      CAMBIO_OPINION: 'Cambió opinión',
      OTRO: 'Otro'
    }
    return labels[reasonType as keyof typeof labels] || reasonType
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Devoluciones</h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona devoluciones y cambios de productos
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Nueva Devolución
        </Button>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-xs font-medium text-yellow-600">PENDIENTES</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{metrics.pending}</p>
          <p className="text-xs text-gray-600 mt-1">Por revisar</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600">APROBADAS</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{metrics.approved}</p>
          <p className="text-xs text-gray-600 mt-1">En proceso</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-600">COMPLETADAS</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{metrics.completed}</p>
          <p className="text-xs text-gray-600 mt-1">Finalizadas</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <RotateCcw className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-600">TOTAL</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalAmount)}</p>
          <p className="text-xs text-gray-600 mt-1">{metrics.total} devoluciones</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por número, venta o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="ALL">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="APROBADA">Aprobada</option>
            <option value="RECHAZADA">Rechazada</option>
            <option value="COMPLETADA">Completada</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="ALL">Todos los tipos</option>
            <option value="REEMBOLSO">Reembolso</option>
            <option value="CAMBIO">Cambio</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Venta</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                    No se encontraron devoluciones
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                      {ret.return_number}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">
                      {ret.sale_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatSafeDate(ret.return_date, 'dd/MM/yyyy', '-')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {ret.client_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getReasonLabel(ret.reason_type)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        ret.return_type === 'REEMBOLSO'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {ret.return_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                      {formatCurrency(ret.total_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(ret.status)}`}>
                        {ret.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReturn(ret)}
                        >
                          Ver
                        </Button>
                        {ret.status === 'PENDIENTE' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(ret.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              Aprobar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReject(ret.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Rechazar
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dialogs */}
      {showCreateDialog && (
        <CreateReturnDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={(newReturn) => {
            setReturns(prev => [newReturn, ...prev])
            setShowCreateDialog(false)
          }}
        />
      )}

      {selectedReturn && (
        <ReturnDetailsDialog
          returnData={selectedReturn}
          onClose={() => setSelectedReturn(null)}
        />
      )}
    </div>
  )
}
