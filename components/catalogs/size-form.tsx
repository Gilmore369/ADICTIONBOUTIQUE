'use client'

/**
 * Size Form Component
 * 
 * Form for creating/editing sizes
 * Requires category selection
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

interface SizeFormProps {
  categories: Array<{ id: string; name: string }>
  defaultValues?: {
    name?: string
    category_id?: string
    active?: boolean
  }
  isEditing?: boolean
}

export function SizeForm({ categories, defaultValues, isEditing = false }: SizeFormProps) {
  const [categoryId, setCategoryId] = useState(defaultValues?.category_id || '')

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
        <Select value={categoryId} onValueChange={setCategoryId}>
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
        <input type="hidden" name="category_id" value={categoryId} />
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
