/**
 * Register Payment Dialog Component
 * 
 * Dialog to register partial or complete payments for installments
 * 
 * Requirements: Payment registration from client profile and map
 */

'use client'

import { useState } from 'react'
import { useStore } from '@/contexts/store-context'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { DollarSign, Store } from 'lucide-react'

const STORE_TEXT: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

const paymentFormSchema = z.object({
  amount: z.string().min(1, 'El monto es requerido'),
  payment_method: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'], {
    required_error: 'Seleccione un método de pago',
  }),
  payment_date: z.string().min(1, 'La fecha es requerida'),
  notes: z.string().optional(),
})

type PaymentFormValues = z.infer<typeof paymentFormSchema>

interface RegisterPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  installmentId: string
  installmentNumber: number
  saleNumber: string
  pendingAmount: number
  saleStoreId?: string  // store this installment belongs to (e.g. 'Tienda Mujeres')
  onSuccess?: () => void
}

export function RegisterPaymentDialog({
  open,
  onOpenChange,
  installmentId,
  installmentNumber,
  saleNumber,
  pendingAmount,
  saleStoreId,
  onSuccess,
}: RegisterPaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { selectedStore } = useStore()

  // Store validation: block payment if current store doesn't match installment's store
  const activeStoreText = selectedStore !== 'ALL' ? STORE_TEXT[selectedStore] : null
  const isStoreMismatch = !!(activeStoreText && saleStoreId && saleStoreId !== activeStoreText)

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: pendingAmount.toFixed(2),
      payment_method: 'EFECTIVO',
      payment_date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  })

  const onSubmit = async (data: PaymentFormValues) => {
    if (isStoreMismatch) {
      toast.error(`No puedes registrar pagos de ${saleStoreId} desde ${activeStoreText}`)
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/payments/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installmentId,
          amount: parseFloat(data.amount),
          paymentMethod: data.payment_method,
          paymentDate: data.payment_date,
          notes: data.notes,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to register payment')
      }

      toast.success('Pago registrado exitosamente')
      form.reset()
      onOpenChange(false)
      
      // Trigger refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('client-data-updated'))
      }
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error registering payment:', error)
      toast.error(error instanceof Error ? error.message : 'Error al registrar el pago')
    } finally {
      setIsSubmitting(false)
    }
  }

  const watchedAmount = form.watch('amount')
  const isPartialPayment = watchedAmount && parseFloat(watchedAmount) < pendingAmount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Registrar Pago
          </DialogTitle>
          <DialogDescription>
            Venta {saleNumber} - Cuota {installmentNumber}
            <br />
            <span className="font-semibold text-gray-900">
              Pendiente: S/ {pendingAmount.toFixed(2)}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Store mismatch warning */}
        {isStoreMismatch && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 -mt-2">
            <Store className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
            <span>Esta cuota pertenece a <strong>{saleStoreId}</strong>. No puedes registrar pagos desde <strong>{activeStoreText}</strong>.</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto a Pagar</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        S/
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={pendingAmount}
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  {isPartialPayment && (
                    <FormDescription className="text-amber-600">
                      Pago parcial - Quedará pendiente: S/ {(pendingAmount - parseFloat(watchedAmount || '0')).toFixed(2)}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => form.setValue('amount', (pendingAmount / 2).toFixed(2))}
              >
                50%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => form.setValue('amount', pendingAmount.toFixed(2))}
              >
                Pago Completo
              </Button>
            </div>

            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método de Pago</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione método" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="EFECTIVO">💵 Efectivo</SelectItem>
                      <SelectItem value="TRANSFERENCIA">🏦 Transferencia</SelectItem>
                      <SelectItem value="TARJETA">💳 Tarjeta</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Pago</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observaciones sobre el pago..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || isStoreMismatch} className="flex-1"
                title={isStoreMismatch ? `No puedes registrar pagos de otra tienda` : undefined}>
                {isSubmitting ? 'Registrando...' : 'Registrar Pago'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
