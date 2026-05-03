'use client'

/**
 * Size Form Component
 *
 * Form for creating/editing sizes.
 * When creating (isEditing=false): supports adding multiple size names at once.
 * When editing: single name input as before.
 */

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SizeFormProps {
  categories: Array<{ id: string; name: string; line_id?: string }>
  lines?: Array<{ id: string; name: string }>
  defaultValues?: {
    name?: string
    category_id?: string
    active?: boolean
  }
  isEditing?: boolean
}

export function SizeForm({ categories, lines = [], defaultValues, isEditing = false }: SizeFormProps) {
  // Derive initial line from the default category (when editing)
  const initialLineId = (() => {
    if (!defaultValues?.category_id) return ''
    const cat = categories.find(c => c.id === defaultValues.category_id)
    return cat?.line_id || ''
  })()

  const [lineId, setLineId] = useState(initialLineId)
  const [categoryId, setCategoryId] = useState(defaultValues?.category_id || '')
  // Multiple names when creating
  const [names, setNames] = useState<string[]>(isEditing ? [defaultValues?.name || ''] : [''])

  const filteredCategories = lineId
    ? categories.filter(c => c.line_id === lineId)
    : categories

  const handleLineChange = (newLineId: string) => {
    setLineId(newLineId)
    // Reset category if it doesn't belong to the newly selected line
    if (categoryId) {
      const cat = categories.find(c => c.id === categoryId)
      if (cat?.line_id !== newLineId) setCategoryId('')
    }
  }

  const addRow = () => setNames(prev => [...prev, ''])
  const removeRow = (idx: number) => setNames(prev => prev.filter((_, i) => i !== idx))
  const updateRow = (idx: number, val: string) =>
    setNames(prev => prev.map((v, i) => (i === idx ? val : v)))

  return (
    <div className="space-y-4">
      {/* Line — only shown when lines were passed */}
      {lines.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="line_id">
            Línea <span className="text-destructive">*</span>
          </Label>
          <Select value={lineId} onValueChange={handleLineChange}>
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
      )}

      {/* Category — filtered by selected line */}
      <div className="space-y-2">
        <Label htmlFor="category_id">
          Categoría <span className="text-destructive">*</span>
        </Label>
        <Select
          value={categoryId}
          onValueChange={setCategoryId}
          disabled={lines.length > 0 && !lineId}
        >
          <SelectTrigger>
            <SelectValue placeholder={lines.length > 0 && !lineId ? 'Elige línea primero' : 'Seleccionar categoría'} />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="category_id" value={categoryId} />
      </div>

      {/* Size names */}
      <div className="space-y-2">
        <Label>
          {isEditing ? 'Nombre' : 'Tallas'}{' '}
          <span className="text-destructive">*</span>
          {!isEditing && (
            <span className="text-xs text-gray-500 font-normal ml-1">
              (puedes agregar varias a la vez)
            </span>
          )}
        </Label>

        <div className="space-y-2">
          {names.map((val, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                name="name"
                value={val}
                onChange={(e) => updateRow(idx, e.target.value)}
                placeholder="Ej: S, M, L, XL, 38, 40"
                required
                maxLength={50}
                className="flex-1"
              />
              {!isEditing && names.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-gray-400 hover:text-red-500"
                  onClick={() => removeRow(idx)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Add more button (only when creating) */}
        {!isEditing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            className="mt-1 h-8 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Agregar otra talla
          </Button>
        )}
      </div>

      {/* Active toggle (editing only) */}
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
