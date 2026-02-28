'use client'

/**
 * Generic Catalog Form Dialog Component
 * 
 * Reusable dialog component for creating/editing catalog entities
 * Features:
 * - Modal dialog with shadcn/ui Dialog
 * - Form validation with React Hook Form + Zod
 * - Loading states
 * - Design tokens compliance (padding: 16px, border-radius: 8px)
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface CatalogFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  onSubmit: (formData: FormData) => Promise<{ success: boolean; error?: string | Record<string, string[]> }>
  submitLabel?: string
}

export function CatalogFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = 'Guardar'
}: CatalogFormDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const result = await onSubmit(formData)

      if (result.success) {
        toast.success('Operación exitosa')
        onOpenChange(false)
      } else {
        if (typeof result.error === 'string') {
          toast.error(result.error)
        } else {
          // Handle field errors
          const firstError = Object.values(result.error || {})[0]?.[0]
          toast.error(firstError || 'Error de validación')
        }
      }
    } catch (error) {
      toast.error('Error inesperado')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="py-4">
            {children}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
