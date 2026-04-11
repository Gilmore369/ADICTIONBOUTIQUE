'use client'

/**
 * ColorPicker — Inline palette with named swatches + custom text input
 *
 * Modes:
 *  - default  : palette grid with labels + custom input below
 *  - compact  : mini swatches only (no labels), custom input on demand
 */

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Palette ───────────────────────────────────────────────────────────────────

export const BOUTIQUE_COLORS = [
  // Column 1 – neutrals
  { name: 'Negro',    hex: '#111111' },
  { name: 'Gris',     hex: '#6B7280' },
  { name: 'Plata',    hex: '#C0C0C0' },
  { name: 'Blanco',   hex: '#FFFFFF' },
  // Column 2 – reds/pinks
  { name: 'Rojo',     hex: '#DC2626' },
  { name: 'Vino',     hex: '#7F1D1D' },
  { name: 'Rosa',     hex: '#F472B6' },
  { name: 'Fucsia',   hex: '#EC4899' },
  // Column 3 – yellows/oranges/browns
  { name: 'Naranja',  hex: '#F97316' },
  { name: 'Amarillo', hex: '#EAB308' },
  { name: 'Beige',    hex: '#D4A574' },
  { name: 'Camel',    hex: '#C19A6B' },
  // Column 4 – greens
  { name: 'Verde',    hex: '#16A34A' },
  { name: 'Olivo',    hex: '#84894A' },
  { name: 'Menta',    hex: '#6EE7B7' },
  { name: 'Teal',     hex: '#0D9488' },
  // Column 5 – blues/purples
  { name: 'Celeste',  hex: '#38BDF8' },
  { name: 'Azul',     hex: '#2563EB' },
  { name: 'Marino',   hex: '#1E3A5F' },
  { name: 'Morado',   hex: '#7C3AED' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexForName(name: string) {
  return BOUTIQUE_COLORS.find(c => c.name.toLowerCase() === name.toLowerCase())?.hex ?? null
}

function isLight(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 140
}

// ── Swatch ────────────────────────────────────────────────────────────────────

function Swatch({
  color, selected, compact, onClick,
}: {
  color: typeof BOUTIQUE_COLORS[0]
  selected: boolean
  compact?: boolean
  onClick: () => void
}) {
  const light = isLight(color.hex)
  const whiteOutline = color.hex.toUpperCase() === '#FFFFFF' || color.hex.toUpperCase() === '#C0C0C0'

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={color.name}
        className={cn(
          'relative w-6 h-6 rounded-md transition-all hover:scale-110 flex-shrink-0',
          whiteOutline ? 'border border-gray-300' : '',
          selected ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : '',
        )}
        style={{ backgroundColor: color.hex }}
      >
        {selected && (
          <Check
            className={cn('absolute inset-0 m-auto w-3.5 h-3.5', light ? 'text-gray-800' : 'text-white')}
          />
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center gap-0.5 p-1 rounded-lg transition-all',
        'hover:bg-gray-100 dark:hover:bg-gray-700',
        selected ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400' : '',
      )}
      title={color.name}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-lg transition-transform group-hover:scale-105',
          selected ? 'scale-105 ring-2 ring-blue-400 ring-offset-1' : '',
          whiteOutline ? 'border border-gray-300' : '',
        )}
        style={{ backgroundColor: color.hex }}
      >
        {selected && (
          <div className="w-full h-full flex items-center justify-center rounded-lg">
            <Check className={cn('w-4 h-4', light ? 'text-gray-800' : 'text-white')} />
          </div>
        )}
      </div>
      <span className={cn(
        'text-[9px] font-medium leading-none text-gray-600 dark:text-gray-400 max-w-[32px] truncate',
        selected ? 'text-blue-600 dark:text-blue-400' : '',
      )}>
        {color.name}
      </span>
    </button>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  placeholder?: string
  label?: string
  /** Compact mode: mini row of swatches, text input in popover */
  compact?: boolean
}

// ── Full ColorPicker ──────────────────────────────────────────────────────────

export function ColorPicker({ value, onChange, placeholder, label, compact }: ColorPickerProps) {
  const [customText, setCustomText] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isPreset = BOUTIQUE_COLORS.some(c => c.name.toLowerCase() === value.toLowerCase())
  const selectedHex = hexForName(value)

  // When switching to custom mode, seed the text input with current value (if not preset)
  useEffect(() => {
    if (showCustom && !isPreset) {
      setCustomText(value)
    }
  }, [showCustom])

  const handlePreset = (colorName: string) => {
    onChange(colorName)
    setShowCustom(false)
    setCustomText('')
  }

  const handleCustomCommit = () => {
    const trimmed = customText.trim()
    if (trimmed) onChange(trimmed)
  }

  const clearColor = () => {
    onChange('')
    setCustomText('')
    setShowCustom(false)
  }

  if (compact) return (
    <CompactColorPicker value={value} onChange={onChange} placeholder={placeholder} />
  )

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
          {value && (
            <button type="button" onClick={clearColor}
              className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Selected color preview */}
      {value && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs">
          <div
            className="w-4 h-4 rounded-md flex-shrink-0 border border-gray-300"
            style={{ backgroundColor: selectedHex || (value.startsWith('#') ? value : '#CCCCCC') }}
          />
          <span className="font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{value}</span>
          {!label && (
            <button type="button" onClick={clearColor}
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Palette grid — 5 columns × 4 rows */}
      <div className="grid grid-cols-5 gap-0.5 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        {BOUTIQUE_COLORS.map(color => (
          <Swatch
            key={color.name}
            color={color}
            selected={value.toLowerCase() === color.name.toLowerCase()}
            onClick={() => handlePreset(color.name)}
          />
        ))}
      </div>

      {/* Custom color row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setShowCustom(!showCustom)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors',
            showCustom || (!isPreset && value)
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300',
          )}
        >
          <div className="w-3 h-3 rounded-sm border border-dashed border-current" />
          <span>Personalizado</span>
          <ChevronDown className={cn('w-3 h-3 transition-transform', showCustom ? 'rotate-180' : '')} />
        </button>

        {!isPreset && value && (
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">← {value}</span>
        )}
      </div>

      {showCustom && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            onBlur={handleCustomCommit}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCustomCommit() } }}
            placeholder={placeholder || 'Ej: Azul Marino, Verde Agua…'}
            className="flex-1 h-8 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-gray-200"
          />
          <button
            type="button"
            onClick={handleCustomCommit}
            className="px-3 h-8 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}

// ── Compact ColorPicker (for table cells) ─────────────────────────────────────

export function CompactColorPicker({ value, onChange, placeholder }: Omit<ColorPickerProps, 'compact'>) {
  const [open, setOpen] = useState(false)
  const [customText, setCustomText] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selectedHex = hexForName(value)
  const isPreset = BOUTIQUE_COLORS.some(c => c.name.toLowerCase() === value.toLowerCase())

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 w-full px-2 py-1 rounded-lg border text-xs transition-colors',
          'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600',
          'hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400',
        )}
      >
        <div
          className="w-4 h-4 rounded-md flex-shrink-0 border border-gray-300"
          style={{
            backgroundColor: selectedHex || (value?.startsWith('#') ? value : value ? '#A3A3A3' : '#E5E7EB'),
          }}
        />
        <span className="flex-1 text-left text-gray-700 dark:text-gray-300 truncate min-w-0">
          {value || <span className="text-gray-400">{placeholder || 'Color'}</span>}
        </span>
        <ChevronDown className={cn('w-3 h-3 text-gray-400 flex-shrink-0 transition-transform', open ? 'rotate-180' : '')} />
      </button>

      {/* Dropdown palette */}
      {open && (
        <div className={cn(
          'absolute z-50 mt-1 p-2 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700',
          'min-w-[200px]',
        )}>
          {/* Compact swatches */}
          <div className="grid grid-cols-5 gap-1 mb-2">
            {BOUTIQUE_COLORS.map(color => (
              <Swatch
                key={color.name}
                color={color}
                selected={value.toLowerCase() === color.name.toLowerCase()}
                compact
                onClick={() => { onChange(color.name); setOpen(false) }}
              />
            ))}
          </div>

          {/* Custom text */}
          <div className="flex gap-1 pt-1.5 border-t border-gray-100 dark:border-gray-700">
            <input
              type="text"
              value={customText || (!isPreset && value ? value : '')}
              onChange={e => setCustomText(e.target.value)}
              placeholder={placeholder || 'Personalizado…'}
              className="flex-1 h-7 px-2 text-xs border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-gray-800 dark:text-gray-200"
            />
            <button
              type="button"
              onClick={() => {
                const val = customText.trim()
                if (val) { onChange(val); setOpen(false); setCustomText('') }
              }}
              className="px-2 h-7 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
