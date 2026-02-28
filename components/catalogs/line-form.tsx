'use client'

/**
 * Line Form Component
 * 
 * Form for creating/editing product lines
 * Uses design tokens: spacing 16px, input height matches button (36px)
 */

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface LineFormProps {
  defaultValues?: {
    name?: string
    description?: string
  }
}

export function LineForm({ defaultValues }: LineFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          Nombre <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultValues?.name}
          placeholder="Ej: Damas, Caballeros"
          required
          maxLength={100}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Input
          id="description"
          name="description"
          defaultValue={defaultValues?.description}
          placeholder="Descripción opcional"
        />
      </div>
    </div>
  )
}
