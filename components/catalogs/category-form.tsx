'use client'

/**
 * Category Form Component
 * 
 * Form for creating/editing product categories
 * Requires line selection
 */

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
  }
}

export function CategoryForm({ lines, defaultValues }: CategoryFormProps) {
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
        <Select name="line_id" defaultValue={defaultValues?.line_id} required>
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
