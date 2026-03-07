'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type StoreFilter = 'ALL' | 'MUJERES' | 'HOMBRES'

interface StoreContextType {
  selectedStore: StoreFilter
  setSelectedStore: (store: StoreFilter) => void
  storeId: string | null
  storeName: string
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [selectedStore, setSelectedStoreState] = useState<StoreFilter>('ALL')
  const [storeId, setStoreId] = useState<string | null>(null)

  // Cargar preferencia del localStorage
  useEffect(() => {
    const saved = localStorage.getItem('selectedStore')
    if (saved && (saved === 'ALL' || saved === 'MUJERES' || saved === 'HOMBRES')) {
      setSelectedStoreState(saved as StoreFilter)
    }
  }, [])

  // Guardar preferencia en localStorage
  const setSelectedStore = (store: StoreFilter) => {
    setSelectedStoreState(store)
    localStorage.setItem('selectedStore', store)
  }

  // Obtener el store_id basado en la selección
  useEffect(() => {
    const fetchStoreId = async () => {
      if (selectedStore === 'ALL') {
        setStoreId(null)
        return
      }

      try {
        const response = await fetch(`/api/stores?code=${selectedStore}`)
        if (response.ok) {
          const data = await response.json()
          setStoreId(data.id)
        }
      } catch (error) {
        console.error('Error fetching store ID:', error)
      }
    }

    fetchStoreId()
  }, [selectedStore])

  const storeName = 
    selectedStore === 'ALL' ? 'Todas las Tiendas' :
    selectedStore === 'MUJERES' ? 'Tienda Mujeres' :
    'Tienda Hombres'

  return (
    <StoreContext.Provider value={{ selectedStore, setSelectedStore, storeId, storeName }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return context
}
