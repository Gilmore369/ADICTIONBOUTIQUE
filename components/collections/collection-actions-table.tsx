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
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { formatSafeDate } from '@/lib/utils/date'

interface CollectionAction {
  id: string
  client_id: string
  client_name: string
  action_type: string
  result: string
  client_dni?: string | null
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
    MENSAJE_REDES: '📲 Redes Sociales',
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
    COMPROMISO_PAGO:        { label: '✅ Compromiso', variant: 'default' },
    PROMETE_PAGAR_FECHA:    { label: '📅 Promete Pagar', variant: 'default' },
    PAGO_REALIZADO:         { label: '💰 Pago Realizado', variant: 'default' },
    PAGO_PARCIAL:           { label: '💵 Pago Parcial', variant: 'default' },
    CLIENTE_COLABORADOR:    { label: '😊 Colaborador', variant: 'default' },
    SOLICITA_REFINANCIAMIENTO: { label: '🔄 Refinanciamiento', variant: 'outline' },
    SOLICITA_DESCUENTO:     { label: '💲 Descuento', variant: 'outline' },
    SE_NIEGA_PAGAR:         { label: '❌ Se Niega', variant: 'destructive' },
    NO_CONTESTA:            { label: '📵 No Contesta', variant: 'secondary' },
    TELEFONO_INVALIDO:      { label: '☎️ N° Inválido', variant: 'secondary' },
    NUMERO_EQUIVOCADO:      { label: '☎️ N° Equivocado', variant: 'secondary' },
    CLIENTE_MOLESTO:        { label: '😠 Molesto', variant: 'destructive' },
    DOMICILIO_INCORRECTO:   { label: '🏚️ Dom. Incorrecto', variant: 'secondary' },
    CLIENTE_NO_UBICADO:     { label: '🔍 No Ubicado', variant: 'secondary' },
    OTRO:                   { label: '📝 Otro', variant: 'secondary' }
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
  const [search, setSearch] = useState('')
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

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

  const toggleNote = (id: string) => {
    setExpandedNotes(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  // Client-side search filter by name or DNI
  const filtered = search.trim()
    ? actions.filter(a => {
        const q = search.toLowerCase()
        return (
          a.client_name.toLowerCase().includes(q) ||
          (a.client_dni && a.client_dni.toLowerCase().includes(q))
        )
      })
    : actions

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Buscar por nombre o DNI..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={actionTypeFilter} onValueChange={handleActionTypeChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="LLAMADA">📞 Llamada</SelectItem>
            <SelectItem value="WHATSAPP">💬 WhatsApp</SelectItem>
            <SelectItem value="MENSAJE_REDES">📲 Redes Sociales</SelectItem>
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
            <SelectItem value="PAGO_REALIZADO">💰 Pago Realizado</SelectItem>
            <SelectItem value="PROMETE_PAGAR_FECHA">📅 Promete Pagar</SelectItem>
            <SelectItem value="CLIENTE_COLABORADOR">😊 Colaborador</SelectItem>
            <SelectItem value="SOLICITA_REFINANCIAMIENTO">🔄 Refinanciamiento</SelectItem>
            <SelectItem value="SOLICITA_DESCUENTO">💲 Descuento</SelectItem>
            <SelectItem value="SE_NIEGA_PAGAR">❌ Se Niega</SelectItem>
            <SelectItem value="NO_CONTESTA">📵 No Contesta</SelectItem>
            <SelectItem value="TELEFONO_INVALIDO">☎️ N° Inválido</SelectItem>
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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground h-24"
                >
                  {loading ? 'Cargando acciones...' : search ? 'Sin resultados para la búsqueda' : 'No hay acciones de cobranza registradas'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((action) => {
                const resultBadge = getResultBadge(action.result)
                const isNoteExpanded = expandedNotes.has(action.id)

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

                    {/* Notes — expandible al hacer clic */}
                    <TableCell className="max-w-[240px]">
                      {action.notes ? (
                        <button
                          onClick={() => toggleNote(action.id)}
                          className="text-left w-full"
                          title={isNoteExpanded ? 'Colapsar' : 'Ver completo'}
                        >
                          <span className={`text-sm text-gray-700 ${isNoteExpanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}`}>
                            {action.notes}
                          </span>
                          {!isNoteExpanded && action.notes.length > 60 && (
                            <span className="text-xs text-primary font-medium ml-1">ver más</span>
                          )}
                        </button>
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
