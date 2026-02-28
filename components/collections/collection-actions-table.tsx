/**
 * CollectionActionsTable Component
 * 
 * Table showing collection action history with filters and sorting.
 * Displays date, client, action type, result, promise date, notes, and user.
 * 
 * Features:
 * - Table with collection action details
 * - Filter by client, action type, result
 * - Sortable by date descending
 * - Responsive design
 * - Color-coded results
 * 
 * Design Tokens:
 * - Border radius: 8px
 * - Spacing: 8px, 16px
 * - Button height: 36px
 * 
 * Requirements: 10.6
 * 
 * @example
 * ```tsx
 * <CollectionActionsTable
 *   actions={actions}
 *   onFilter={(filters) => console.log('Filters:', filters)}
 * />
 * ```
 */

'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatSafeDate } from '@/lib/utils/date'

interface CollectionAction {
  id: string
  client_id: string
  client_name: string
  action_type: 'LLAMADA' | 'VISITA' | 'WHATSAPP' | 'MENSAJE_SMS' | 'EMAIL' | 'MOTORIZADO' | 'CARTA_NOTARIAL' | 'OTRO'
  result: 'COMPROMISO_PAGO' | 'SE_NIEGA_PAGAR' | 'NO_CONTESTA' | 'TELEFONO_INVALIDO' | 'PAGO_REALIZADO' | 'PAGO_PARCIAL' | 'SOLICITA_REFINANCIAMIENTO' | 'SOLICITA_DESCUENTO' | 'PROMETE_PAGAR_FECHA' | 'CLIENTE_MOLESTO' | 'CLIENTE_COLABORADOR' | 'DOMICILIO_INCORRECTO' | 'CLIENTE_NO_UBICADO' | 'OTRO'
  payment_promise_date?: string | null
  notes?: string | null
  user_id: string
  user_name?: string
  created_at: string
}

interface CollectionActionsTableProps {
  actions: CollectionAction[]
  loading?: boolean
  onFilter?: (filters: {
    action_type?: string
    result?: string
  }) => void
}

// Helper to get action type label
const getActionTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    LLAMADA: '📞 Llamada',
    VISITA: '🏠 Visita',
    WHATSAPP: '💬 WhatsApp',
    MENSAJE_SMS: '📱 SMS',
    EMAIL: '📧 Email',
    MOTORIZADO: '🏍️ Motorizado',
    CARTA_NOTARIAL: '📄 Carta Notarial',
    OTRO: '📋 Otro'
  }
  return labels[type] || type
}

// Helper to get result label and color
const getResultBadge = (result: string) => {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    COMPROMISO_PAGO: { label: '✅ Compromiso de Pago', variant: 'default' },
    PROMETE_PAGAR_FECHA: { label: '📅 Promete Pagar', variant: 'default' },
    PAGO_REALIZADO: { label: '💰 Pago Realizado', variant: 'default' },
    PAGO_PARCIAL: { label: '💵 Pago Parcial', variant: 'default' },
    CLIENTE_COLABORADOR: { label: '😊 Colaborador', variant: 'default' },
    SOLICITA_REFINANCIAMIENTO: { label: '🔄 Refinanciamiento', variant: 'outline' },
    SOLICITA_DESCUENTO: { label: '💲 Descuento', variant: 'outline' },
    SE_NIEGA_PAGAR: { label: '❌ Se Niega', variant: 'destructive' },
    NO_CONTESTA: { label: '📵 No Contesta', variant: 'secondary' },
    TELEFONO_INVALIDO: { label: '☎️ Tel. Inválido', variant: 'secondary' },
    CLIENTE_MOLESTO: { label: '😠 Molesto', variant: 'destructive' },
    DOMICILIO_INCORRECTO: { label: '🏚️ Dom. Incorrecto', variant: 'secondary' },
    CLIENTE_NO_UBICADO: { label: '🔍 No Ubicado', variant: 'secondary' },
    OTRO: { label: '📝 Otro', variant: 'secondary' }
  }
  return config[result] || { label: result, variant: 'secondary' as const }
}

export function CollectionActionsTable({
  actions,
  loading = false,
  onFilter
}: CollectionActionsTableProps) {
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all')
  const [resultFilter, setResultFilter] = useState<string>('all')

  // Handle filter changes
  const handleActionTypeChange = (value: string) => {
    setActionTypeFilter(value)
    onFilter?.({
      action_type: value === 'all' ? undefined : value,
      result: resultFilter === 'all' ? undefined : resultFilter
    })
  }

  const handleResultChange = (value: string) => {
    setResultFilter(value)
    onFilter?.({
      action_type: actionTypeFilter === 'all' ? undefined : actionTypeFilter,
      result: value === 'all' ? undefined : value
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <Select value={actionTypeFilter} onValueChange={handleActionTypeChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="LLAMADA">📞 Llamada</SelectItem>
            <SelectItem value="VISITA">🏠 Visita</SelectItem>
            <SelectItem value="WHATSAPP">💬 WhatsApp</SelectItem>
            <SelectItem value="MENSAJE_SMS">📱 SMS</SelectItem>
            <SelectItem value="EMAIL">📧 Email</SelectItem>
            <SelectItem value="MOTORIZADO">🏍️ Motorizado</SelectItem>
            <SelectItem value="CARTA_NOTARIAL">📄 Carta Notarial</SelectItem>
            <SelectItem value="OTRO">📋 Otro</SelectItem>
          </SelectContent>
        </Select>

        <Select value={resultFilter} onValueChange={handleResultChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Resultado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los resultados</SelectItem>
            <SelectItem value="COMPROMISO_PAGO">✅ Compromiso de Pago</SelectItem>
            <SelectItem value="PROMETE_PAGAR_FECHA">📅 Promete Pagar</SelectItem>
            <SelectItem value="PAGO_REALIZADO">💰 Pago Realizado</SelectItem>
            <SelectItem value="PAGO_PARCIAL">💵 Pago Parcial</SelectItem>
            <SelectItem value="CLIENTE_COLABORADOR">😊 Colaborador</SelectItem>
            <SelectItem value="SOLICITA_REFINANCIAMIENTO">🔄 Refinanciamiento</SelectItem>
            <SelectItem value="SOLICITA_DESCUENTO">💲 Descuento</SelectItem>
            <SelectItem value="SE_NIEGA_PAGAR">❌ Se Niega</SelectItem>
            <SelectItem value="NO_CONTESTA">📵 No Contesta</SelectItem>
            <SelectItem value="TELEFONO_INVALIDO">☎️ Tel. Inválido</SelectItem>
            <SelectItem value="CLIENTE_MOLESTO">😠 Molesto</SelectItem>
            <SelectItem value="DOMICILIO_INCORRECTO">🏚️ Dom. Incorrecto</SelectItem>
            <SelectItem value="CLIENTE_NO_UBICADO">🔍 No Ubicado</SelectItem>
            <SelectItem value="OTRO">📝 Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo de Acción</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Fecha Promesa</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground h-24"
                >
                  {loading ? 'Cargando acciones...' : 'No hay acciones de cobranza registradas'}
                </TableCell>
              </TableRow>
            ) : (
              actions.map((action) => {
                const resultBadge = getResultBadge(action.result)
                
                return (
                  <TableRow key={action.id}>
                    {/* Date */}
                    <TableCell className="font-medium">
                      {formatSafeDate(action.created_at, 'dd MMM yyyy')}
                    </TableCell>

                    {/* Client */}
                    <TableCell>{action.client_name}</TableCell>

                    {/* Action Type */}
                    <TableCell>
                      <span className="text-sm">
                        {getActionTypeLabel(action.action_type)}
                      </span>
                    </TableCell>

                    {/* Result */}
                    <TableCell>
                      <Badge variant={resultBadge.variant}>
                        {resultBadge.label}
                      </Badge>
                    </TableCell>

                    {/* Promise Date */}
                    <TableCell>
                      {action.payment_promise_date ? (
                        <span className="text-sm">
                          {formatSafeDate(action.payment_promise_date, 'dd/MM/yyyy')}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </TableCell>

                    {/* Notes */}
                    <TableCell className="max-w-[200px]">
                      {action.notes ? (
                        <span className="text-sm text-gray-600 truncate block">
                          {action.notes}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </TableCell>

                    {/* User */}
                    <TableCell className="text-sm text-gray-600">
                      {action.user_name || action.user_id.substring(0, 8)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
