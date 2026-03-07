'use client'

/**
 * ClientVisitsTable Component
 * 
 * Displays visit history for a client with photos and payment evidence
 */

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'
import { formatSafeDate } from '@/lib/utils/date'
import { MapPin, Camera, DollarSign, Calendar, FileText, Eye } from 'lucide-react'

interface Visit {
  id: string
  visit_date: string
  visit_type: string
  result: string
  comment?: string
  image_url?: string
  payment_amount?: number
  payment_method?: string
  payment_proof_url?: string
  promise_date?: string
  promise_amount?: number
  notes?: string
}

interface ClientVisitsTableProps {
  visits: Visit[]
  loading?: boolean
}

export function ClientVisitsTable({ visits, loading = false }: ClientVisitsTableProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </Card>
    )
  }

  if (visits.length === 0) {
    return (
      <Card className="p-8 text-center">
        <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No hay visitas registradas</p>
      </Card>
    )
  }

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

  return (
    <>
      <div className="space-y-3">
        {visits.map((visit) => {
          const colorClass = resultColors[visit.result] || 'bg-gray-50 border-gray-200 text-gray-800'
          
          return (
            <Card key={visit.id} className={`p-4 border ${colorClass}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold px-2 py-0.5 bg-white rounded-full">
                      {visit.visit_type}
                    </span>
                    <span className="text-xs opacity-80">
                      {formatSafeDate(visit.visit_date, 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>

                  {/* Result */}
                  <p className="font-semibold text-sm mb-2">{visit.result}</p>

                  {/* Comment */}
                  {visit.comment && (
                    <p className="text-xs opacity-80 mb-2">{visit.comment}</p>
                  )}

                  {/* Payment info */}
                  {visit.payment_amount && (
                    <div className="flex items-center gap-2 text-xs font-semibold mb-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>Pago: {formatCurrency(visit.payment_amount)}</span>
                      <span className="opacity-70">· {visit.payment_method}</span>
                    </div>
                  )}

                  {/* Promise info */}
                  {visit.promise_date && (
                    <div className="flex items-center gap-2 text-xs font-semibold mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Promesa: {formatSafeDate(visit.promise_date, 'dd/MM/yyyy')}</span>
                      {visit.promise_amount && (
                        <span className="opacity-70">· {formatCurrency(visit.promise_amount)}</span>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {visit.notes && (
                    <div className="flex items-start gap-2 text-xs mt-2 p-2 bg-white/50 rounded">
                      <FileText className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span className="opacity-80">{visit.notes}</span>
                    </div>
                  )}
                </div>

                {/* Evidence thumbnails */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {visit.image_url && (
                    <button
                      onClick={() => setSelectedImage(visit.image_url!)}
                      className="relative group"
                      title="Ver foto de la visita"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={visit.image_url}
                        alt="Foto de visita"
                        className="w-16 h-16 object-cover rounded border-2 border-white shadow-sm"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                        <Eye className="h-4 w-4 text-white" />
                      </div>
                    </button>
                  )}
                  
                  {visit.payment_proof_url && (
                    <button
                      onClick={() => setSelectedImage(visit.payment_proof_url!)}
                      className="relative group"
                      title="Ver comprobante de pago"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={visit.payment_proof_url}
                        alt="Comprobante"
                        className="w-16 h-16 object-cover rounded border-2 border-green-300 shadow-sm"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                        <Eye className="h-4 w-4 text-white" />
                      </div>
                      <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5">
                        <DollarSign className="h-2.5 w-2.5" />
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Image viewer modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt="Vista ampliada"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg"
            >
              <span className="sr-only">Cerrar</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
