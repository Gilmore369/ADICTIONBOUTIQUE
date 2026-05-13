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
  const [showError, setShowError] = useState(false)

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
        <Select
          value={lineId}
          onValueChange={(v) => { setLineId(v); setShowError(false) }}
        >
          <SelectTrigger className={!lineId && showError ? 'border-destructive' : ''}>
            <SelectValue placeholder="Seleccionar línea" />
          </SelectTrigger>
          <SelectContent>
            {lines.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No hay líneas. Crea una primero en /catalogs/lines.
              </div>
            )}
            {lines.map((line) => (
              <SelectItem key={line.id} value={line.id}>
                {line.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* SIEMPRE renderizar el hidden input (con string vacío si no hay selección)
            para que FormData reciba el campo y Zod devuelva error claro. */}
        <input type="hidden" name="line_id" value={lineId} />
        {/* Mensaje inline al intentar submit sin línea */}
        {!lineId && (
          <p className="text-xs text-destructive/80">
            Selecciona una línea (Hombres / Mujeres / Niños) antes de guardar.
          </p>
        )}
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
