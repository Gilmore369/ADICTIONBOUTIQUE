/**
 * RescheduleDialog Component
 * 
 * Dialog to reschedule installment due dates with reason input.
 * Shows current due date and allows selecting new due date.
 * 
 * Features:
 * - Shows current due date
 * - New due date input
 * - Reason textarea (required)
 * - Confirm/Cancel buttons
 * - Calls rescheduleInstallment Server Action
 * - Success/error toast feedback
 * 
 * Design Tokens:
 * - Spacing: 16px
 * - Border radius: 8px
 * - Button height: 36px
 * 
 * Requirements: 10.4
 * 
 * @example
 * ```tsx
 * <RescheduleDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   installment={installment}
 *   onSuccess={() => console.log('Rescheduled')}
 * />
 * ```
 */

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Calendar } from 'lucide-react'
import { formatSafeDate, isValidDate } from '@/lib/utils/date'

// Form validation schema
const rescheduleFormSchema = z.object({
  new_due_date: z.string().min(1, 'Nueva fecha de vencimiento es requerida'),
  reason: z.string().min(10, 'La razón debe tener al menos 10 caracteres').max(500, 'La razón debe tener menos de 500 caracteres')
}).refine(
  (data) => {
    // Validate new_due_date is a valid date
    return isValidDate(data.new_due_date)
  },
  {
    message: 'Fecha inválida',
    path: ['new_due_date']
  }
)

type RescheduleFormData = z.infer<typeof rescheduleFormSchema>

interface Installment {
  id: string
  installment_number: number
  amount: number
  due_date: string
  paid_amount: number
  status: string
}

interface RescheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  installment: Installment | null
  onSuccess?: () => void
}

export function RescheduleDialog({
  open,
  onOpenChange,
  installment,
  onSuccess
}: RescheduleDialogProps) {
  const [loading, setLoading] = useState(false)

  // Initialize form with React Hook Form + Zod validation
  const form = useForm<RescheduleFormData>({
    resolver: zodResolver(rescheduleFormSchema),
    defaultValues: {
      new_due_date: '',
      reason: ''
    }
  })

  // Reset form when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset()
    }
    onOpenChange(newOpen)
  }

  // Handle form submission
  const onSubmit = async (data: RescheduleFormData) => {
    if (!installment) return

    setLoading(true)
    try {
      // Convert data to FormData for server action
      const formData = new FormData()
      formData.append('installment_id', installment.id)
      // Convert date to ISO datetime format
      formData.append('new_due_date', new Date(data.new_due_date).toISOString())
      formData.append('reason', data.reason)

      // Call server action (to be created)
      const response = await fetch('/api/debt/reschedule', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al reprogramar la cuota')
      }

      toast.success(
        'Cuota reprogramada',
        `La cuota #${installment.installment_number} se ha reprogramado correctamente`
      )

      // Reset form and close dialog
      form.reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error rescheduling installment:', error)
      toast.error(
        'Error',
        error instanceof Error ? error.message : 'Error al reprogramar la cuota'
      )
    } finally {
      setLoading(false)
    }
  }

  if (!installment) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reprogramar Cuota</DialogTitle>
          <DialogDescription>
            Reprogramar la fecha de vencimiento de la cuota #{installment.installment_number}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Current Due Date - Read only */}
            <div className="p-3 border rounded-lg bg-gray-50">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Fecha de vencimiento actual:</span>
              </div>
              <div className="text-base font-semibold">
                {formatSafeDate(installment.due_date, 'EEEE, d \'de\' MMMM \'de\' yyyy')}
              </div>
            </div>

            {/* New Due Date */}
            <FormField
              control={form.control}
              name="new_due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva Fecha de Vencimiento *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      disabled={loading}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razón de la Reprogramación *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explique el motivo de la reprogramación..."
                      {...field}
                      disabled={loading}
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dialog Footer with Actions */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Reprogramando...' : 'Confirmar Reprogramación'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
