'use client'

/**
 * Category Form Component
 * 
 * Form for creating/editing product categories
 * Requires line selection
 */

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CategoryFormProps {
  lines: Array<{ id: string; name: string }>
  defaultValues?: {
    name?: string
    line_id?: string
    description?: string
    active?: boolean
  }
  isEditing?: boolean
}

export function CategoryForm({ lines, defaultValues, isEditing = false }: CategoryFormProps) {
  const [lineId, setLineId] = useState(defaultValues?.line_id || '')

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
          placeholder="Ej: Zapatos, Camisas"
          required
          maxLength={100}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="line_id">
          Línea <span className="text-destructive">*</span>
        </Label>
        <Select value={lineId} onValueChange={setLineId}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar línea" />
          </SelectTrigger>
          <SelectContent>
            {lines.map((line) => (
              <SelectItem key={line.id} value={line.id}>
                {line.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Hidden input to submit the selected line_id with the form */}
        {lineId && <input type="hidden" name="line_id" value={lineId} />}
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
      {isEditing && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="active"
            name="active"
            defaultChecked={defaultValues?.active !== false}
          />
          <Label htmlFor="active" className="text-sm font-normal cursor-pointer">
            Activo (visible en selectores)
          </Label>
        </div>
      )}
    </div>
  )
}
