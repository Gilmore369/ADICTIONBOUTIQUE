'use client'

import { useStoreFilter } from '@/lib/contexts/store-filter-context'
import { Store } from 'lucide-react'

export function GlobalStoreFilter() {
  const { selectedStore, setSelectedStore, storeOptions } = useStoreFilter()

  return (
    <div className="flex items-center gap-2 bg-card dark:bg-gray-900 border border-border dark:border-gray-800 rounded-lg px-3 py-2">
      <Store className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <select
        value={selectedStore || 'ALL'}
        onChange={(e) => setSelectedStore(e.target.value)}
        className="text-sm font-medium bg-transparent border-none outline-none cursor-pointer text-foreground dark:text-white"
      >
        {storeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
