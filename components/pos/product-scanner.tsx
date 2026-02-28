'use client'

import { useState, useEffect, useRef } from 'react'
import { Barcode } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

/**
 * ProductScanner Component
 * 
 * Handles barcode scanning input for POS
 * 
 * Design tokens used:
 * - Card padding: 16px
 * - Spacing: 8px, 16px
 * - Border radius: 8px
 */

interface ProductScannerProps {
  onScan: (barcode: string) => void
  disabled?: boolean
}

export function ProductScanner({ onScan, disabled = false }: ProductScannerProps) {
  const [barcode, setBarcode] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Auto-focus input on mount
    if (inputRef.current && !disabled) {
      inputRef.current.focus()
    }
  }, [disabled])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (barcode.trim()) {
      onScan(barcode.trim())
      setBarcode('')
      // Re-focus input for next scan
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
          <Barcode className="h-5 w-5 text-gray-500" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Escanear código de barras..."
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            disabled={disabled}
            className="flex-1"
            autoComplete="off"
          />
        </div>
      </form>
    </Card>
  )
}
