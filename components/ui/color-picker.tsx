'use client'

/**
 * Color Picker Component
 * 
 * Visual color selector with predefined palette for boutique products
 * 
 * Design Tokens:
 * - Border radius: 999px (circles)
 * - Spacing: 8px between colors
 * - Size: 32px circles
 * 
 * Features:
 * - Predefined color palette
 * - Visual selection with circles
 * - Custom color input fallback
 * - Shows selected color name
 */

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Input } from './input'
import { Label } from './label'

interface ColorOption {
  name: string
  hex: string
}

const BOUTIQUE_COLORS: ColorOption[] = [
  { name: 'Negro', hex: '#000000' },
  { name: 'Blanco', hex: '#FFFFFF' },
  { name: 'Rojo', hex: '#DC2626' },
  { name: 'Azul', hex: '#2563EB' },
  { name: 'Verde', hex: '#16A34A' },
  { name: 'Amarillo', hex: '#EAB308' },
  { name: 'Rosa', hex: '#EC4899' },
  { name: 'Beige', hex: '#D4A574' },
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  placeholder?: string
  label?: string
}

export function ColorPicker({ value, onChange, placeholder, label }: ColorPickerProps) {
  const [showCustom, setShowCustom] = useState(false)

  const handleColorSelect = (colorName: string) => {
    onChange(colorName)
    setShowCustom(false)
  }

  const isColorSelected = (colorName: string) => {
    return value.toLowerCase() === colorName.toLowerCase()
  }

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs">{label}</Label>}
      
      {/* Color Palette */}
      <div className="flex flex-wrap gap-2">
        {BOUTIQUE_COLORS.map((color) => {
          const selected = isColorSelected(color.name)
          return (
            <button
              key={color.name}
              type="button"
              onClick={() => handleColorSelect(color.name)}
              className={`
                relative w-8 h-8 rounded-full transition-all
                ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:scale-110'}
                ${color.hex === '#FFFFFF' ? 'border border-gray-300' : ''}
              `}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            >
              {selected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check 
                    className="h-4 w-4" 
                    style={{ 
                      color: color.hex === '#FFFFFF' || color.hex === '#EAB308' || color.hex === '#D4A574' 
                        ? '#000000' 
                        : '#FFFFFF' 
                    }} 
                  />
                </div>
              )}
            </button>
          )
        })}
        
        {/* Custom color button */}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className={`
            w-8 h-8 rounded-full border-2 border-dashed border-gray-400
            flex items-center justify-center text-gray-500 hover:border-gray-600
            transition-colors text-xs font-bold
            ${showCustom ? 'bg-gray-100' : ''}
          `}
          title="Color personalizado"
        >
          +
        </button>
      </div>

      {/* Selected color display */}
      {value && !showCustom && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div 
            className="w-4 h-4 rounded-full border border-gray-300"
            style={{ 
              backgroundColor: BOUTIQUE_COLORS.find(c => c.name.toLowerCase() === value.toLowerCase())?.hex || '#CCCCCC' 
            }}
          />
          <span className="font-medium">{value}</span>
        </div>
      )}

      {/* Custom color input */}
      {showCustom && (
        <div className="pt-2">
          <Input
            type="text"
            placeholder={placeholder || "Ej: Azul Marino"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Escribe un color personalizado
          </p>
        </div>
      )}
    </div>
  )
}
