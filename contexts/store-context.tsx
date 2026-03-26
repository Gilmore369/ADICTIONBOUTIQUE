'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type StoreFilter = 'ALL' | 'MUJERES' | 'HOMBRES'

interface StoreContextType {
  selectedStore: StoreFilter
  setSelectedStore: (store: StoreFilter) => void
  storeId: string | null
  storeName: string
  allowedStores: StoreFilter[]   // tiendas que este usuario puede ver
  isStoreLocked: boolean         // true si el usuario solo tiene acceso a 1 tienda
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

interface StoreProviderProps {
  children: ReactNode
  /** Stores del perfil del usuario, ej. ["MUJERES"] o ["MUJERES","HOMBRES"] */
  userStores?: string[]
}

export function StoreProvider({ children, userStores }: StoreProviderProps) {
  // Calcular tiendas permitidas basándose en el perfil
  const allowedStores: StoreFilter[] = (() => {
    if (!userStores || userStores.length === 0) return ['ALL', 'MUJERES', 'HOMBRES']
    const valid = userStores
      .map(s => s.toUpperCase())
      .filter(s => s === 'MUJERES' || s === 'HOMBRES') as StoreFilter[]
    if (valid.length === 0) return ['ALL', 'MUJERES', 'HOMBRES']
    // Si tiene acceso a ambas, agregar ALL al inicio
    if (valid.length >= 2) return ['ALL', ...valid]
    return valid  // solo 1 tienda: no mostrar "Todas"
  })()

  // Si solo tiene 1 tienda, está bloqueado en esa
  const isStoreLocked = allowedStores.length === 1

  const defaultStore: StoreFilter = isStoreLocked ? allowedStores[0] : 'ALL'

  const [selectedStore, setSelectedStoreState] = useState<StoreFilter>(defaultStore)
  const [storeId, setStoreId] = useState<string | null>(null)

  // Restaurar preferencia del localStorage (solo si no está bloqueado)
  useEffect(() => {
    if (isStoreLocked) {
      setSelectedStoreState(defaultStore)
      return
    }
    const saved = localStorage.getItem('selectedStore')
    if (saved && allowedStores.includes(saved as StoreFilter)) {
      setSelectedStoreState(saved as StoreFilter)
    }
  }, [])

  // Guardar preferencia
  const setSelectedStore = (store: StoreFilter) => {
    if (isStoreLocked) return  // no permitir cambio si está bloqueado
    if (!allowedStores.includes(store)) return
    setSelectedStoreState(store)
    localStorage.setItem('selectedStore', store)
  }

  // Obtener el store_id UUID desde la API
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
        } else {
          setStoreId(null)
        }
      } catch {
        setStoreId(null)
      }
    }
    fetchStoreId()
  }, [selectedStore])

  const storeName =
    selectedStore === 'ALL'     ? 'Todas las Tiendas' :
    selectedStore === 'MUJERES' ? 'Tienda Mujeres' :
    'Tienda Hombres'

  return (
    <StoreContext.Provider value={{
      selectedStore, setSelectedStore, storeId, storeName,
      allowedStores, isStoreLocked,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (context === undefined) throw new Error('useStore must be used within a StoreProvider')
  return context
}
