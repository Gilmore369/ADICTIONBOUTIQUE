/**
 * PaymentForm Component
 * 
 * Form to record payments with amount, date, client selector, receipt URL, and notes.
 * Uses React Hook Form + Zod validation and calls processPayment Server Action.
 * 
 * Features:
 * - Client selector with search
 * - Amount input with positive validation
 * - Payment date input (ISO format)
 * - Optional receipt URL
 * - Optional notes textarea
 * - Success/error toast feedback
 * 
 * Design Tokens:
 * - Spacing: 16px (gap between form fields)
 * - Border radius: 8px (standard)
 * - Button height: 36px
 * - Card padding: 16px
 * 
 * Requirements: 7.1, 7.5, 7.6
 * 
 * @example
 * ```tsx
 * <PaymentForm
 *   onSuccess={(result) => console.log('Payment processed:', result)}
 *   onCancel={() => console.log('Cancelled')}
 * />
 * ```
 */

'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { processPayment } from '@/actions/payments'
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
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Form validation schema
const paymentFormSchema = z.object({
  client_id: z.string().min(1, 'Cliente es requerido'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  payment_date: z.string().min(1, 'Fecha de pago es requerida'),
  receipt_url: z.string().url('URL inválida').optional().or(z.literal('')),
  notes: z.string().max(500, 'Las notas deben tener menos de 500 caracteres').optional()
})

type PaymentFormData = z.infer<typeof paymentFormSchema>

interface Client {
  id: string
  name: string
  dni?: string
  credit_limit: number
  credit_used: number
}

interface PaymentFormProps {
  onSuccess?: (result: any) => void
  onCancel?: () => void
  /** Called whenever the selected client changes (passes the client id or '') */
  onClientChange?: (clientId: string) => void
  /** Called whenever the amount field changes */
  onAmountChange?: (amount: number) => void
}

export function PaymentForm({ onSuccess, onCancel, onClientChange, onAmountChange }: PaymentFormProps) {
  const [loading, setLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  // Initialize form with React Hook Form + Zod validation
  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      client_id: '',
      amount: 0,
      payment_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
      receipt_url: '',
      notes: ''
    }
  })

  // Handle client selection
  const handleClientChange = (client: Client | null) => {
    setSelectedClient(client)
    form.setValue('client_id', client?.id || '')
    onClientChange?.(client?.id || '')
  }

  // Handle form submission
  const onSubmit = async (data: PaymentFormData) => {
    setLoading(true)
    try {
      // Convert data to FormData for server action
      const formData = new FormData()
      formData.append('client_id', data.client_id)
      formData.append('amount', String(data.amount))
      // Convert date to ISO datetime format
      formData.append('payment_date', new Date(data.payment_date).toISOString())
      if (data.receipt_url) {
        formData.append('receipt_url', data.receipt_url)
      }
      if (data.notes) {
        formData.append('notes', data.notes)
      }

      const result = await processPayment(formData)

      if (!result.success) {
        throw new Error(
          typeof result.error === 'string'
            ? result.error
            : 'Error al procesar el pago'
        )
      }

      toast.success(
        'Pago registrado',
        `Se aplicó S/ ${result.data.amount_applied.toFixed(2)} a ${result.data.installments_updated} cuota(s)`
      )

      // Reset form
      form.reset()
      setSelectedClient(null)

      onSuccess?.(result.data)
    } catch (error) {
      console.error('Error submitting payment:', error)
      toast.error(
        'Error',
        error instanceof Error ? error.message : 'Error al registrar el pago'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">Registrar Pago</h2>
      
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

          {/* Amount and Date in grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0
                        field.onChange(v)
                        onAmountChange?.(v)
                      }}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Date */}
            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Pago *</FormLabel>
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
          </div>

          {/* Receipt URL */}
          <FormField
            control={form.control}
            name="receipt_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL del Recibo (opcional)</FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    placeholder="https://ejemplo.com/recibo.pdf"
                    {...field}
                    disabled={loading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Notas adicionales sobre el pago..."
                    {...field}
                    disabled={loading}
                    rows={3}
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
              {loading ? 'Procesando...' : 'Registrar Pago'}
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  )
}
