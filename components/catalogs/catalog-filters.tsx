'use client'

/**
 * Catalog Filters Component
 * 
 * Componente reutilizable para filtros en catálogos
 * 
 * Design tokens:
 * - Spacing: 16px
 * - Border radius: 8px
 * - Select height: 36px
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface FilterOption {
  value: string
  label: string
}

interface CatalogFiltersProps {
  filters: {
    label: string
    value: string
    options: FilterOption[]
    onChange: (value: string) => void
    placeholder?: string
  }[]
  onReset: () => void
  showReset?: boolean
}

export function CatalogFilters({ filters, onReset, showReset = true }: CatalogFiltersProps) {
  const hasActiveFilters = filters.some(f => f.value !== '')

  return (
    <div className="flex flex-wrap gap-4 items-end">
      {filters.map((filter, index) => (
        <div key={index} className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">
            {filter.label}
          </label>
          <Select value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger>
              <SelectValue placeholder={filter.placeholder || `Seleccionar ${filter.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {filter.options.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {showReset && hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  )
}
