'use client'

/**
 * Model Search Component
 * 
 * Busca modelos existentes por nombre base y permite cargar sus datos
 * para actualizar stock o crear variantes
 */

import { useState, useEffect, useRef } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, X } from 'lucide-react'

interface ProductVariant {
  id: string
  barcode: string | null
  name: string
  size: string | null
  color: string | null
  price: number
  purchase_price: number | null
}

interface ModelResult {
  baseName: string
  baseProduct: ProductVariant & {
    line_id: string | null
    category_id: string | null
    brand_id: string | null
    supplier_id: string | null
    image_url: string | null
    lines: { id: string; name: string } | null
    categories: { id: string; name: string } | null
    brands: { id: string; name: string } | null
  }
  variants: ProductVariant[]
}

interface ModelSearchProps {
  supplierId: string
  onSelect: (model: ModelResult) => void
  placeholder?: string
}

export function ModelSearch({
  supplierId,
  onSelect,
  placeholder = 'Buscar modelo existente...'
}: ModelSearchProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<ModelResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    const fetchModels = async () => {
      if (debouncedSearch.trim().length < 2) {
        setResults([])
        setShowResults(false)
        return
      }

      setLoading(true)
      try {
        const response = await fetch(
          `/api/products/search-by-name?q=${encodeURIComponent(debouncedSearch)}&supplier_id=${supplierId}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch models')
        }

        const { data } = await response.json()
        setResults(data || [])
        setShowResults(true)
      } catch (error) {
        console.error('Error fetching models:', error)
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    fetchModels()
  }, [debouncedSearch, supplierId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (model: ModelResult) => {
    onSelect(model)
    setSearch('')
    setResults([])
    setShowResults(false)
  }

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => {
            if (results.length > 0) {
              setShowResults(true)
            }
          }}
          className="pl-10"
        />
        {search && (
          <button
            onClick={() => {
              setSearch('')
              setResults([])
              setShowResults(false)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <Card className="absolute z-50 mt-2 w-full max-h-96 overflow-y-auto border shadow-lg">
          <div className="divide-y">
            {results.map((model, index) => (
              <button
                key={`${model.baseName}-${index}`}
                onClick={() => handleSelect(model)}
                className="w-full p-3 text-left transition-colors hover:bg-gray-50"
              >
                <div className="space-y-2">
                  {/* Model Name */}
                  <div className="font-semibold text-gray-900">
                    {model.baseName}
                  </div>

                  {/* Base Product Info */}
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {model.baseProduct.barcode}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {model.baseProduct.categories && (
                        <Badge variant="outline" className="text-xs">
                          {model.baseProduct.categories.name}
                        </Badge>
                      )}
                      {model.baseProduct.brands && (
                        <Badge variant="outline" className="text-xs">
                          {model.baseProduct.brands.name}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Variants */}
                  {model.variants.length > 1 && (
                    <div className="text-xs text-gray-500">
                      {model.variants.length} variantes disponibles
                      {model.variants.map(v => v.color).filter(Boolean).length > 0 && (
                        <span>
                          {' '}
                          (Colores: {[...new Set(model.variants.map(v => v.color).filter(Boolean))].join(', ')})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {showResults && !loading && results.length === 0 && debouncedSearch.trim().length >= 2 && (
        <Card className="absolute z-50 mt-2 w-full border shadow-lg">
          <div className="p-4 text-center text-sm text-gray-500">
            No se encontraron modelos para "{debouncedSearch}"
          </div>
        </Card>
      )}
    </div>
  )
}
