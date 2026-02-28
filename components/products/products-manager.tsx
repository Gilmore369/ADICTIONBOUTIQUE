/**
 * ProductsManager Component
 * 
 * Main component for managing products catalog. Integrates ProductsTable, 
 * ProductSearch, and ProductForm in a dialog for create/edit operations.
 * 
 * Features:
 * - Display products in table with sorting and filtering
 * - Search products with debouncing
 * - Create new products via dialog
 * - Edit existing products
 * - Delete products (soft delete)
 * 
 * Design Tokens:
 * - Spacing: 16px, 24px
 * - Border radius: 8px (standard)
 * - Button height: 36px
 * 
 * Requirements: 4.1, 9.1
 * Task: 8.10 Create products page
 */

'use client'

import { useState, useMemo } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { ProductsTable } from './products-table'
import { ProductForm } from './product-form'
import { ProductFormMultiSize } from './product-form-multi-size'
import { SearchFilter } from '@/components/catalogs/search-filter'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Layers } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { deleteProduct } from '@/actions/catalogs'

interface Product {
  id: string
  barcode: string | null
  name: string
  description: string | null
  line_id: string | null
  category_id: string | null
  brand_id: string | null
  supplier_id: string | null
  size: string | null
  color: string | null
  presentation: string | null
  purchase_price: number | null
  price: number
  min_stock: number
  entry_date: string | null
  image_url: string | null
  active: boolean
  lines: { id: string; name: string } | null
  categories: { id: string; name: string } | null
  brands: { id: string; name: string } | null
  stock?: { quantity: number } | null
}

interface ProductsManagerProps {
  initialProducts: Product[]
  lines: { id: string; name: string }[]
  categories: { id: string; name: string; line_id: string }[]
}

export function ProductsManager({ initialProducts, lines, categories }: ProductsManagerProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [useMultiSizeForm, setUseMultiSizeForm] = useState(false)
  const [filterLine, setFilterLine] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  // Debounce search query (300ms)
  const debouncedSearch = useDebounce(searchQuery, 300)

  // Handle create product (single size)
  const handleCreate = () => {
    setEditingProduct(null)
    setUseMultiSizeForm(false)
    setDialogOpen(true)
  }

  // Handle create product (multi size)
  const handleCreateMultiSize = () => {
    setEditingProduct(null)
    setUseMultiSizeForm(true)
    setDialogOpen(true)
  }

  // Handle edit product
  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setUseMultiSizeForm(false)
    setDialogOpen(true)
  }

  // Handle delete product (soft delete)
  const handleDelete = async (product: Product) => {
    if (!confirm(`¿Está seguro de eliminar el producto "${product.name}"?`)) {
      return
    }

    try {
      const result = await deleteProduct(product.id)

      if (!result.success) {
        throw new Error(result.error as string || 'Error deleting product')
      }

      // Remove from local state
      setProducts(products.filter((p) => p.id !== product.id))

      toast.success('Producto eliminado', `El producto "${product.name}" ha sido eliminado correctamente.`)

      // Refresh the page data
      router.refresh()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Error al eliminar el producto')
    }
  }

  // Handle form success (create or update)
  const handleFormSuccess = (product?: Product) => {
    if (editingProduct && product) {
      // Update existing product in local state
      setProducts(products.map((p) => (p.id === product.id ? product : p)))
      toast.success('Producto actualizado', `El producto "${product.name}" ha sido actualizado correctamente.`)
    } else {
      // For multi-size creation, just show success message
      toast.success('Productos creados', 'Los productos han sido creados correctamente.')
    }

    setDialogOpen(false)
    setEditingProduct(null)

    // Refresh the page data
    router.refresh()
  }

  // Handle form cancel
  const handleFormCancel = () => {
    setDialogOpen(false)
    setEditingProduct(null)
  }

  // Filter products by line, category, and search (INDEPENDIENTES)
  const filteredProducts = useMemo(() => {
    let filtered = products

    // Filter by line
    if (filterLine) {
      filtered = filtered.filter(p => p.line_id === filterLine)
    }

    // Filter by category
    if (filterCategory) {
      filtered = filtered.filter(p => p.category_id === filterCategory)
    }

    // Filter by search (debounced)
    if (debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase()
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.barcode?.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower)
      )
    }

    return filtered
  }, [products, filterLine, filterCategory, debouncedSearch])

  return (
    <div className="space-y-6">
      {/* Header with title and create button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Productos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona el catálogo de productos (mostrando {filteredProducts.length} de {products.length})
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreate} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Producto Simple
          </Button>
          <Button onClick={handleCreateMultiSize} className="gap-2">
            <Layers className="h-4 w-4" />
            Múltiples Tallas
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar por nombre, código o descripción..."
          />
        </div>

        <div className="w-64">
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Filtrar por Línea
          </label>
          <select
            value={filterLine}
            onChange={(e) => setFilterLine(e.target.value)}
            className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las líneas</option>
            {lines.map(line => (
              <option key={line.id} value={line.id}>{line.name}</option>
            ))}
          </select>
        </div>

        <div className="w-64">
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Filtrar por Categoría
          </label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las categorías</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <ProductsTable
        products={filteredProducts}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct 
                ? 'Editar Producto' 
                : useMultiSizeForm 
                  ? 'Crear Productos con Múltiples Tallas' 
                  : 'Nuevo Producto'}
            </DialogTitle>
          </DialogHeader>
          {editingProduct ? (
            <ProductForm
              mode="edit"
              initialData={editingProduct}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          ) : useMultiSizeForm ? (
            <ProductFormMultiSize
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          ) : (
            <ProductForm
              mode="create"
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
