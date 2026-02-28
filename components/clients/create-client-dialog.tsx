'use client'

/**
 * CreateClientDialog
 *
 * Full client creation form inside a Dialog.
 * Features:
 * - All DB fields: DNI, nombre, teléfono, email, dirección, crédito, cumpleaños
 * - Google Maps URL → auto-extrae latitud y longitud
 * - Botón "Capturar ubicación" (browser geolocation)
 * - Subida de foto DNI (opcional)
 * - Subida de foto del cliente (opcional)
 * - Usa la server action createClient existente
 */

import React, { useState, useRef, useCallback } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  UserPlus, MapPin, Upload, X, Loader2, Link2, CreditCard,
  Camera, IdCard, Check,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { createClient } from '@/actions/catalogs'

// ── Google Maps URL parser ────────────────────────────────────────────────────

async function parseGoogleMapsUrl(url: string): Promise<{ lat: number; lng: number } | null> {
  if (!url) return null
  
  let processedUrl = url
  
  // If it's a shortened link, expand it first
  if (url.includes('maps.app.goo.gl') || url.includes('goo.gl')) {
    try {
      const response = await fetch('/api/expand-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.expandedUrl) {
          processedUrl = data.expandedUrl
        }
      }
    } catch (error) {
      console.error('Error expanding shortened URL:', error)
      // Continue with original URL
    }
  }
  
  // Try multiple patterns to extract coordinates
  const patterns = [
    /@(-?\d+\.?\d+),(-?\d+\.?\d+)/,  // @lat,lng
    /[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/,  // ?q=lat,lng
    /ll=(-?\d+\.?\d+),(-?\d+\.?\d+)/,  // ll=lat,lng
    /!3d(-?\d+\.?\d+)!4d(-?\d+\.?\d+)/, // !3dlat!4dlng (Google Maps format)
    /\/(-?\d+\.?\d+),(-?\d+\.?\d+)(?:,|\/|$)/, // /lat,lng
  ]
  
  for (const pattern of patterns) {
    const match = processedUrl.match(pattern)
    if (match) {
      const lat = parseFloat(match[1])
      const lng = parseFloat(match[2])
      // Validate coordinate ranges
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng }
      }
    }
  }
  
  return null
}

// ── Photo upload helper ───────────────────────────────────────────────────────

async function uploadClientPhoto(file: File, type: 'dni' | 'photo'): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('type', type)
  const res  = await fetch('/api/upload/client-photo', { method: 'POST', body: fd })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Error al subir imagen')
  return json.data.public_url as string
}

// ── PhotoUploadField ──────────────────────────────────────────────────────────

function PhotoUploadField({
  label,
  icon: Icon,
  value,
  uploading,
  onChange,
  onRemove,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  value: string
  uploading: boolean
  onChange: (url: string) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label} <span className="text-muted-foreground">(opcional)</span></Label>
      {value ? (
        <div className="relative w-full h-24 rounded-lg overflow-hidden border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
          >
            <X className="h-3 w-3" />
          </button>
          <div className="absolute bottom-1 left-1 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <Check className="h-2.5 w-2.5" /> Subida
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-16 rounded-lg border border-dashed border-border flex items-center justify-center gap-2 text-muted-foreground hover:bg-muted/50 transition-colors text-xs disabled:opacity-50"
        >
          {uploading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</>
            : <><Icon className="h-4 w-4" /><span>Subir {label}</span><Upload className="h-3 w-3" /></>
          }
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0]
          if (!f) return
          try {
            const url = await uploadClientPhoto(f, label.toLowerCase().includes('dni') ? 'dni' : 'photo')
            onChange(url)
          } catch (err: any) {
            toast.error('Error', err.message)
          }
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface CreateClientDialogProps {
  trigger?: React.ReactNode
  onSuccess?: (client: { id: string; name: string; dni?: string | null; credit_limit: number; credit_used: number }) => void
}

export function CreateClientDialog({ trigger, onSuccess }: CreateClientDialogProps) {
  const [open, setOpen] = useState(false)

  // Form state
  const [dni,           setDni]           = useState('')
  const [name,          setName]          = useState('')
  const [phone,         setPhone]         = useState('')
  const [email,         setEmail]         = useState('')
  const [address,       setAddress]       = useState('')
  const [lat,           setLat]           = useState<string>('')
  const [lng,           setLng]           = useState<string>('')
  const [mapsUrl,       setMapsUrl]       = useState('')
  const [creditLimit,   setCreditLimit]   = useState('0')
  const [birthday,      setBirthday]      = useState('')
  const [dniPhotoUrl,   setDniPhotoUrl]   = useState('')
  const [clientPhotoUrl, setClientPhotoUrl] = useState('')

  const [submitting,        setSubmitting]        = useState(false)
  const [capturingLocation, setCapturingLocation] = useState(false)
  const [uploadingDni,      setUploadingDni]      = useState(false)
  const [uploadingPhoto,    setUploadingPhoto]    = useState(false)
  const [mapsError,         setMapsError]         = useState('')
  const [extractingCoords,  setExtractingCoords]  = useState(false)

  const mapsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Google Maps URL extraction ──────────────────────────────────────────
  const extractCoords = useCallback(async (url: string) => {
    if (!url.trim()) return
    setExtractingCoords(true)
    setMapsError('')
    const coords = await parseGoogleMapsUrl(url)
    setExtractingCoords(false)
    if (coords) {
      setLat(coords.lat.toString())
      setLng(coords.lng.toString())
      setMapsError('')
      toast.success('Coordenadas extraídas', `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`)
    } else {
      setMapsError('No se pudieron extraer coordenadas. Verifica el link o ingrésalas manualmente.')
      toast.error('Error', 'No se pudieron extraer las coordenadas del link.')
    }
  }, [])

  const handleMapsUrl = async (url: string) => {
    setMapsUrl(url)
    setMapsError('')
    if (!url.trim()) return
    await extractCoords(url)
  }

  // ── Browser geolocation ─────────────────────────────────────────────────
  const captureLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Error', 'Geolocalización no disponible en este navegador')
      return
    }
    setCapturingLocation(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude.toString())
        setLng(pos.coords.longitude.toString())
        setCapturingLocation(false)
        toast.success('Ubicación capturada')
      },
      () => {
        setCapturingLocation(false)
        toast.error('Error', 'No se pudo obtener la ubicación')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // ── Photo uploads ───────────────────────────────────────────────────────
  const handleDniPhotoChange = async (url: string) => setDniPhotoUrl(url)
  const handleClientPhotoChange = async (url: string) => setClientPhotoUrl(url)

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Error', 'El nombre es obligatorio'); return }
    if (!dni.trim())  { toast.error('Error', 'El DNI es obligatorio'); return }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('dni',  dni.trim())
      fd.append('name', name.trim())
      if (phone)   fd.append('phone',   phone.trim())
      if (email)   fd.append('email',   email.trim())
      if (address) fd.append('address', address.trim())
      if (lat)     fd.append('lat',     lat)
      if (lng)     fd.append('lng',     lng)
      fd.append('credit_limit', creditLimit || '0')
      fd.append('credit_used',  '0')
      if (birthday)      fd.append('birthday',          birthday)
      if (dniPhotoUrl)   fd.append('dni_photo_url',     dniPhotoUrl)
      if (clientPhotoUrl) fd.append('client_photo_url', clientPhotoUrl)
      fd.append('active', 'true')

      const result = await createClient(fd)

      if (!result.success) {
        throw new Error(
          typeof result.error === 'string' ? result.error : 'Error al crear cliente'
        )
      }

      toast.success('Cliente creado correctamente')
      const d = result.data as any
      onSuccess?.({
        id:           d.id,
        name:         d.name,
        dni:          d.dni ?? null,
        credit_limit: d.credit_limit ?? 0,
        credit_used:  d.credit_used  ?? 0,
      })
      setOpen(false)
      resetForm()
    } catch (err: any) {
      toast.error('Error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setDni(''); setName(''); setPhone(''); setEmail(''); setAddress('')
    setLat(''); setLng(''); setMapsUrl(''); setCreditLimit('0')
    setBirthday(''); setDniPhotoUrl(''); setClientPhotoUrl(''); setMapsError('')
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Nuevo Cliente
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-5 w-5" />
            Crear nuevo cliente
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">

          {/* ── Identidad ─────────────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Identidad</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">DNI *</Label>
                <Input
                  value={dni}
                  onChange={e => setDni(e.target.value)}
                  placeholder="Ej: 12345678"
                  maxLength={15}
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nombre completo *</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nombre del cliente"
                  required
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </section>

          {/* ── Contacto ──────────────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contacto</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="987654321"
                  type="tel"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  type="email"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dirección</Label>
              <Textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Dirección completa"
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </section>

          {/* ── Geolocalización ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Geolocalización <span className="normal-case font-normal text-muted-foreground/60">(opcional)</span>
            </p>

            {/* Google Maps URL */}
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Link de Google Maps
              </Label>
              <div className="flex gap-2">
                <Input
                  value={mapsUrl}
                  onChange={e => {
                    const val = e.target.value
                    setMapsUrl(val)
                    setMapsError('')
                    if (mapsDebounceRef.current) clearTimeout(mapsDebounceRef.current)
                    if (val.includes('google.com/maps') || val.includes('goo.gl') || val.includes('maps.app')) {
                      mapsDebounceRef.current = setTimeout(() => extractCoords(val), 800)
                    }
                  }}
                  onPaste={async (e) => {
                    const pastedText = e.clipboardData.getData('text')
                    if (pastedText.includes('google.com/maps') || pastedText.includes('goo.gl') || pastedText.includes('maps.app')) {
                      if (mapsDebounceRef.current) clearTimeout(mapsDebounceRef.current)
                      // Small delay so the input value is set first
                      setTimeout(() => handleMapsUrl(pastedText), 0)
                    }
                  }}
                  placeholder="https://maps.app.goo.gl/... o maps.google.com/..."
                  className={`h-9 text-sm flex-1 ${mapsError ? 'border-destructive' : ''}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => mapsUrl.trim() && extractCoords(mapsUrl)}
                  disabled={!mapsUrl.trim() || extractingCoords}
                  className="h-9 px-2 shrink-0"
                  title="Extraer coordenadas"
                >
                  {extractingCoords
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <MapPin className="h-3.5 w-3.5" />
                  }
                </Button>
                {lat && lng && !extractingCoords && (
                  <div className="flex items-center gap-1 text-emerald-600 text-xs whitespace-nowrap">
                    <Check className="h-3.5 w-3.5" /> OK
                  </div>
                )}
              </div>
              {mapsError && <p className="text-[10px] text-destructive">{mapsError}</p>}
              {lat && lng && (
                <p className="text-[10px] text-muted-foreground">
                  Lat: {parseFloat(lat).toFixed(6)} · Lng: {parseFloat(lng).toFixed(6)}
                </p>
              )}
            </div>

            {/* Manual coords + capture button */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Latitud</Label>
                <Input
                  value={lat}
                  onChange={e => setLat(e.target.value)}
                  placeholder="-12.0464"
                  type="number"
                  step="0.000001"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Longitud</Label>
                <Input
                  value={lng}
                  onChange={e => setLng(e.target.value)}
                  placeholder="-77.0428"
                  type="number"
                  step="0.000001"
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={captureLocation}
                  disabled={capturingLocation}
                  className="w-full h-8 gap-1 text-xs"
                >
                  {capturingLocation
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <MapPin className="h-3.5 w-3.5" />
                  }
                  GPS
                </Button>
              </div>
            </div>
          </section>

          {/* ── Crédito y nacimiento ──────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Crédito</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Límite de crédito (S/)
                </Label>
                <Input
                  value={creditLimit}
                  onChange={e => setCreditLimit(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha de nacimiento</Label>
                <Input
                  value={birthday}
                  onChange={e => setBirthday(e.target.value)}
                  type="date"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </section>

          {/* ── Fotos ─────────────────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Fotos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PhotoUploadField
                label="Foto DNI"
                icon={IdCard}
                value={dniPhotoUrl}
                uploading={uploadingDni}
                onChange={handleDniPhotoChange}
                onRemove={() => setDniPhotoUrl('')}
              />
              <PhotoUploadField
                label="Foto del cliente"
                icon={Camera}
                value={clientPhotoUrl}
                uploading={uploadingPhoto}
                onChange={handleClientPhotoChange}
                onRemove={() => setClientPhotoUrl('')}
              />
            </div>
          </section>

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
                : <><UserPlus className="h-4 w-4" /> Crear cliente</>
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
