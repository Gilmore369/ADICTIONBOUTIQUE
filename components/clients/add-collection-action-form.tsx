/**
 * Add Collection Action Form Component
 * 
 * Form to add collection actions with action type, result, description, and follow-up date.
 * 
 * Requirements: 8.1, 8.2
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
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import { COLLECTION_ACTION_TYPES, COLLECTION_RESULTS, requiresFollowUpDate } from '@/lib/constants/collection-actions'

const collectionActionFormSchema = z.object({
  action_type: z.string().min(1, 'El tipo de acción es requerido'),
  result: z.string().min(1, 'El resultado es requerido'),
  description: z.string().min(1, 'La descripción es requerida').max(500, 'Máximo 500 caracteres'),
  follow_up_date: z.string().optional(),
}).refine((data) => {
  // Si el resultado requiere fecha de seguimiento, validar que esté presente
  if (requiresFollowUpDate(data.result) && !data.follow_up_date) {
    return false
  }
  return true
}, {
  message: 'Este resultado requiere una fecha de seguimiento',
  path: ['follow_up_date'],
})

type CollectionActionFormValues = z.infer<typeof collectionActionFormSchema>

interface AddCollectionActionFormProps {
  clientId: string
}

export function AddCollectionActionForm({ clientId }: AddCollectionActionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CollectionActionFormValues>({
    resolver: zodResolver(collectionActionFormSchema),
    defaultValues: {
      action_type: '',
      result: '',
      description: '',
      follow_up_date: '',
    },
  })

  const selectedResult = form.watch('result')
  const showFollowUpDate = selectedResult ? requiresFollowUpDate(selectedResult) : false

  const onSubmit = async (data: CollectionActionFormValues) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/collection-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          ...data,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create collection action')
      }

      toast.success('Acción de cobranza registrada exitosamente')
      form.reset()
      // Refresh the page to show updated data
      window.location.reload()
    } catch (error) {
      console.error('Error creating collection action:', error)
      toast.error('Error al registrar la acción de cobranza')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Agregar Acción de Cobranza
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el tipo de acción" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COLLECTION_ACTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <span className="flex items-center gap-2">
                            <span>{type.icon}</span>
                            <span>{type.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="result"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resultado de la Gestión</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el resultado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      {COLLECTION_RESULTS.map((result) => (
                        <SelectItem key={result.value} value={result.value}>
                          <div className="flex flex-col">
                            <span className="flex items-center gap-2">
                              <span>{result.icon}</span>
                              <span className={result.color}>{result.label}</span>
                            </span>
                            <span className="text-xs text-muted-foreground">{result.description}</span>
                          </div>
                        </SelectItem>
                      ))}
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
                      placeholder="Describa los detalles de la gestión de cobranza..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Incluya detalles importantes de la conversación o gestión realizada
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showFollowUpDate && (
              <FormField
                control={form.control}
                name="follow_up_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Seguimiento</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Fecha en la que se debe realizar el próximo seguimiento
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Guardando...' : 'Guardar Acción de Cobranza'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
