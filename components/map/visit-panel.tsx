'use client'

/**
 * VisitPanel
 * Right-side panel showing the list of clients selected for a visit session.
 * Each client can be marked as visited via RegisterVisitDialog.
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/currency'
import { X, Navigation, Trash2, CheckCircle2, Clock, MapPin } from 'lucide-react'
import {
  RegisterVisitDialog,
  VisitResultBadge,
  VisitedBadge,
  type VisitClient,
  type VisitResult,
} from './register-visit-dialog'

export interface VisitEntry {
  client: VisitClient & { max_days_overdue?: number }
  visitedResult?: VisitResult
  visitedAt?: string
}

interface Props {
  entries: VisitEntry[]
  visitType: string
  onRemove: (clientId: string) => void
  onClearAll: () => void
  onGenerateRoute: () => void
  generatingRoute: boolean
  open: boolean
  onClose: () => void
}

export function VisitPanel({
  entries,
  visitType,
  onRemove,
  onClearAll,
  onGenerateRoute,
  generatingRoute,
  open,
  onClose,
}: Props) {
  const [registering, setRegistering] = useState<VisitClient | null>(null)
  const [pastVisits, setPastVisits]   = useState<any[]>([])
  const [localEntries, setLocalEntries] = useState<VisitEntry[]>(entries)

  // Keep local entries in sync
  useEffect(() => { setLocalEntries(entries) }, [entries])

  const visitedCount  = localEntries.filter(e => e.visitedResult).length
  const pendingCount  = localEntries.length - visitedCount

  const handleOpenRegister = async (client: VisitClient) => {
    // Pre-fetch visit history for this client
    try {
      const res = await fetch(`/api/visits?client_id=${client.id}`)
      if (res.ok) {
        const { data } = await res.json()
        setPastVisits(data || [])
      }
    } catch { setPastVisits([]) }
    setRegistering(client)
  }

  const handleSaved = (visitId: string, result: VisitResult) => {
    setLocalEntries(prev =>
      prev.map(e =>
        e.client.id === registering?.id
          ? { ...e, visitedResult: result, visitedAt: new Date().toISOString() }
          : e
      )
    )
    setRegistering(null)
  }

  if (!open) return null

  return (
    <>
      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-40 flex flex-col border-l"
        style={{ maxWidth: '90vw' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              Visitas · {visitType}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {visitedCount} completada{visitedCount !== 1 ? 's' : ''}
              {pendingCount > 0 && ` · ${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress bar */}
        {localEntries.length > 0 && (
          <div className="h-1 bg-gray-100">
            <div
              className="h-1 bg-green-500 transition-all duration-500"
              style={{ width: `${(visitedCount / localEntries.length) * 100}%` }}
            />
          </div>
        )}

        {/* Client list */}
        <div className="flex-1 overflow-y-auto divide-y">
          {localEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <MapPin className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Selecciona clientes en el mapa</p>
              <p className="text-xs mt-1">Haz clic sobre un marcador</p>
            </div>
          )}

          {localEntries.map((entry, idx) => {
            const { client } = entry
            const visited = !!entry.visitedResult

            return (
              <div
                key={client.id}
                className={`px-4 py-3 transition-colors ${visited ? 'bg-green-50' : 'bg-white'}`}
              >
                <div className="flex items-start gap-2">
                  {/* Number + status */}
                  <div className="flex-shrink-0 mt-0.5">
                    {visited
                      ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                      : (
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-xs font-bold text-gray-600">
                          {idx + 1}
                        </span>
                      )
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${visited ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {client.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{client.address}</p>

                    {/* Debt / overdue info */}
                    {client.overdue_amount !== undefined && client.overdue_amount > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-red-600 font-semibold">
                          {formatCurrency(client.overdue_amount)} vencido
                        </span>
                        {(entry.client as any).max_days_overdue > 0 && (
                          <span className="text-xs text-orange-600 flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {(entry.client as any).max_days_overdue}d
                          </span>
                        )}
                      </div>
                    )}

                    {/* Result badge if visited */}
                    {entry.visitedResult && (
                      <div className="mt-1.5">
                        <VisitResultBadge result={entry.visitedResult} />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex flex-col gap-1">
                    {!visited ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenRegister(client)}
                        className="h-7 text-xs px-2"
                      >
                        Registrar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenRegister(client)}
                        className="h-7 text-xs px-2 text-gray-500"
                      >
                        Ver
                      </Button>
                    )}
                    <button
                      onClick={() => onRemove(client.id)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors self-center"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer actions */}
        <div className="border-t p-3 space-y-2 bg-gray-50">
          <Button
            onClick={onGenerateRoute}
            disabled={generatingRoute || localEntries.length === 0}
            className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Navigation className="h-3.5 w-3.5" />
            {generatingRoute ? 'Obteniendo GPS…' : `Ruta optimizada (${localEntries.length} paradas)`}
          </Button>
          <button
            onClick={onClearAll}
            disabled={localEntries.length === 0}
            className="flex items-center justify-center gap-1.5 w-full text-xs text-gray-500 hover:text-red-600 py-1 transition-colors disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpiar lista
          </button>
        </div>
      </div>

      {/* Register visit dialog */}
      {registering && (
        <RegisterVisitDialog
          client={registering}
          visitType={visitType}
          pastVisits={pastVisits}
          onClose={() => setRegistering(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
