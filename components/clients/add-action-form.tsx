/**
 * Add Action Form Component
 * 
 * Form to add new action logs with action type, description validation.
 * 
 * Requirements: 7.1, 7.2
 */

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

const actionFormSchema = z.object({
  action_type: z.enum(['NOTA', 'LLAMADA', 'VISITA', 'MENSAJE', 'REACTIVACION'], {
    required_error: 'Seleccione un tipo de acción',
  }),
  description: z.string().min(1, 'La descripción es requerida').max(500, 'Máximo 500 caracteres'),
})

type ActionFormValues = z.infer<typeof actionFormSchema>

interface AddActionFormProps {
  clientId: string
}

export function AddActionForm({ clientId }: AddActionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ActionFormValues>({
    resolver: zodResolver(actionFormSchema),
    defaultValues: {
      action_type: undefined,
      description: '',
    },
  })

  const onSubmit = async (data: ActionFormValues) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/client-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          ...data,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create action')
      }

      toast.success('Acción registrada exitosamente')
      form.reset()
      // Refresh the page to show updated data
      window.location.reload()
    } catch (error) {
      console.error('Error creating action:', error)
      toast.error('Error al registrar la acción')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Agregar Acción
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="action_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Acción</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="NOTA">Nota</SelectItem>
                      <SelectItem value="LLAMADA">Llamada</SelectItem>
                      <SelectItem value="VISITA">Visita</SelectItem>
                      <SelectItem value="MENSAJE">Mensaje</SelectItem>
                      <SelectItem value="REACTIVACION">Reactivación</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describa la acción realizada..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Guardando...' : 'Guardar Acción'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
