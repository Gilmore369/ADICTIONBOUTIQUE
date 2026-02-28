/**
 * Test page to isolate bulk-entry error
 */

'use client'

import { ColorPicker } from '@/components/ui/color-picker'
import { useState } from 'react'

export default function BulkEntryTestPage() {
  const [color, setColor] = useState('')

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Test: ColorPicker</h1>
      
      <div className="border p-4 rounded-lg">
        <ColorPicker
          label="Color de Prueba"
          value={color}
          onChange={setColor}
          placeholder="Selecciona un color"
        />
        
        {color && (
          <p className="mt-4 text-sm">
            Color seleccionado: <strong>{color}</strong>
          </p>
        )}
      </div>

      <div className="border p-4 rounded-lg bg-green-50">
        <p className="text-sm text-green-800">
          ✅ Si ves esto, el ColorPicker funciona correctamente
        </p>
      </div>
    </div>
  )
}
