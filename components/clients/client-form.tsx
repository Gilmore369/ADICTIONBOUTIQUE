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
import { MapPin } from 'lucide-react'

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

  // Initialize form with React Hook Form + Zod validation
  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      dni: initialData?.dni || '',
      name: initialData?.name || '',
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
      // Pattern 1: https://maps.app.goo.gl/... (shortened link - needs expansion)
      if (link.includes('maps.app.goo.gl') || link.includes('goo.gl')) {
        try {
          // Expand the shortened URL using the API endpoint
          const response = await fetch('/api/expand-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: link })
          })
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.expandedUrl) {
              link = data.expandedUrl
            }
          }
        } catch (error) {
          console.error('Error expanding shortened URL:', error)
          // Continue with original link
        }
      }

      // Pattern 2: https://www.google.com/maps/place/.../@-12.0464,-77.0428,17z
      // Pattern 3: https://www.google.com/maps?q=-12.0464,-77.0428
      // Pattern 4: https://maps.google.com/?q=-12.0464,-77.0428
      
      // Try to find coordinates in the URL
      const patterns = [
        /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,  // @lat,lng
        /q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,  // q=lat,lng
        /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/, // !3dlat!4dlng (Google Maps format)
        /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/, // ll=lat,lng
      ]

      for (const pattern of patterns) {
        const match = link.match(pattern)
        if (match) {
          const lat = parseFloat(match[1])
          const lng = parseFloat(match[2])
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { lat, lng }
          }
        }
      }

      return null
    } catch (error) {
      console.error('Error extracting coordinates:', error)
      return null
    }
  }

  // Handle paste event on Google Maps link field
  const handleMapsLinkPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')
    
    // Check if it's a Google Maps link
    if (pastedText.includes('google.com/maps') || pastedText.includes('maps.app.goo.gl') || pastedText.includes('goo.gl')) {
      toast.info('Procesando', 'Extrayendo coordenadas del link...')
      
      const coords = await extractCoordinatesFromLink(pastedText)
      if (coords) {
        form.setValue('lat', coords.lat)
        form.setValue('lng', coords.lng)
        toast.success('Éxito', `Coordenadas extraídas: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`)
      } else {
        toast.error('Error', 'No se pudieron extraer las coordenadas del link. Por favor, ingresa las coordenadas manualmente o usa el botón GPS.')
      }
    }
  }

  // Handle form submission
  const onSubmit = async (data: ClientFormData) => {
    setLoading(true)
    try {
      // Convert data to FormData for server action
      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          formData.append(key, String(value))
        }
      })

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
