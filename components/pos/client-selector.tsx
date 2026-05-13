'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { formatCurrency } from '@/lib/utils/currency'

/**
 * ClientSelector Component
 * 
 * Allows searching and selecting a client for credit sales
 * Uses 300ms debounce for search performance
 * 
 * Design tokens used:
 * - Card padding: 16px
 * - Spacing: 8px, 16px
 * - Border radius: 8px
 */

interface Client {
  id: string
  name: string
  dni?: string
  credit_limit: number
  credit_used: number
}

interface ClientSelectorProps {
  value: Client | null
  onChange: (client: Client | null) => void
  disabled?: boolean
  required?: boolean
}

export function ClientSelector({ value, onChange, disabled = false, required = false }: ClientSelectorProps) {
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Debounce search with 300ms delay
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (debouncedSearch.length >= 3) {
      fetchClients(debouncedSearch)
    } else {
      setClients([])
      setShowResults(false)
    }
  }, [debouncedSearch])

  async function fetchClients(query: string) {
    setLoading(true)
    try {
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(query)}&limit=50`)
      const { data } = await response.json()
      setClients(data || [])
      setShowResults(true)
    } catch (error) {
      console.error('Error fetching clients:', error)
      setClients([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectClient = (client: Client) => {
    onChange(client)
    setSearch('')
    setShowResults(false)
    setClients([])
  }

  const handleClearClient = () => {
    onChange(null)
    setSearch('')
  }

  return (
    <Card className="p-4">
      <label className="text-sm font-medium mb-2 block">
        Cliente {required && <span className="text-red-500">*</span>}
      </label>

      {value ? (
        <div className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{value.name}</div>
            {value.dni && (
              <div className="text-xs text-gray-500">DNI: {value.dni}</div>
            )}
            {/* Mostrar deuda Y crédito disponible por separado para evitar confusiones */}
            <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
              {value.credit_used > 0 && (
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                  ⚠ Deuda: {formatCurrency(value.credit_used)}
                </span>
              )}
              <span className="text-muted-foreground">
                Crédito disponible:{' '}
                <strong className={value.credit_limit - value.credit_used <= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                  {formatCurrency(Math.max(0, value.credit_limit - value.credit_used))}
                </strong>
                <span className="text-muted-foreground/70"> / {formatCurrency(value.credit_limit)}</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearClient}
            disabled={disabled}
            className="text-sm text-red-600 hover:text-red-700 ml-2"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-500 absolute left-3" />
            <Input
              type="text"
              placeholder="Buscar cliente por nombre o DNI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={disabled}
              className="pl-9"
              autoComplete="off"
            />
          </div>

          {loading && (
            <div className="absolute top-full left-0 right-0 mt-1 p-2 border rounded-lg bg-white shadow-sm">
              <div className="text-sm text-gray-500">Buscando...</div>
            </div>
          )}

          {!loading && showResults && clients.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 border rounded-lg bg-white shadow-sm max-h-64 overflow-y-auto z-10">
              {clients.map((client) => {
                const debt = client.credit_used
                const available = Math.max(0, client.credit_limit - client.credit_used)
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    className="w-full p-2 text-left hover:bg-muted/30 transition border-b last:border-b-0"
                  >
                    <div className="font-medium text-sm">{client.name}</div>
                    {client.dni && (
                      <div className="text-xs text-gray-500">DNI: {client.dni}</div>
                    )}
                    <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                      {debt > 0 && (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          ⚠ Debe: {formatCurrency(debt)}
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        Disponible: <strong className={available <= 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          {formatCurrency(available)}
                        </strong>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {!loading && showResults && clients.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 p-2 border rounded-lg bg-white shadow-sm">
              <div className="text-sm text-gray-500">No se encontraron clientes</div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
