/**
 * CollectionActionForm Component
 * 
 * Form to log collection actions with client, action type, result, promise date, and notes.
 * Uses React Hook Form + Zod validation.
 * 
 * Features:
 * - Client selector with search
 * - Action type select (LLAMADA, VISITA, WHATSAPP, MENSAJE_SMS, EMAIL, MOTORIZADO, CARTA_NOTARIAL, OTRO)
 * - Result select (COMPROMISO_PAGO, SE_NIEGA_PAGAR, NO_CONTESTA, TELEFONO_INVALIDO, PAGO_REALIZADO, PAGO_PARCIAL, SOLICITA_REFINANCIAMIENTO, SOLICITA_DESCUENTO, PROMETE_PAGAR_FECHA, CLIENTE_MOLESTO, CLIENTE_COLABORADOR, DOMICILIO_INCORRECTO, CLIENTE_NO_UBICADO, OTRO)
 * - Conditional payment promise date (only if result = COMPROMISO_PAGO or PROMETE_PAGAR_FECHA)
 * - Notes textarea
 * - Success/error toast feedback
 * 
 * Design Tokens:
 * - Spacing: 16px (gap between form fields)
 * - Border radius: 8px (standard)
 * - Button height: 36px
 * - Card padding: 16px
 * 
 * Requirements: 10.6
 * 
 * @example
 * ```tsx
 * <CollectionActionForm
 *   onSuccess={(action) => console.log('Action logged:', action)}
 *   onCancel={() => console.log('Cancelled')}
 * />
 * ```
 */

'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { toast } from '@/lib/toast'
import { ClientSelector } from '@/components/pos/client-selector'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Form validation schema
const collectionActionFormSchema = z.object({
  client_id: z.string().min(1, 'Cliente es requerido'),
  client_name: z.string().min(1, 'Nombre del cliente es requerido'),
  action_type: z.enum([
    'LLAMADA',
    'VISITA',
    'WHATSAPP',
    'MENSAJE_SMS',
    'EMAIL',
    'MOTORIZADO',
    'CARTA_NOTARIAL',
    'OTRO'
  ], {
    errorMap: () => ({ message: 'Tipo de acción es requerido' })
  }),
  result: z.enum([
    'COMPROMISO_PAGO',
    'SE_NIEGA_PAGAR',
    'NO_CONTESTA',
    'TELEFONO_INVALIDO',
    'PAGO_REALIZADO',
    'PAGO_PARCIAL',
    'SOLICITA_REFINANCIAMIENTO',
    'SOLICITA_DESCUENTO',
    'PROMETE_PAGAR_FECHA',
    'CLIENTE_MOLESTO',
    'CLIENTE_COLABORADOR',
    'DOMICILIO_INCORRECTO',
    'CLIENTE_NO_UBICADO',
    'OTRO'
  ], {
    errorMap: () => ({ message: 'Resultado es requerido' })
  }),
  payment_promise_date: z.string().optional(),
  notes: z.string().max(1000, 'Las notas deben tener menos de 1000 caracteres').optional()
}).refine(
  (data) => {
    // If result is COMPROMISO_PAGO or PROMETE_PAGAR_FECHA, payment_promise_date is required
    if (data.result === 'COMPROMISO_PAGO' || data.result === 'PROMETE_PAGAR_FECHA') {
      return !!data.payment_promise_date
    }
    return true
  },
  {
    message: 'Fecha de promesa de pago es requerida cuando hay compromiso de pago',
    path: ['payment_promise_date']
  }
)

type CollectionActionFormData = z.infer<typeof collectionActionFormSchema>

interface Client {
  id: string
  name: string
  dni?: string
  credit_limit: number
  credit_used: number
}

interface CollectionActionFormProps {
  onSuccess?: (action: any) => void
  onCancel?: () => void
}

export function CollectionActionForm({ onSuccess, onCancel }: CollectionActionFormProps) {
  const [loading, setLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  // Initialize form with React Hook Form + Zod validation
  const form = useForm<CollectionActionFormData>({
    resolver: zodResolver(collectionActionFormSchema),
    defaultValues: {
      client_id: '',
      client_name: '',
      action_type: undefined,
      result: undefined,
      payment_promise_date: '',
      notes: ''
    }
  })

  // Watch result field to show/hide payment_promise_date
  const resultValue = form.watch('result')

  // Handle client selection
  const handleClientChange = (client: Client | null) => {
    setSelectedClient(client)
    form.setValue('client_id', client?.id || '')
    form.setValue('client_name', client?.name || '')
  }

  // Handle form submission
  const onSubmit = async (data: CollectionActionFormData) => {
    setLoading(true)
    try {
      // Convert data to FormData for server action
      const formData = new FormData()
      formData.append('client_id', data.client_id)
      formData.append('client_name', data.client_name)
      formData.append('action_type', data.action_type)
      formData.append('result', data.result)
      if (data.payment_promise_date) {
        // Convert date to ISO datetime format
        formData.append('payment_promise_date', new Date(data.payment_promise_date).toISOString())
      }
      if (data.notes) {
        formData.append('notes', data.notes)
      }

      // Call server action (to be created)
      const response = await fetch('/api/collections/actions', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al registrar la acción')
      }

      toast.success('Acción registrada', 'La acción de cobranza se ha guardado correctamente')

      // Reset form
      form.reset()
      setSelectedClient(null)

      onSuccess?.(result.data)
    } catch (error) {
      console.error('Error submitting collection action:', error)
      toast.error(
        'Error',
        error instanceof Error ? error.message : 'Error al registrar la acción'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">Registrar Acción de Cobranza</h2>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Client Selector */}
          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ClientSelector
                    value={selectedClient}
                    onChange={handleClientChange}
                    disabled={loading}
                    required
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Action Type and Result in grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Action Type */}
            <FormField
              control={form.control}
              name="action_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Acción *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="LLAMADA">📞 Llamada Telefónica</SelectItem>
                      <SelectItem value="VISITA">🏠 Visita Domiciliaria</SelectItem>
                      <SelectItem value="WHATSAPP">💬 WhatsApp</SelectItem>
                      <SelectItem value="MENSAJE_SMS">📱 Mensaje SMS</SelectItem>
                      <SelectItem value="EMAIL">📧 Correo Electrónico</SelectItem>
                      <SelectItem value="MOTORIZADO">🏍️ Envío de Motorizado</SelectItem>
                      <SelectItem value="CARTA_NOTARIAL">📄 Carta Notarial</SelectItem>
                      <SelectItem value="OTRO">📋 Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Result */}
            <FormField
              control={form.control}
              name="result"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resultado *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar resultado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="COMPROMISO_PAGO">✅ Compromiso de Pago</SelectItem>
                      <SelectItem value="PROMETE_PAGAR_FECHA">📅 Promete Pagar en Fecha</SelectItem>
                      <SelectItem value="PAGO_REALIZADO">💰 Pago Realizado</SelectItem>
                      <SelectItem value="PAGO_PARCIAL">💵 Pago Parcial</SelectItem>
                      <SelectItem value="CLIENTE_COLABORADOR">😊 Cliente Colaborador</SelectItem>
                      <SelectItem value="SOLICITA_REFINANCIAMIENTO">🔄 Solicita Refinanciamiento</SelectItem>
                      <SelectItem value="SOLICITA_DESCUENTO">💲 Solicita Descuento</SelectItem>
                      <SelectItem value="SE_NIEGA_PAGAR">❌ Se Niega a Pagar</SelectItem>
                      <SelectItem value="NO_CONTESTA">📵 No Contesta</SelectItem>
                      <SelectItem value="TELEFONO_INVALIDO">☎️ Teléfono Inválido</SelectItem>
                      <SelectItem value="CLIENTE_MOLESTO">😠 Cliente Molesto</SelectItem>
                      <SelectItem value="DOMICILIO_INCORRECTO">🏚️ Domicilio Incorrecto</SelectItem>
                      <SelectItem value="CLIENTE_NO_UBICADO">🔍 Cliente No Ubicado</SelectItem>
                      <SelectItem value="OTRO">📝 Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Payment Promise Date - Conditional */}
          {(resultValue === 'COMPROMISO_PAGO' || resultValue === 'PROMETE_PAGAR_FECHA') && (
            <FormField
              control={form.control}
              name="payment_promise_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Compromiso de Pago *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Detalles de la acción de cobranza..."
                    {...field}
                    disabled={loading}
                    rows={4}
                  />
                </FormControl>
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
              {loading ? 'Guardando...' : 'Registrar Acción'}
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  )
}
