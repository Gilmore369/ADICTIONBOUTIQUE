"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { designTokens } from "@/config/design-tokens"

interface MapFiltersProps {
  filters: {
    overdue: boolean
    upcoming: boolean
    noDebt: boolean
    all: boolean
  }
  onFilterChange: (filters: MapFiltersProps['filters']) => void
}

export function MapFilters({ filters, onFilterChange }: MapFiltersProps) {
  const handleCheckboxChange = (key: keyof typeof filters) => {
    const newFilters = { ...filters, [key]: !filters[key] }
    
    // If "All" is checked, uncheck others
    if (key === 'all' && !filters.all) {
      newFilters.overdue = false
      newFilters.upcoming = false
      newFilters.noDebt = false
    } else if (key !== 'all' && !filters.all) {
      // If any specific filter is checked, uncheck "All"
      newFilters.all = false
    }
    
    onFilterChange(newFilters)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.all}
              onChange={() => handleCheckboxChange('all')}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm">Todos</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.overdue}
              onChange={() => handleCheckboxChange('overdue')}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              Vencido
            </span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.upcoming}
              onChange={() => handleCheckboxChange('upcoming')}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              Por vencer
            </span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.noDebt}
              onChange={() => handleCheckboxChange('noDebt')}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              Sin deuda
            </span>
          </label>
        </div>
      </CardContent>
    </Card>
  )
}
