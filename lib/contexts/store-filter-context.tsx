'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface StoreFilterContextType {
  selectedStore: string | null
  setSelectedStore: (store: string | null) => void
  storeOptions: Array<{ value: string; label: string }>
}

const StoreFilterContext = createContext<StoreFilterContextType | undefined>(undefined)

const STORE_OPTIONS = [
  { value: 'ALL', label: 'Todas las Tiendas' },
  { value: 'Tienda Mujeres', label: 'Tienda Mujeres' },
  { value: 'Tienda Hombres', label: 'Tienda Hombres' }
]

export function StoreFilterProvider({ children }: { children: ReactNode }) {
  const [selectedStore, setSelectedStoreState] = useState<string | null>('ALL')

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('global_store_filter')
    if (stored) {
      setSelectedStoreState(stored)
    }
  }, [])

  // Save to localStorage when changed
  const setSelectedStore = (store: string | null) => {
    const value = store || 'ALL'
    setSelectedStoreState(value)
    localStorage.setItem('global_store_filter', value)
    
    // Trigger storage event for other components
    window.dispatchEvent(new Event('storage'))
  }

  return (
    <StoreFilterContext.Provider
      value={{
        selectedStore,
        setSelectedStore,
        storeOptions: STORE_OPTIONS
      }}
    >
      {children}
    </StoreFilterContext.Provider>
  )
}

export function useStoreFilter() {
  const context = useContext(StoreFilterContext)
  if (context === undefined) {
    throw new Error('useStoreFilter must be used within a StoreFilterProvider')
  }
  return context
}
