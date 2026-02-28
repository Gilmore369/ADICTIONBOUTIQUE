/**
 * ProductSearch Component
 * 
 * A search component for products with debouncing (300ms) and loading states.
 * Displays search results in a dropdown list and handles product selection.
 * 
 * Features:
 * - Debounced search (300ms delay)
 * - Loading state indicator
 * - Search by product name or barcode
 * - Result limit of 50 items (enforced by API)
 * - Keyboard navigation support
 * 
 * Requirements: 4.3, 9.2
 * Task: 8.7 Create product search component with debouncing
 * 
 * @example
 * ```tsx
 * <ProductSearch
 *   onSelect={(product) => console.log('Selected:', product)}
 *   placeholder="Buscar producto..."
 * />
 * ```
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'

interface Product {
  id: string
  barcode: string | null
  name: string
  description: string | null
  size: string | null
  color: string | null
  price: number
  min_stock: number
  active: boolean
  lines: { id: string; name: string } | null
  categories: { id: string; name: string } | null
  brands: { id: string; name: string } | null
  stock?: { quantity: number } | null
}

interface ProductSearchProps {
  onSelect: (product: Product) => void
  placeholder?: string
  className?: string
  warehouse?: string
}

export function ProductSearch({
  onSelect,
  placeholder = 'Buscar por nombre o código de barras...',
  className = '',
  warehouse = 'Tienda Mujeres'
}: ProductSearchProps) {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  
  // Debounce search with 300ms delay (per requirements 4.3, 9.2)
  const debouncedSearch = useDebounce(search, 300)
  
  // Fetch products when debounced search changes
  useEffect(() => {
    const fetchProducts = async () => {
      // Only search if query has at least 1 character
      if (debouncedSearch.trim().length === 0) {
        setProducts([])
        setShowResults(false)
        return
      }
      
      setLoading(true)
      try {
        const response = await fetch(
          `/api/products/search?q=${encodeURIComponent(debouncedSearch)}&limit=50&warehouse=${warehouse}`
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch products')
        }
        
        const { data } = await response.json()
        setProducts(data || [])
        setShowResults(true)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Error fetching products:', error)
        setProducts([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchProducts()
  }, [debouncedSearch, warehouse])
  
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
  
  // Handle product selection
  const handleSelect = (product: Product) => {
    onSelect(product)
    setSearch('')
    setProducts([])
    setShowResults(false)
    setSelectedIndex(-1)
  }
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || products.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => 
          prev < products.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < products.length) {
          handleSelect(products[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowResults(false)
        setSelectedIndex(-1)
        break
    }
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
            if (products.length > 0) {
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
      {showResults && products.length > 0 && (
        <Card className="absolute z-50 mt-2 w-full max-h-96 overflow-y-auto border shadow-lg">
          <div className="divide-y">
            {products.map((product, index) => (
              <button
                key={product.id}
                onClick={() => handleSelect(product)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full p-3 text-left transition-colors hover:bg-gray-50 ${
                  selectedIndex === index ? 'bg-gray-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Product Name */}
                    <div className="font-medium text-gray-900 truncate">
                      {product.name}
                    </div>
                    
                    {/* Product Details */}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      {product.barcode && (
                        <span className="font-mono">{product.barcode}</span>
                      )}
                      {product.size && (
                        <span>• Talla: {product.size}</span>
                      )}
                      {product.color && (
                        <span>• Color: {product.color}</span>
                      )}
                      {product.stock && (
                        <span className={`font-semibold ${product.stock.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          • Stock: {product.stock.quantity}
                        </span>
                      )}
                    </div>
                    
                    {/* Category and Brand */}
                    {(product.categories || product.brands) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        {product.categories && (
                          <span>{product.categories.name}</span>
                        )}
                        {product.brands && (
                          <span>• {product.brands.name}</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Price */}
                  <div className="flex-shrink-0 text-right">
                    <div className="font-semibold text-gray-900">
                      {formatCurrency(product.price)}
                    </div>
                    {product.stock && (
                      <div className={`text-xs mt-1 ${
                        product.stock.quantity > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        Stock: {product.stock.quantity}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
      
      {/* No Results Message */}
      {showResults && !loading && products.length === 0 && debouncedSearch.trim().length > 0 && (
        <Card className="absolute z-50 mt-2 w-full border shadow-lg">
          <div className="p-4 text-center text-sm text-gray-500">
            No se encontraron productos para "{debouncedSearch}"
          </div>
        </Card>
      )}
    </div>
  )
}
