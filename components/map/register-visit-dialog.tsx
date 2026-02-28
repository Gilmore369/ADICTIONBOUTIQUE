'use client'

/**
 * RegisterVisitDialog
 * Modal to log a field visit: result, comment, optional photo.
 */

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'
import { X, Camera, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { formatSafeDate } from '@/lib/utils/date'

export interface VisitClient {
  id: string
  name: string
  phone: string
  address: string
  overdue_amount?: number
  credit_used?: number
  credit_limit?: number
}

interface PastVisit {
  id: string
  visit_date: string
  visit_type: string
  result: string
  comment?: string
}

export const VISIT_RESULTS = [
  { value: 'Pagó',             emoji: '✅', color: 'text-green-700  bg-green-50  border-green-200'  },
  { value: 'Abono parcial',    emoji: '🟡', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  { value: 'Prometió pagar',   emoji: '🤝', color: 'text-blue-700   bg-blue-50   border-blue-200'   },
  { value: 'No estaba',        emoji: '🚪', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { value: 'Rechazó',          emoji: '❌', color: 'text-red-700    bg-red-50    border-red-200'    },
  { value: 'Interesado',       emoji: '💜', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { value: 'Dejé recado',      emoji: '📝', color: 'text-slate-700  bg-slate-50  border-slate-200'  },
  { value: 'Sin respuesta',    emoji: '📵', color: 'text-gray-700   bg-gray-50   border-gray-200'   },
] as const

export type VisitResult = typeof VISIT_RESULTS[number]['value']

interface Props {
  client: VisitClient
  visitType: string
  pastVisits: PastVisit[]
  onClose: () => void
  onSaved: (visitId: string, result: VisitResult) => void
}

export function RegisterVisitDialog({ client, visitType, pastVisits, onClose, onSaved }: Props) {
  const [result, setResult]       = useState<VisitResult | ''>('')
  const [comment, setComment]     = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createBrowserClient()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('La imagen no debe superar 5 MB.'); return }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setError('')
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext  = file.name.split('.').pop()
    const path = `visits/${client.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('visit-images')
      .upload(path, file, { upsert: false })
    if (error) { console.warn('Image upload failed:', error.message); return null }
    const { data } = supabase.storage.from('visit-images').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSave = async () => {
    if (!result) { setError('Selecciona el resultado de la visita.'); return }
    setSaving(true)
    setError('')

    let image_url: string | null = null
    if (imageFile) image_url = await uploadImage(imageFile)

    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:  client.id,
        visit_type: visitType,
        result,
        comment:   comment.trim() || null,
        image_url,
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const { error: msg } = await res.json()
      setError(msg || 'Error al guardar la visita.')
      return
    }
    const { data } = await res.json()
    onSaved(data.id, result as VisitResult)
  }

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              {visitType} · Registrar visita
            </p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">{client.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">📍 {client.address}</p>
            {client.overdue_amount !== undefined && client.overdue_amount > 0 && (
              <p className="text-xs text-red-600 font-semibold mt-1">
                Deuda vencida: {formatCurrency(client.overdue_amount)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -mt-1 -mr-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Result selector */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">
              Resultado de la visita <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {VISIT_RESULTS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setResult(opt.value); setError('') }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    result === opt.value
                      ? opt.color + ' ring-2 ring-offset-1 ring-current'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <span>{opt.emoji}</span>
                  <span className="text-left leading-tight">{opt.value}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              Comentario <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Ej: Dijo que pagará el viernes, número alternativo 987…"
              rows={3}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Image */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              Foto <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageChange}
            />
            {imagePreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="preview"
                  className="w-full h-36 object-cover rounded-lg border"
                />
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null) }}
                  className="absolute top-1 right-1 bg-white/90 rounded-full p-1 shadow"
                >
                  <X className="h-3.5 w-3.5 text-gray-600" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
              >
                <Camera className="h-5 w-5" />
                Tomar foto o seleccionar imagen
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Save */}
          <Button
            onClick={handleSave}
            disabled={saving || !result}
            className="w-full"
          >
            {saving ? 'Guardando…' : 'Registrar visita'}
          </Button>

          {/* Past visits history */}
          {pastVisits.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 w-full"
              >
                <Clock className="h-3.5 w-3.5" />
                {pastVisits.length} visita{pastVisits.length !== 1 ? 's' : ''} anterior{pastVisits.length !== 1 ? 'es' : ''}
                {showHistory ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>
              {showHistory && (
                <div className="mt-2 space-y-1.5">
                  {pastVisits.slice(0, 10).map(v => {
                    const res = VISIT_RESULTS.find(r => r.value === v.result)
                    return (
                      <div key={v.id} className="flex items-start gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                        <span className="mt-0.5">{res?.emoji ?? '📋'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-800">{v.result}</span>
                            <span className="text-gray-400 whitespace-nowrap">
                              {formatSafeDate(v.visit_date, 'dd/MM/yy')}
                            </span>
                          </div>
                          {v.comment && (
                            <p className="text-gray-500 mt-0.5 truncate">{v.comment}</p>
                          )}
                          <span className="text-gray-400">{v.visit_type}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

// Small badge for use in the visit panel list
export function VisitResultBadge({ result }: { result: string }) {
  const opt = VISIT_RESULTS.find(r => r.value === result)
  if (!opt) return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${opt.color}`}>
      {opt.emoji} {opt.value}
    </span>
  )
}

// Check icon for visited clients
export function VisitedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-medium">
      <CheckCircle2 className="h-3 w-3" /> Visitado
    </span>
  )
}
