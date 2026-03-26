'use client'

import { useStore, StoreFilter } from '@/contexts/store-context'
import { Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const STORE_OPTIONS: { value: StoreFilter; label: string; icon: string }[] = [
  { value: 'ALL',     label: 'Todas las Tiendas', icon: '🏬' },
  { value: 'MUJERES', label: 'Tienda Mujeres',    icon: '👗' },
  { value: 'HOMBRES', label: 'Tienda Hombres',    icon: '👔' },
]

export function StoreSelector() {
  const { selectedStore, setSelectedStore, storeName, allowedStores, isStoreLocked } = useStore()
  const [isOpen, setIsOpen] = useState(false)

  // Si está bloqueado a 1 tienda: no mostrar selector (ya está auto-seleccionado)
  if (isStoreLocked) return null

  // Filtrar solo las opciones que el usuario tiene permitidas
  const options = STORE_OPTIONS.filter(s => allowedStores.includes(s.value))

  const handleSelect = (value: StoreFilter) => {
    setSelectedStore(value)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        title={storeName}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Store className="h-5 w-5" />
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            {options.map((store) => (
              <button
                key={store.value}
                onClick={() => handleSelect(store.value)}
                className={cn(
                  'flex items-center w-full px-4 py-2 text-sm text-left',
                  'hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                  'first:rounded-t-lg last:rounded-b-lg',
                  selectedStore === store.value && 'bg-gray-100 dark:bg-gray-700'
                )}
              >
                <span className="mr-2">{store.icon}</span>
                <span className="flex-1">{store.label}</span>
                {selectedStore === store.value && (
                  <span className="ml-auto text-green-600">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
