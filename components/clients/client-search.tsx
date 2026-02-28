/**
 * ClientSearch Component
 * 
 * A search component for clients with debouncing (300ms) and loading states.
 * Displays search results in a dropdown list and handles client selection.
 * 
 * Features:
 * - Debounced search (300ms delay)
 * - Loading state indicator
 * - Search by client name or DNI
 * - Result limit of 50 items (enforced by API)
 * - Display credit information in results
 * - Keyboard navigation support
 * 
 * Requirements: 14.1
 * Task: 9.4 Create client UI components
 * 
 * @example
 * ```tsx
 * <ClientSearch
 *   onSelect={(client) => console.log('Selected:', client)}
 *   placeholder="Buscar cliente..."
 * />
 * ```
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'

interface Client {
  id: string
  dni: string | null
  name: string
  phone: string | null
  email: string | null
  address: string | null
  credit_limit: number
  credit_used: number
  active: boolean
}

interface ClientSearchProps {
  onSelect: (client: Client) => void
  placeholder?: string
  className?: string
}

export function ClientSearch({
  onSelect,
  placeholder = 'Buscar por nombre o DNI...',
  className = '',
}: ClientSearchProps) {
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  
  // Debounce search with 300ms delay (per requirements)
  const debouncedSearch = useDebounce(search, 300)
  
  // Fetch clients when debounced search changes
  useEffect(() => {
    const fetchClients = async () => {
      // Only search if query has at least 1 character
      if (debouncedSearch.trim().length === 0) {
        setClients([])
        setShowResults(false)
        return
      }
      
      setLoading(true)
      try {
        const response = await fetch(
          `/api/clients/search?q=${encodeURIComponent(debouncedSearch)}&limit=50`
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch clients')
        }
        
        const { data } = await response.json()
        setClients(data || [])
        setShowResults(true)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Error fetching clients:', error)
        setClients([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchClients()
  }, [debouncedSearch])
  
  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Handle client selection
  const handleSelect = (client: Client) => {
    onSelect(client)
    setSearch('')
    setClients([])
    setShowResults(false)
    setSelectedIndex(-1)
  }
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || clients.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => 
          prev < clients.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < clients.length) {
          handleSelect(clients[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowResults(false)
        setSelectedIndex(-1)
        break
    }
  }
  
  // Calculate available credit
  const getAvailableCredit = (client: Client) => {
    return client.credit_limit - client.credit_used
  }
  
  // Get credit status color
  const getCreditStatusColor = (client: Client) => {
    const available = getAvailableCredit(client)
    const usagePercent = client.credit_limit > 0 
      ? (client.credit_used / client.credit_limit) * 100 
      : 0

    if (usagePercent >= 100) return 'text-red-600'
    if (usagePercent >= 80) return 'text-yellow-600'
    return 'text-green-600'
  }
  
  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (clients.length > 0) {
              setShowResults(true)
            }
          }}
          className="w-full"
        />
        
        {/* Loading Indicator */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          </div>
        )}
      </div>
      
      {/* Search Results Dropdown */}
      {showResults && clients.length > 0 && (
        <Card className="absolute z-50 mt-2 w-full max-h-96 overflow-y-auto border shadow-lg">
          <div className="divide-y">
            {clients.map((client, index) => {
              const available = getAvailableCredit(client)
              const statusColor = getCreditStatusColor(client)
              
              return (
                <button
                  key={client.id}
                  onClick={() => handleSelect(client)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full p-3 text-left transition-colors hover:bg-gray-50 ${
                    selectedIndex === index ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Client Name */}
                      <div className="font-medium text-gray-900 truncate">
                        {client.name}
                      </div>
                      
                      {/* Client Details */}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        {client.dni && (
                          <span className="font-mono">DNI: {client.dni}</span>
                        )}
                        {client.phone && (
                          <span>• Tel: {client.phone}</span>
                        )}
                      </div>
                      
                      {/* Credit Information */}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-500">
                          Límite: {formatCurrency(client.credit_limit)}
                        </span>
                        <span className="text-gray-500">
                          • Usado: {formatCurrency(client.credit_used)}
                        </span>
                        <span className={`font-semibold ${statusColor}`}>
                          • Disponible: {formatCurrency(available)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </Card>
      )}
      
      {/* No Results Message */}
      {showResults && !loading && clients.length === 0 && debouncedSearch.trim().length > 0 && (
        <Card className="absolute z-50 mt-2 w-full border shadow-lg">
          <div className="p-4 text-center text-sm text-gray-500">
            No se encontraron clientes para "{debouncedSearch}"
          </div>
        </Card>
      )}
    </div>
  )
}
