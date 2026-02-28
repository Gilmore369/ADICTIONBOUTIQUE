'use client'

/**
 * Size Form Component
 * 
 * Form for creating/editing sizes
 * Requires category selection
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

interface SizeFormProps {
  categories: Array<{ id: string; name: string }>
  defaultValues?: {
    name?: string
    category_id?: string
  }
}

export function SizeForm({ categories, defaultValues }: SizeFormProps) {
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
          placeholder="Ej: S, M, L, XL, 38, 40"
          required
          maxLength={50}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category_id">
          Categoría <span className="text-destructive">*</span>
        </Label>
        <Select name="category_id" defaultValue={defaultValues?.category_id} required>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar categoría" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
