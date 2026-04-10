'use client'

/**
 * CreateClientDialog
 *
 * Full client creation form inside a Dialog.
 * Features:
 * - DNI, nombre, teléfono, email, dirección, cumpleaños
 * - Referido por (requerido)
 * - Clasificación (rating S→E) con límite de crédito automático
 * - Selector de ubicación con mapa interactivo Google Maps (sub-modal)
 * - Subida de foto DNI y foto del cliente
 * - Usa la server action createClient existente
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  UserPlus, MapPin, Upload, X, Loader2, CreditCard,
  Camera, IdCard, Check, Navigation,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { createClient } from '@/actions/catalogs'
import {
  useLoadScript, GoogleMap, Marker, Autocomplete,
} from '@react-google-maps/api'

// ── Stable libraries array (must not be re-created on renders) ────────────────
const MAPS_LIBRARIES: ['places'] = ['places']
const TRUJILLO = { lat: -8.1116, lng: -79.0288 }

// ── Rating config (same as client-form.tsx) ───────────────────────────────────
const RATING_CONFIG = {
  S: { label: 'S — Especial',     range: 'S/ 5,000 a más',   credit: 5000, color: 'bg-purple-100 border-purple-400 text-purple-800',  symbol: '⭐' },
  A: { label: 'A — Excelente',    range: 'S/ 2,000 – 4,999', credit: 2500, color: 'bg-emerald-100 border-emerald-400 text-emerald-800', symbol: '🏆' },
  B: { label: 'B — Bueno',        range: 'S/ 1,001 – 2,000', credit: 1500, color: 'bg-blue-100 border-blue-400 text-blue-800',          symbol: '👍' },
  C: { label: 'C — Regular',      range: 'S/ 751 – 1,000',   credit: 875,  color: 'bg-yellow-100 border-yellow-400 text-yellow-800',    symbol: '🆗' },
  D: { label: 'D — Básico',       range: 'S/ 501 – 750',     credit: 625,  color: 'bg-orange-100 border-orange-400 text-orange-800',    symbol: '⚠️' },
  E: { label: 'E — Nuevo/Riesgo', range: 'S/ 100 – 500',     credit: 300,  color: 'bg-red-100 border-red-400 text-red-800',             symbol: '🔴' },
} as const
type RatingKey = keyof typeof RATING_CONFIG

// ── LocationData type ─────────────────────────────────────────────────────────
interface LocationData {
  lat: number
  lng: number
  address: string
  place_id: string
}

// ── LocationPickerModal ───────────────────────────────────────────────────────
interface LocationPickerProps {
  open: boolean
  onClose: () => void
  onConfirm: (data: LocationData) => void
  initial?: LocationData | null
}

function LocationPickerModal({ open, onClose, onConfirm, initial }: LocationPickerProps) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries: MAPS_LIBRARIES,
    preventGoogleFontsLoading: true,
  })

  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number }>(
    initial ? { lat: initial.lat, lng: initial.lng } : TRUJILLO
  )
  const [address, setAddress]   = useState(initial?.address ?? '')
  const [placeId, setPlaceId]   = useState(initial?.place_id ?? '')
  const [loadingGps, setLoadingGps] = useState(false)
  const [mapCenter, setMapCenter]   = useState<{ lat: number; lng: number }>(
    initial ? { lat: initial.lat, lng: initial.lng } : TRUJILLO
  )

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const geocoderRef     = useRef<google.maps.Geocoder | null>(null)

  // Reset when opening with new initial data
  useEffect(() => {
    if (open) {
      const pos = initial ? { lat: initial.lat, lng: initial.lng } : TRUJILLO
      setMarkerPos(pos)
      setMapCenter(pos)
      setAddress(initial?.address ?? '')
      setPlaceId(initial?.place_id ?? '')
    }
  }, [open, initial])

  const reverseGeocode = useCallback((pos: { lat: number; lng: number }) => {
    if (!window.google) return
    if (!geocoderRef.current) geocoderRef.current = new google.maps.Geocoder()
    geocoderRef.current.geocode({ location: pos }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        setAddress(results[0].formatted_address)
        setPlaceId(results[0].place_id)
      }
    })
  }, [])

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() }
    setMarkerPos(pos)
    reverseGeocode(pos)
  }, [reverseGeocode])

  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() }
    setMarkerPos(pos)
    reverseGeocode(pos)
  }, [reverseGeocode])

  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace()
    if (place?.geometry?.location) {
      const pos = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      }
      setMarkerPos(pos)
      setMapCenter(pos)
      setAddress(place.formatted_address ?? '')
      setPlaceId(place.place_id ?? '')
    }
  }, [])

  const captureGps = useCallback(() => {
    if (!navigator.geolocation) { toast.error('GPS no disponible'); return }
    setLoadingGps(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setMarkerPos(newPos)
        setMapCenter(newPos)
        reverseGeocode(newPos)
        setLoadingGps(false)
      },
      () => {
        setLoadingGps(false)
        toast.error('Error', 'No se pudo obtener la ubicación GPS')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [reverseGeocode])

  const handleConfirm = () => {
    onConfirm({ lat: markerPos.lat, lng: markerPos.lng, address, place_id: placeId })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-emerald-600" />
            Seleccionar ubicación del cliente
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pt-4 pb-5 space-y-3 max-h-[80vh] overflow-y-auto">
          {/* Search autocomplete */}
          {isLoaded ? (
            <Autocomplete
              onLoad={ref => (autocompleteRef.current = ref)}
              onPlaceChanged={handlePlaceChanged}
              options={{ componentRestrictions: { country: 'pe' }, fields: ['geometry', 'formatted_address', 'place_id'] }}
            >
              <input
                type="text"
                placeholder="🔍 Buscar dirección en Perú..."
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              />
            </Autocomplete>
          ) : (
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          )}

          {/* Map */}
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 260 }}>
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={15}
                onClick={handleMapClick}
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                  zoomControl: true,
                  clickableIcons: false,
                }}
              >
                <Marker
                  position={markerPos}
                  draggable
                  onDragEnd={handleMarkerDragEnd}
                />
              </GoogleMap>
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          {/* Detected address */}
          {address ? (
            <div className="flex items-start gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
              <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5">
                  Dirección detectada:
                </p>
                <p className="text-sm text-gray-800 leading-snug">{address}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-1">
              Haz clic en el mapa o arrastra el marcador para seleccionar
            </p>
          )}

          {/* GPS button */}
          <button
            type="button"
            onClick={captureGps}
            disabled={loadingGps}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loadingGps
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Navigation className="h-4 w-4 text-emerald-600" />
            }
            Usar mi ubicación
          </button>

          {/* Confirm button */}
          <Button
            type="button"
            onClick={handleConfirm}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg"
          >
            <Check className="h-4 w-4 mr-2" />
            Confirmar ubicación
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
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
  const [dni,            setDni]           = useState('')
  const [name,           setName]          = useState('')
  const [phone,          setPhone]         = useState('')
  const [email,          setEmail]         = useState('')
  const [address,        setAddress]       = useState('')
  const [birthday,       setBirthday]      = useState('')
  const [dniPhotoUrl,    setDniPhotoUrl]   = useState('')
  const [clientPhotoUrl, setClientPhotoUrl] = useState('')
  const [rating,         setRating]        = useState<RatingKey>('E')
  const [creditLimit,    setCreditLimit]   = useState(RATING_CONFIG.E.credit.toString())

  // Location picker state
  const [locationData,       setLocationData]       = useState<LocationData | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  // Referral state
  const [referredBy,        setReferredBy]        = useState<{ id: string; name: string; rating?: string } | null>(null)
  const [referredBySearch,  setReferredBySearch]  = useState('')
  const [referredByResults, setReferredByResults] = useState<Array<{ id: string; name: string; dni?: string; rating?: string }>>([])
  const [searchingReferrer, setSearchingReferrer] = useState(false)

  const [submitting,        setSubmitting]        = useState(false)
  const [uploadingDni,      setUploadingDni]      = useState(false)
  const [uploadingPhoto,    setUploadingPhoto]    = useState(false)

  const referrerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Referrer search ────────────────────────────────────────────────────
  const searchReferrer = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) { setReferredByResults([]); return }
    setSearchingReferrer(true)
    try {
      const { data } = await fetch(`/api/clients/search?q=${encodeURIComponent(query)}&limit=10`).then(r => r.json())
      setReferredByResults(data || [])
    } catch { setReferredByResults([]) }
    finally { setSearchingReferrer(false) }
  }, [])

  const handleReferrerSearch = (value: string) => {
    setReferredBySearch(value)
    if (referrerDebounceRef.current) clearTimeout(referrerDebounceRef.current)
    referrerDebounceRef.current = setTimeout(() => searchReferrer(value), 300)
  }

  const selectReferrer = (client: { id: string; name: string; dni?: string; rating?: string }) => {
    setReferredBy({ id: client.id, name: client.name, rating: client.rating })
    setReferredBySearch(client.name)
    setReferredByResults([])
    // Auto-suggest initial rating based on referrer
    if (client.rating === 'S' || client.rating === 'A' || client.rating === 'B') {
      setRating('D')
      setCreditLimit(RATING_CONFIG.D.credit.toString())
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Error', 'El nombre es obligatorio'); return }
    if (!dni.trim())  { toast.error('Error', 'El DNI es obligatorio'); return }
    if (!referredBy)  { toast.error('Error', 'Debes seleccionar quién refiere a este cliente'); return }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('dni',          dni.trim())
      fd.append('name',         name.trim())
      fd.append('referred_by',  referredBy.id)
      fd.append('rating',       rating)
      fd.append('credit_limit', creditLimit)
      fd.append('credit_used',  '0')
      fd.append('active',       'true')
      if (phone)          fd.append('phone',            phone.trim())
      if (email)          fd.append('email',            email.trim())
      if (address)        fd.append('address',          address.trim())
      if (birthday)       fd.append('birthday',         birthday)
      if (dniPhotoUrl)    fd.append('dni_photo_url',    dniPhotoUrl)
      if (clientPhotoUrl) fd.append('client_photo_url', clientPhotoUrl)
      if (locationData) {
        fd.append('lat', locationData.lat.toString())
        fd.append('lng', locationData.lng.toString())
        // Auto-fill address if not entered
        if (!address && locationData.address) {
          fd.set('address', locationData.address)
        }
      }

      const result = await createClient(fd)
      if (!result.success) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Error al crear cliente')
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
    setBirthday(''); setDniPhotoUrl(''); setClientPhotoUrl('')
    setRating('E'); setCreditLimit(RATING_CONFIG.E.credit.toString())
    setLocationData(null); setShowLocationPicker(false)
    setReferredBy(null); setReferredBySearch(''); setReferredByResults([])
  }

  return (
    <>
      {/* Location picker sub-modal */}
      <LocationPickerModal
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={(data) => {
          setLocationData(data)
          if (!address) setAddress(data.address)
        }}
        initial={locationData}
      />

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

            {/* ── Identidad ─────────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Identidad</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">DNI *</Label>
                  <Input value={dni} onChange={e => setDni(e.target.value)} placeholder="Ej: 12345678" maxLength={15} required className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nombre completo *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del cliente" required className="h-9 text-sm" />
                </div>
              </div>
            </section>

            {/* ── Referido por ──────────────────────────────────────── */}
            <section className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Referido por *</p>
              <div className="relative">
                <Input
                  value={referredBySearch}
                  onChange={e => handleReferrerSearch(e.target.value)}
                  placeholder="Escribe el nombre del cliente que refiere..."
                  className={`h-9 text-sm ${referredBy ? 'border-emerald-500' : ''}`}
                />
                {searchingReferrer && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {referredBy && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </div>

              {referredByResults.length > 0 && !referredBy && (
                <div className="relative z-50 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {referredByResults.map(client => (
                    <button key={client.id} type="button" onClick={() => selectReferrer(client)}
                      className="w-full px-3 py-2 text-left hover:bg-muted transition-colors text-sm border-b last:border-b-0"
                    >
                      <div className="font-medium">{client.name}</div>
                      {client.dni && <div className="text-xs text-muted-foreground">DNI: {client.dni}</div>}
                    </button>
                  ))}
                </div>
              )}

              {referredBy && (
                <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-emerald-900 font-medium">{referredBy.name}</span>
                  {referredBy.rating && (
                    <span className={[
                      'text-xs font-bold px-1.5 py-0.5 rounded',
                      referredBy.rating === 'S' ? 'bg-purple-100 text-purple-800' :
                      referredBy.rating === 'A' ? 'bg-emerald-100 text-emerald-800' :
                      referredBy.rating === 'B' ? 'bg-blue-100 text-blue-800' :
                      referredBy.rating === 'C' ? 'bg-yellow-100 text-yellow-800' :
                      referredBy.rating === 'D' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    ].join(' ')}>Clase {referredBy.rating}</span>
                  )}
                  <button type="button" onClick={() => { setReferredBy(null); setReferredBySearch('') }} className="ml-auto text-emerald-600 hover:text-emerald-800">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                💡 Solo se pueden crear clientes cuando son referidos por un cliente existente
              </p>
            </section>

            {/* ── Contacto ──────────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contacto</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Teléfono</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="987654321" type="tel" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" type="email" className="h-9 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dirección</Label>
                <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Dirección completa" rows={2} className="text-sm resize-none" />
              </div>
            </section>

            {/* ── Ubicación del cliente (nuevo diseño) ──────────────── */}
            <section className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Ubicación del cliente <span className="normal-case font-normal text-muted-foreground/60">(opcional)</span>
              </p>

              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Ubicación del cliente</p>
                  {locationData ? (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-gray-700 leading-snug">{locationData.address}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-gray-300" />
                      No se ha seleccionado ubicación
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowLocationPicker(true)}
                  className="shrink-0 h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {locationData ? 'Cambiar' : 'Seleccionar ubicación'}
                </Button>
              </div>

              {locationData && (
                <button
                  type="button"
                  onClick={() => setLocationData(null)}
                  className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                >
                  <X className="h-3 w-3" /> Eliminar ubicación
                </button>
              )}
            </section>

            {/* ── Clasificación del cliente ──────────────────────────── */}
            <section className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Clasificación</p>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(Object.keys(RATING_CONFIG) as RatingKey[]).map(key => {
                  const cfg = RATING_CONFIG[key]
                  const isSelected = rating === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setRating(key); setCreditLimit(cfg.credit.toString()) }}
                      className={[
                        'rounded-lg border-2 p-2.5 text-center transition-all flex flex-col items-center gap-1',
                        isSelected
                          ? cfg.color + ' border-current shadow-sm scale-105'
                          : 'border-gray-200 hover:border-gray-400 bg-white',
                      ].join(' ')}
                    >
                      <span className="text-lg leading-none">{cfg.symbol}</span>
                      <span className="font-bold text-sm leading-none">{key}</span>
                      <span className="text-[9px] leading-tight text-center opacity-70 hidden sm:block">{cfg.range}</span>
                    </button>
                  )
                })}
              </div>

              <div className={['rounded-lg border p-3 text-sm', RATING_CONFIG[rating].color].join(' ')}>
                <div className="font-semibold">{RATING_CONFIG[rating].label}</div>
                <div className="text-xs mt-0.5">
                  Rango de crédito: <strong>{RATING_CONFIG[rating].range}</strong>
                  {' · '}Límite automático: <strong>S/ {RATING_CONFIG[rating].credit.toLocaleString()}</strong>
                </div>
                {referredBy?.rating && (
                  <div className="text-xs mt-1 opacity-80">
                    💡 Referido por clase {referredBy.rating}
                    {(referredBy.rating === 'S' || referredBy.rating === 'A' || referredBy.rating === 'B')
                      ? ' → inicia en clase D (S/ 625 crédito)'
                      : ' → clasificación sugerida según referidor'}
                  </div>
                )}
              </div>
            </section>

            {/* ── Crédito y nacimiento ───────────────────────────────── */}
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
                  <Input value={birthday} onChange={e => setBirthday(e.target.value)} type="date" className="h-9 text-sm" />
                </div>
              </div>
            </section>

            {/* ── Fotos ─────────────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Fotos</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PhotoUploadField
                  label="Foto DNI"
                  icon={IdCard}
                  value={dniPhotoUrl}
                  uploading={uploadingDni}
                  onChange={url => setDniPhotoUrl(url)}
                  onRemove={() => setDniPhotoUrl('')}
                />
                <PhotoUploadField
                  label="Foto del cliente"
                  icon={Camera}
                  value={clientPhotoUrl}
                  uploading={uploadingPhoto}
                  onChange={url => setClientPhotoUrl(url)}
                  onRemove={() => setClientPhotoUrl('')}
                />
              </div>
            </section>

            {/* ── Actions ───────────────────────────────────────────── */}
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
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
    </>
  )
}
