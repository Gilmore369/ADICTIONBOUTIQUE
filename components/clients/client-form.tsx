/**
 * ClientForm Component
 * 
 * A form component for creating and editing clients using React Hook Form + Zod validation.
 * Includes geolocation capture using browser Geolocation API.
 * 
 * Features:
 * - React Hook Form integration with Zod schema validation
 * - Inline validation error display
 * - All client fields: dni, name, phone, email, address, lat, lng, credit_limit,
 *   credit_used, dni_photo_url, client_photo_url, birthday, active
 * - Browser geolocation capture with button
 * - Loading state during submission
 * - Success/error feedback
 * 
 * Design Tokens:
 * - Spacing: 16px (gap between form fields)
 * - Border radius: 8px (standard)
 * - Button height: 36px
 * 
 * Requirements: 14.1
 * Task: 9.4 Create client UI components
 * 
 * @example
 * ```tsx
 * <ClientForm
 *   mode="create"
 *   onSuccess={(client) => console.log('Created:', client)}
 *   onCancel={() => console.log('Cancelled')}
 * />
 * 
 * <ClientForm
 *   mode="edit"
 *   initialData={existingClient}
 *   onSuccess={(client) => console.log('Updated:', client)}
 *   onCancel={() => console.log('Cancelled')}
 * />
 * ```
 */

'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { clientSchema } from '@/lib/validations/catalogs'
import { createClient, updateClient } from '@/actions/catalogs'
import { toast } from '@/lib/toast'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { MapPin, AlertTriangle } from 'lucide-react'

// Configuración de ratings con rangos de crédito
const RATING_CONFIG = {
  S: { label: 'S — Especial',    range: 'S/ 5,000 a más',   credit: 5000, color: 'bg-purple-100 border-purple-400 text-purple-800', dot: 'bg-purple-500', symbol: '⭐' },
  A: { label: 'A — Excelente',   range: 'S/ 2,000 – 4,999', credit: 2500, color: 'bg-emerald-100 border-emerald-400 text-emerald-800', dot: 'bg-emerald-500', symbol: '🏆' },
  B: { label: 'B — Bueno',       range: 'S/ 1,001 – 2,000', credit: 1500, color: 'bg-blue-100 border-blue-400 text-blue-800', dot: 'bg-blue-500', symbol: '👍' },
  C: { label: 'C — Regular',     range: 'S/ 751 – 1,000',   credit: 875,  color: 'bg-yellow-100 border-yellow-400 text-yellow-800', dot: 'bg-yellow-500', symbol: '🆗' },
  D: { label: 'D — Básico',      range: 'S/ 501 – 750',     credit: 625,  color: 'bg-orange-100 border-orange-400 text-orange-800', dot: 'bg-orange-500', symbol: '⚠️' },
  E: { label: 'E — Nuevo/Riesgo', range: 'S/ 100 – 500',    credit: 300,  color: 'bg-red-100 border-red-400 text-red-800', dot: 'bg-red-500', symbol: '🔴' },
} as const

type RatingKey = keyof typeof RATING_CONFIG

// Type for form data based on clientSchema
type ClientFormData = z.infer<typeof clientSchema>

interface ClientFormProps {
  mode: 'create' | 'edit'
  initialData?: Partial<ClientFormData> & { id?: string }
  onSuccess?: (client: any) => void
  onCancel?: () => void
}

export function ClientForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
}: ClientFormProps) {
  const [loading, setLoading] = useState(false)
  const [capturingLocation, setCapturingLocation] = useState(false)
  const [selectedRating, setSelectedRating] = useState<RatingKey>(
    (initialData as any)?.rating as RatingKey || 'E'
  )
  const [referredBy, setReferredBy] = useState<{ id: string; name: string; rating?: string } | null>(null)
  const [referredBySearch, setReferredBySearch] = useState('')
  const [referredByResults, setReferredByResults] = useState<Array<{ id: string; name: string; dni?: string; rating?: string }>>([])
  const [searchingReferrer, setSearchingReferrer] = useState(false)

  // Initialize form with React Hook Form + Zod validation
  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      dni: initialData?.dni || '',
      name: initialData?.name || '',
      referred_by: initialData?.referred_by,
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      address: initialData?.address || '',
      lat: initialData?.lat,
      lng: initialData?.lng,
      credit_limit: initialData?.credit_limit || 0,
      credit_used: initialData?.credit_used || 0,
      dni_photo_url: initialData?.dni_photo_url || '',
      client_photo_url: initialData?.client_photo_url || '',
      birthday: initialData?.birthday || '',
      active: initialData?.active ?? true,
    },
  })

  // Search for referrer clients
  const searchReferrer = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setReferredByResults([])
      return
    }
    
    setSearchingReferrer(true)
    try {
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(query)}&limit=10`)
      const { data } = await response.json()
      setReferredByResults(data || [])
    } catch (error) {
      console.error('Error searching referrer:', error)
      setReferredByResults([])
    } finally {
      setSearchingReferrer(false)
    }
  }

  const selectReferrer = (client: { id: string; name: string; dni?: string; rating?: string }) => {
    setReferredBy({ id: client.id, name: client.name, rating: client.rating })
    setReferredBySearch(client.name)
    setReferredByResults([])
    form.setValue('referred_by', client.id)
    // Auto-suggest initial rating based on referrer's rating
    if (mode === 'create') {
      const suggestedRating: RatingKey = (client.rating === 'S' || client.rating === 'A' || client.rating === 'B') ? 'D' : 'E'
      setSelectedRating(suggestedRating)
      form.setValue('rating', suggestedRating)
      form.setValue('credit_limit', RATING_CONFIG[suggestedRating].credit)
    }
  }

  // Capture geolocation using browser Geolocation API
  const captureGeolocation = () => {
    if (!navigator.geolocation) {
      toast.error('Error', 'Geolocalización no disponible en este navegador')
      return
    }

    setCapturingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        form.setValue('lat', latitude)
        form.setValue('lng', longitude)
        toast.success('Éxito', 'Ubicación capturada correctamente')
        setCapturingLocation(false)
      },
      (error) => {
        console.error('Geolocation error:', error)
        toast.error('Error', 'No se pudo obtener la ubicación. Verifica los permisos.')
        setCapturingLocation(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  // Extract coordinates from Google Maps link
  const extractCoordinatesFromLink = async (link: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      console.log('[extractCoordinatesFromLink] Original link:', link)
      
      // Try to expand URL and extract coordinates using API
      try {
        console.log('[extractCoordinatesFromLink] Calling expand-url API...')
        const response = await fetch('/api/expand-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: link })
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log('[extractCoordinatesFromLink] API response:', data)
          
          // If API returned coordinates directly from HTML
          if (data.success && data.coordinates) {
            console.log('[extractCoordinatesFromLink] Coordinates extracted from HTML:', data.coordinates)
            return data.coordinates
          }
          
          // If API returned expanded URL, use it for pattern matching
          if (data.success && data.expandedUrl && data.expandedUrl !== link) {
            link = data.expandedUrl
            console.log('[extractCoordinatesFromLink] Using expanded URL:', link)
          }
        } else {
          console.error('[extractCoordinatesFromLink] API error:', response.status)
        }
      } catch (error) {
        console.error('[extractCoordinatesFromLink] API call failed:', error)
        // Continue with pattern matching on original link
      }

      // Try to find coordinates in the URL using regex patterns
      const patterns = [
        /\/search\/(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/, // /search/lat,+lng or /search/lat, lng
        /@(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/,  // @lat,lng or @lat,+lng
        /q=(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/,  // q=lat,lng
        /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/, // !3dlat!4dlng (Google Maps format)
        /ll=(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/, // ll=lat,lng
        /center=(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/, // center=lat,lng
        /!2d(-?\d+\.?\d*)!3d(-?\d+\.?\d*)/, // !2dlng!3dlat (inverted order)
        /place\/[^\/]+\/@(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/, // place/name/@lat,lng
      ]

      for (const pattern of patterns) {
        const match = link.match(pattern)
        if (match) {
          console.log('[extractCoordinatesFromLink] Pattern matched:', pattern, 'Result:', match)
          const lat = parseFloat(match[1])
          const lng = parseFloat(match[2])
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            console.log('[extractCoordinatesFromLink] Valid coordinates found:', { lat, lng })
            return { lat, lng }
          }
        }
      }

      console.warn('[extractCoordinatesFromLink] No coordinates found in link')
      return null
    } catch (error) {
      console.error('[extractCoordinatesFromLink] Error extracting coordinates:', error)
      return null
    }
  }

  // Handle paste event on Google Maps link field
  const handleMapsLinkPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')
    
    // Check if it's a Google Maps link
    if (pastedText.includes('google.com/maps') || pastedText.includes('maps.app.goo.gl') || pastedText.includes('goo.gl')) {
      console.log('[handleMapsLinkPaste] Processing Google Maps link:', pastedText)
      toast.info('Procesando', 'Extrayendo coordenadas del link...')
      
      const coords = await extractCoordinatesFromLink(pastedText)
      if (coords) {
        form.setValue('lat', coords.lat)
        form.setValue('lng', coords.lng)
        toast.success('Éxito', `Coordenadas extraídas: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`)
        console.log('[handleMapsLinkPaste] Coordinates extracted successfully:', coords)
      } else {
        console.warn('[handleMapsLinkPaste] Failed to extract coordinates from link')
        toast.error('Error', 'No se pudieron extraer las coordenadas del link. Por favor, usa el botón GPS o ingresa las coordenadas manualmente.')
      }
    }
  }

  // Handle form submission
  const onSubmit = async (data: ClientFormData) => {
    // Validate referrer in create mode
    if (mode === 'create' && !data.referred_by) {
      toast.error('Error', 'Debes seleccionar quién refiere a este cliente')
      return
    }

    setLoading(true)
    try {
      // Convert data to FormData for server action
      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          formData.append(key, String(value))
        }
      })
      // rating is managed via local state (not a registered FormField) — append explicitly
      formData.set('rating', selectedRating)

      const result = mode === 'create' 
        ? await createClient(formData)
        : await updateClient(initialData?.id!, formData)

      if (!result.success) {
        throw new Error(
          typeof result.error === 'string' 
            ? result.error 
            : 'Error saving client'
        )
      }

      toast.success('Éxito', mode === 'create' ? 'Cliente creado' : 'Cliente actualizado')
      onSuccess?.(result.data)
    } catch (error) {
      console.error('Error submitting form:', error)
      toast.error(
        'Error',
        error instanceof Error ? error.message : 'Error al guardar el cliente'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Grid layout for form fields - 2 columns on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* DNI */}
          <FormField
            control={form.control}
            name="dni"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DNI *</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: 12345678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre Completo *</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre del cliente" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Referido por - Only show in create mode */}
        {mode === 'create' && (
          <div className="space-y-2">
            <FormLabel>Referido por *</FormLabel>
            <div className="relative">
              <Input
                value={referredBySearch}
                onChange={(e) => {
                  setReferredBySearch(e.target.value)
                  searchReferrer(e.target.value)
                }}
                placeholder="Buscar cliente que refiere..."
                className={referredBy ? 'border-green-500' : ''}
              />
              {searchingReferrer && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                </div>
              )}
              
              {/* Search Results Dropdown */}
              {referredByResults.length > 0 && !referredBy && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {referredByResults.map(client => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => selectReferrer(client)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors text-sm border-b last:border-b-0"
                    >
                      <div className="font-medium">{client.name}</div>
                      {client.dni && (
                        <div className="text-xs text-gray-500">DNI: {client.dni}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {referredBy && (
                <div className="flex items-center gap-2 p-2 mt-2 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-sm text-green-900 font-medium">{referredBy.name}</span>
                  {referredBy.rating && (
                    <span className={[
                      'text-xs font-bold px-1.5 py-0.5 rounded',
                      referredBy.rating === 'S' ? 'bg-purple-100 text-purple-800' :
                      referredBy.rating === 'A' ? 'bg-emerald-100 text-emerald-800' :
                      referredBy.rating === 'B' ? 'bg-blue-100 text-blue-800' :
                      referredBy.rating === 'C' ? 'bg-yellow-100 text-yellow-800' :
                      referredBy.rating === 'D' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    ].join(' ')}>
                      Clase {referredBy.rating}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setReferredBy(null)
                      setReferredBySearch('')
                      form.setValue('referred_by', undefined)
                      if (mode === 'create') {
                        setSelectedRating('E')
                        form.setValue('rating', 'E')
                        form.setValue('credit_limit', RATING_CONFIG.E.credit)
                      }
                    }}
                    className="ml-auto text-green-600 hover:text-green-800"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              💡 Solo se pueden crear clientes cuando son referidos por un cliente existente
            </p>
          </div>
        )}

        {/* Contact information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Phone */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input 
                    type="tel" 
                    placeholder="Ej: 987654321" 
                    {...field} 
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input 
                    type="email" 
                    placeholder="ejemplo@correo.com" 
                    {...field} 
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Address - Full width */}
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Dirección completa del cliente" 
                  {...field} 
                  value={field.value || ''}
                  rows={2}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Geolocation */}
        <div className="space-y-2">
          <FormLabel>Geolocalización (opcional)</FormLabel>
          
          {/* Google Maps Link Input */}
          <div className="mb-3">
            <Label className="text-xs mb-1.5">🔗 Link de Google Maps</Label>
            <Input
              type="url"
              placeholder="Pega aquí el link de Google Maps (ej: https://maps.app.goo.gl/...)"
              onPaste={handleMapsLinkPaste}
              className="h-8 text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              💡 Pega un link de Google Maps (incluso acortados) para extraer las coordenadas automáticamente
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Latitude */}
            <FormField
              control={form.control}
              name="lat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Latitud</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
                      placeholder="-12.0464"
                      {...field}
                      value={field.value !== undefined && field.value !== null ? field.value : ''}
                      onChange={(e) => {
                        const val = e.target.value
                        field.onChange(val === '' ? undefined : parseFloat(val))
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Longitude */}
            <FormField
              control={form.control}
              name="lng"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Longitud</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
                      placeholder="-77.0428"
                      {...field}
                      value={field.value !== undefined && field.value !== null ? field.value : ''}
                      onChange={(e) => {
                        const val = e.target.value
                        field.onChange(val === '' ? undefined : parseFloat(val))
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Capture Location Button */}
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={captureGeolocation}
                disabled={capturingLocation}
                className="w-full"
              >
                <MapPin className="h-4 w-4 mr-2" />
                {capturingLocation ? 'Capturando...' : 'GPS'}
              </Button>
            </div>
          </div>
        </div>

        {/* Credit information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Credit Limit */}
          <FormField
            control={form.control}
            name="credit_limit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Límite de Crédito</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Credit Used (read-only in create mode) */}
          <FormField
            control={form.control}
            name="credit_used"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Crédito Usado</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    disabled={mode === 'create'}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Rating / Clasificación del cliente */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Clasificación del Cliente
            </Label>
            {(initialData as any)?.blacklisted && (
              <Badge className="bg-red-600 text-white gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" />
                En lista negra
              </Badge>
            )}
          </div>

          {/* Selector visual de rating */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(Object.keys(RATING_CONFIG) as RatingKey[]).map((key) => {
              const cfg = RATING_CONFIG[key]
              const isSelected = selectedRating === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedRating(key)
                    form.setValue('rating', key)
                    form.setValue('credit_limit', cfg.credit)
                  }}
                  className={[
                    'rounded-lg border-2 p-2.5 text-center transition-all flex flex-col items-center gap-1',
                    isSelected ? cfg.color + ' border-current shadow-sm scale-105' : 'border-gray-200 hover:border-gray-400 bg-white',
                  ].join(' ')}
                >
                  <span className="text-lg leading-none">{cfg.symbol}</span>
                  <span className="font-bold text-sm leading-none">{key}</span>
                  <span className="text-[9px] leading-tight text-center opacity-70 hidden sm:block">{cfg.range}</span>
                </button>
              )
            })}
          </div>

          {/* Info del rating seleccionado */}
          {selectedRating && (
            <div className={['rounded-lg border p-3 text-sm', RATING_CONFIG[selectedRating].color].join(' ')}>
              <div className="font-semibold">{RATING_CONFIG[selectedRating].label}</div>
              <div className="text-xs mt-0.5">
                Rango de crédito: <strong>{RATING_CONFIG[selectedRating].range}</strong>
                {' · '}Límite automático: <strong>S/ {RATING_CONFIG[selectedRating].credit.toLocaleString()}</strong>
              </div>
              {mode === 'create' && (
                <div className="text-xs mt-1 opacity-80">
                  💡 {referredBy?.rating === 'S' || referredBy?.rating === 'A' || referredBy?.rating === 'B'
                    ? `Referido por clase ${referredBy.rating} → inicia en clase D (S/ 625 crédito)`
                    : 'Si el referidor es clase S, A o B, el cliente iniciará en clase D automáticamente.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Photo URLs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* DNI Photo URL */}
          <FormField
            control={form.control}
            name="dni_photo_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL Foto DNI</FormLabel>
                <FormControl>
                  <Input 
                    type="url" 
                    placeholder="https://ejemplo.com/dni.jpg" 
                    {...field} 
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Client Photo URL */}
          <FormField
            control={form.control}
            name="client_photo_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL Foto Cliente</FormLabel>
                <FormControl>
                  <Input 
                    type="url" 
                    placeholder="https://ejemplo.com/cliente.jpg" 
                    {...field} 
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Birthday */}
        <FormField
          control={form.control}
          name="birthday"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de Nacimiento</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Active checkbox */}
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </FormControl>
              <FormLabel className="!mt-0">Cliente activo</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Form actions - Button height: 36px per design tokens */}
        <div className="flex justify-end gap-3 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : mode === 'create' ? 'Crear Cliente' : 'Actualizar Cliente'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
