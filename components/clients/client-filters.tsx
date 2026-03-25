'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import type { ClientFilters as ClientFiltersType } from '@/lib/types/crm'

interface ClientFiltersProps {
  onFilterChange: (filters: ClientFiltersType) => void
}

export function ClientFilters({ onFilterChange }: ClientFiltersProps) {
  const [filters, setFilters] = useState<ClientFiltersType>({})
  const [daysSinceLastPurchase, setDaysSinceLastPurchase] = useState('')
  
  // Debounce the days input
  const debouncedDays = useDebounce(daysSinceLastPurchase, 300)

  // Update filters when debounced value changes
  useEffect(() => {
    if (debouncedDays) {
      const days = parseInt(debouncedDays)
      if (!isNaN(days) && days > 0) {
        setFilters(prev => ({ ...prev, daysSinceLastPurchase: days }))
      }
    } else {
      setFilters(prev => {
        const { daysSinceLastPurchase, ...rest } = prev
        return rest
      })
    }
  }, [debouncedDays])

  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange(filters)
  }, [filters, onFilterChange])

  const handleDebtStatusChange = (value: string) => {
    if (value === 'all') {
      const { debtStatus, ...rest } = filters
      setFilters(rest)
    } else {
      setFilters({ ...filters, debtStatus: value as 'AL_DIA' | 'CON_DEUDA' | 'MOROSO' })
    }
  }

  const handleRatingChange = (value: string) => {
    if (value === 'all') {
      const { rating, ...rest } = filters
      setFilters(rest)
    } else {
      setFilters({ ...filters, rating: [value as 'A' | 'B' | 'C' | 'D'] })
    }
  }

  const handleBirthdayMonthChange = (value: string) => {
    if (value === 'all') {
      const { birthdayMonth, ...rest } = filters
      setFilters(rest)
    } else {
      setFilters({ ...filters, birthdayMonth: parseInt(value) })
    }
  }

  const handleStatusChange = (value: string) => {
    if (value === 'all') {
      const { status, ...rest } = filters
      setFilters(rest)
    } else {
      setFilters({ ...filters, status: value as 'ACTIVO' | 'INACTIVO' | 'BAJA' })
    }
  }

  const handleDeactivationReasonChange = (value: string) => {
    if (value === 'all') {
      const { deactivationReason, ...rest } = filters
      setFilters(rest)
    } else {
      setFilters({ ...filters, deactivationReason: [value] })
    }
  }

  const clearFilters = () => {
    setFilters({})
    setDaysSinceLastPurchase('')
  }

  const hasActiveFilters = Object.keys(filters).length > 0

  return (
    <div className="flex flex-wrap items-end gap-2 p-3 bg-muted/40 border rounded-lg">
      {/* Debt Status */}
      <div className="flex flex-col gap-1 min-w-[130px]">
        <Label className="text-xs text-muted-foreground">Deuda</Label>
        <Select value={filters.debtStatus || 'all'} onValueChange={handleDebtStatusChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="AL_DIA">Al día</SelectItem>
            <SelectItem value="CON_DEUDA">Con deuda</SelectItem>
            <SelectItem value="MOROSO">Moroso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Rating */}
      <div className="flex flex-col gap-1 min-w-[120px]">
        <Label className="text-xs text-muted-foreground">Calificación</Label>
        <Select value={filters.rating?.[0] || 'all'} onValueChange={handleRatingChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="A">A - Excelente</SelectItem>
            <SelectItem value="B">B - Bueno</SelectItem>
            <SelectItem value="C">C - Regular</SelectItem>
            <SelectItem value="D">D - Malo</SelectItem>
            <SelectItem value="E">E - Riesgo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Birthday Month */}
      <div className="flex flex-col gap-1 min-w-[130px]">
        <Label className="text-xs text-muted-foreground">Cumpleaños</Label>
        <Select value={filters.birthdayMonth?.toString() || 'all'} onValueChange={handleBirthdayMonthChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="1">Enero</SelectItem>
            <SelectItem value="2">Febrero</SelectItem>
            <SelectItem value="3">Marzo</SelectItem>
            <SelectItem value="4">Abril</SelectItem>
            <SelectItem value="5">Mayo</SelectItem>
            <SelectItem value="6">Junio</SelectItem>
            <SelectItem value="7">Julio</SelectItem>
            <SelectItem value="8">Agosto</SelectItem>
            <SelectItem value="9">Septiembre</SelectItem>
            <SelectItem value="10">Octubre</SelectItem>
            <SelectItem value="11">Noviembre</SelectItem>
            <SelectItem value="12">Diciembre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1 min-w-[120px]">
        <Label className="text-xs text-muted-foreground">Estado</Label>
        <Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ACTIVO">Activo</SelectItem>
            <SelectItem value="INACTIVO">Inactivo</SelectItem>
            <SelectItem value="BAJA">Dado de Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Days without purchase */}
      <div className="flex flex-col gap-1 w-[110px]">
        <Label className="text-xs text-muted-foreground">Días sin comprar</Label>
        <Input
          type="number"
          min="0"
          placeholder="Ej: 30"
          className="h-8 text-sm"
          value={daysSinceLastPurchase}
          onChange={(e) => setDaysSinceLastPurchase(e.target.value)}
        />
      </div>

      {/* Deactivation reason - only when status=BAJA */}
      {filters.status === 'BAJA' && (
        <div className="flex flex-col gap-1 min-w-[130px]">
          <Label className="text-xs text-muted-foreground">Motivo de baja</Label>
          <Select value={filters.deactivationReason?.[0] || 'all'} onValueChange={handleDeactivationReasonChange}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="FALLECIDO">Fallecido</SelectItem>
              <SelectItem value="MUDADO">Mudado</SelectItem>
              <SelectItem value="DESAPARECIDO">Desaparecido</SelectItem>
              <SelectItem value="OTRO">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 mt-auto gap-1 text-xs">
          <X className="h-3 w-3" />
          Limpiar
        </Button>
      )}
    </div>
  )
}
