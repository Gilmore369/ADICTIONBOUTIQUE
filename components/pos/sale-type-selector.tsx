'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * SaleTypeSelector Component
 * 
 * Allows selection between CONTADO (cash) and CREDITO (credit) sales
 * 
 * Design tokens used:
 * - Card padding: 16px
 * - Button height: 36px
 * - Spacing: 8px
 * - Border radius: 8px
 */

type SaleType = 'CONTADO' | 'CREDITO'

interface SaleTypeSelectorProps {
  value: SaleType
  onChange: (type: SaleType) => void
  disabled?: boolean
}

export function SaleTypeSelector({ value, onChange, disabled = false }: SaleTypeSelectorProps) {
  return (
    <Card className="p-4">
      <label className="text-sm font-medium mb-2 block">
        Tipo de Venta
      </label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={value === 'CONTADO' ? 'default' : 'outline'}
          className="flex-1 h-9"
          onClick={() => onChange('CONTADO')}
          disabled={disabled}
        >
          Contado
        </Button>
        <Button
          type="button"
          variant={value === 'CREDITO' ? 'default' : 'outline'}
          className="flex-1 h-9"
          onClick={() => onChange('CREDITO')}
          disabled={disabled}
        >
          Crédito
        </Button>
      </div>
    </Card>
  )
}
