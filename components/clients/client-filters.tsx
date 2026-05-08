'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ChevronDown, X, Check } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import type { ClientFilters as ClientFiltersType } from '@/lib/types/crm'
import { cn } from '@/lib/utils'

interface ClientFiltersProps {
  onFilterChange: (filters: ClientFiltersType) => void
  initialFilters?: ClientFiltersType
}

/* ─── Generic searchable combobox ─── */
interface ComboOption { value: string; label: string }

function FilterCombobox({
  label,
  options,
  value,
  onChange,
  placeholder = 'Todos',
}: {
  label: string
  options: ComboOption[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase())
  )

  const selectedLabel = options.find(o => o.value === value)?.label ?? placeholder

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <button
          type="button"
          onClick={() => { setOpen(v => !v); setQuery('') }}
          className={cn(
            'flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm ring-offset-background',
            'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            value !== 'all' && 'text-foreground font-medium',
            value === 'all' && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-50 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full min-w-[140px] rounded-md border bg-popover shadow-md">
            {/* Search inside dropdown */}
            <div className="p-1.5 border-b">
              <Input
                autoFocus
                placeholder="Buscar..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="h-7 text-xs"
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</p>
              )}
              {filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); setQuery('') }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
                    value === opt.value && 'bg-accent/60',
                  )}
                >
                  <Check className={cn('h-3.5 w-3.5 shrink-0', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Filter options ─── */
const DEBT_OPTIONS: ComboOption[] = [
  { value: 'all', label: 'Todos' },
  { value: 'AL_DIA', label: 'Al día' },
  { value: 'CON_DEUDA', label: 'Con deuda' },
  { value: 'MOROSO', label: 'Moroso' },
]

const RATING_OPTIONS: ComboOption[] = [
  { value: 'all', label: 'Todas' },
  { value: 'S', label: '⭐ S - Especial' },
  { value: 'A', label: '🏆 A - Excelente' },
  { value: 'B', label: '👍 B - Bueno' },
  { value: 'C', label: '🆗 C - Regular' },
  { value: 'D', label: '⚠️ D - Básico' },
  { value: 'E', label: '🔴 E - Riesgo' },
]

const MONTH_OPTIONS: ComboOption[] = [
  { value: 'all', label: 'Todos' },
  { value: '1',  label: 'Enero' },
  { value: '2',  label: 'Febrero' },
  { value: '3',  label: 'Marzo' },
  { value: '4',  label: 'Abril' },
  { value: '5',  label: 'Mayo' },
  { value: '6',  label: 'Junio' },
  { value: '7',  label: 'Julio' },
  { value: '8',  label: 'Agosto' },
  { value: '9',  label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

const STATUS_OPTIONS: ComboOption[] = [
  { value: 'all',     label: 'Todos' },
  { value: 'ACTIVO',  label: 'Activo' },
  { value: 'INACTIVO',label: 'Inactivo' },
  { value: 'BAJA',    label: 'Dado de Baja' },
]

const DEACT_OPTIONS: ComboOption[] = [
  { value: 'all',          label: 'Todos' },
  { value: 'FALLECIDO',    label: 'Fallecido' },
  { value: 'MUDADO',       label: 'Mudado' },
  { value: 'DESAPARECIDO', label: 'Desaparecido' },
  { value: 'OTRO',         label: 'Otro' },
]

/* ─── Main component ─── */
export function ClientFilters({ onFilterChange, initialFilters }: ClientFiltersProps) {
  const [filters, setFilters] = useState<ClientFiltersType>(initialFilters || { status: 'ACTIVO' })
  const [daysSinceLastPurchase, setDaysSinceLastPurchase] = useState('')

  const debouncedDays = useDebounce(daysSinceLastPurchase, 300)

  useEffect(() => {
    if (debouncedDays) {
      const days = parseInt(debouncedDays)
      if (!isNaN(days) && days > 0) {
        setFilters(prev => ({ ...prev, daysSinceLastPurchase: days }))
      }
    } else {
      setFilters(prev => { const { daysSinceLastPurchase: _, ...rest } = prev; return rest })
    }
  }, [debouncedDays])

  useEffect(() => { onFilterChange(filters) }, [filters, onFilterChange])

  const set = <K extends keyof ClientFiltersType>(key: K, val: ClientFiltersType[K] | undefined) =>
    setFilters(prev => {
      if (val === undefined) { const { [key]: _, ...rest } = prev; return rest as ClientFiltersType }
      return { ...prev, [key]: val }
    })

  const hasActiveFilters = Object.keys(filters).some(k => !(k === 'status' && filters.status === 'ACTIVO'))

  const clearFilters = () => { setFilters({ status: 'ACTIVO' }); setDaysSinceLastPurchase('') }

  return (
    <div className="flex flex-wrap items-end gap-2 p-3 bg-muted/40 border rounded-lg">
      <FilterCombobox
        label="Deuda"
        options={DEBT_OPTIONS}
        value={filters.debtStatus || 'all'}
        onChange={v => set('debtStatus', v === 'all' ? undefined : v as ClientFiltersType['debtStatus'])}
      />

      <FilterCombobox
        label="Calificación"
        options={RATING_OPTIONS}
        value={filters.rating?.[0] || 'all'}
        onChange={v => set('rating', v === 'all' ? undefined : [v as 'S'|'A'|'B'|'C'|'D'|'E'])}
      />

      <FilterCombobox
        label="Cumpleaños"
        options={MONTH_OPTIONS}
        value={filters.birthdayMonth?.toString() || 'all'}
        onChange={v => set('birthdayMonth', v === 'all' ? undefined : parseInt(v))}
      />

      <FilterCombobox
        label="Estado"
        options={STATUS_OPTIONS}
        value={filters.status || 'all'}
        onChange={v => set('status', v === 'all' ? undefined : v as ClientFiltersType['status'])}
      />

      {/* Days without purchase */}
      <div className="flex flex-col gap-1 w-[110px]">
        <Label className="text-xs text-muted-foreground">Días sin comprar</Label>
        <Input
          type="number"
          min="0"
          placeholder="Ej: 30"
          className="h-8 text-sm"
          value={daysSinceLastPurchase}
          onChange={e => setDaysSinceLastPurchase(e.target.value)}
        />
      </div>

      {/* Deactivation reason */}
      {filters.status === 'BAJA' && (
        <FilterCombobox
          label="Motivo de baja"
          options={DEACT_OPTIONS}
          value={filters.deactivationReason?.[0] || 'all'}
          onChange={v => set('deactivationReason', v === 'all' ? undefined : [v])}
        />
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 mt-auto gap-1 text-xs">
          <X className="h-3 w-3" />
          Limpiar
        </Button>
      )}
    </div>
  )
}
