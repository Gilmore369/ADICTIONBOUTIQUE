'use client'

/**
 * RouteReportDialog
 * Generates a professional report of completed visits/collections route
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'
import { PERU_TZ } from '@/lib/utils/timezone'
import { X, Download, FileText, CheckCircle2, Clock, MapPin, DollarSign } from 'lucide-react'
import { formatSafeDate } from '@/lib/utils/date'
import type { VisitEntry } from './visit-panel'

interface Props {
  entries: VisitEntry[]
  visitType: string
  onClose: () => void
}

export function RouteReportDialog({ entries, visitType, onClose }: Props) {
  const [generating, setGenerating] = useState(false)

  const visitedEntries = entries.filter(e => e.visitedResult)
  const totalVisits = visitedEntries.length
  const totalPayments = visitedEntries.filter(e => 
    e.visitedResult === 'Pagó' || e.visitedResult === 'Abono parcial'
  ).length
  const totalPromises = visitedEntries.filter(e => 
    e.visitedResult === 'Prometió pagar'
  ).length
  const totalRejections = visitedEntries.filter(e => 
    e.visitedResult === 'Rechazó' || e.visitedResult === 'Sin respuesta'
  ).length

  const handleDownloadReport = async () => {
    setGenerating(true)
    
    // Generate report content
    const reportDate = new Date().toLocaleString('es-PE', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: PERU_TZ,
    })
    
    let reportContent = `
═══════════════════════════════════════════════════════════
  REPORTE DE RUTA DE ${visitType.toUpperCase()}
═══════════════════════════════════════════════════════════

Fecha: ${reportDate}
Total de visitas: ${totalVisits}

RESUMEN EJECUTIVO
─────────────────────────────────────────────────────────
✅ Pagos recibidos:        ${totalPayments}
🤝 Promesas de pago:       ${totalPromises}
❌ Rechazos/Sin respuesta: ${totalRejections}
📍 Otros resultados:       ${totalVisits - totalPayments - totalPromises - totalRejections}

DETALLE DE VISITAS
─────────────────────────────────────────────────────────
`

    visitedEntries.forEach((entry, idx) => {
      const { client, visitedResult, visitedAt } = entry
      const time = visitedAt ? new Date(visitedAt).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: PERU_TZ,
      }) : '--:--'

      reportContent += `
${idx + 1}. ${client.name}
   Hora: ${time}
   Resultado: ${visitedResult}
   Dirección: ${client.address}
   Teléfono: ${client.phone}
   ${client.overdue_amount ? `Deuda vencida: ${formatCurrency(client.overdue_amount)}` : ''}
   ─────────────────────────────────────────────────────
`
    })

    reportContent += `

═══════════════════════════════════════════════════════════
  FIN DEL REPORTE
═══════════════════════════════════════════════════════════
`

    // Create downloadable file
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-${visitType.toLowerCase()}-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    setGenerating(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">Reporte de Ruta</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {visitType} · {formatSafeDate(new Date().toISOString(), 'dd/MM/yyyy')}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-blue-700 font-medium">Total Visitas</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{totalVisits}</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-xs text-green-700 font-medium">Pagos</span>
              </div>
              <p className="text-2xl font-bold text-green-900">{totalPayments}</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-xs text-amber-700 font-medium">Promesas</span>
              </div>
              <p className="text-2xl font-bold text-amber-900">{totalPromises}</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <X className="h-4 w-4 text-red-600" />
                <span className="text-xs text-red-700 font-medium">Rechazos</span>
              </div>
              <p className="text-2xl font-bold text-red-900">{totalRejections}</p>
            </div>
          </div>

          {/* Visit List */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Detalle de Visitas</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {visitedEntries.map((entry, idx) => {
                const { client, visitedResult, visitedAt } = entry
                const time = visitedAt ? new Date(visitedAt).toLocaleTimeString('es-PE', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: PERU_TZ,
                }) : '--:--'
                
                const resultColors: Record<string, string> = {
                  'Pagó': 'bg-green-50 border-green-200 text-green-800',
                  'Abono parcial': 'bg-yellow-50 border-yellow-200 text-yellow-800',
                  'Prometió pagar': 'bg-blue-50 border-blue-200 text-blue-800',
                  'No estaba': 'bg-orange-50 border-orange-200 text-orange-800',
                  'Rechazó': 'bg-red-50 border-red-200 text-red-800',
                  'Interesado': 'bg-purple-50 border-purple-200 text-purple-800',
                  'Dejé recado': 'bg-slate-50 border-slate-200 text-slate-800',
                  'Sin respuesta': 'bg-gray-50 border-gray-200 text-gray-800',
                }
                
                const colorClass = resultColors[visitedResult || ''] || 'bg-gray-50 border-gray-200 text-gray-800'

                return (
                  <div key={client.id} className={`border rounded-lg p-3 ${colorClass}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-white text-xs font-bold">
                            {idx + 1}
                          </span>
                          <p className="font-semibold text-sm truncate">{client.name}</p>
                        </div>
                        <p className="text-xs opacity-80 truncate">{client.address}</p>
                        {client.overdue_amount && client.overdue_amount > 0 && (
                          <p className="text-xs font-semibold mt-1">
                            Deuda: {formatCurrency(client.overdue_amount)}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium">{visitedResult}</p>
                        <p className="text-xs opacity-70">{time}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadReport}
              disabled={generating || totalVisits === 0}
              className="flex-1 gap-2"
            >
              <Download className="h-4 w-4" />
              {generating ? 'Generando...' : 'Descargar Reporte'}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cerrar
            </Button>
          </div>

          {totalVisits === 0 && (
            <p className="text-sm text-center text-gray-500 py-4">
              No hay visitas completadas para generar el reporte
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
