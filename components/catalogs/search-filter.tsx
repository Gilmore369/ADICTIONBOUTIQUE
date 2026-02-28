'use client'

/**
 * Search Filter Component
 * 
 * Componente de búsqueda con debounce de 300ms para filtrar catálogos
 * 
 * Design tokens:
 * - Input height: 36px
 * - Border radius: 8px
 * - Spacing: 8px
 * 
 * Performance: Debounce de 300ms para evitar búsquedas excesivas
 */

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'

interface SearchFilterProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchFilter({ value, onChange, placeholder = 'Buscar...' }: SearchFilterProps) {
  const [localValue, setLocalValue] = useState(value)
  const debouncedValue = useDebounce(localValue, 300)

  // Sync debounced value with parent
  useEffect(() => {
    onChange(debouncedValue)
  }, [debouncedValue, onChange])

  // Sync external changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-10"
      />
    </div>
  )
}
