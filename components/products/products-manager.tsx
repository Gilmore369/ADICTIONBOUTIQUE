'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { ProductsTable } from './products-table'
import { ProductForm } from './product-form'
import { ProductCreateModal } from './product-create-modal'
import { SearchFilter } from '@/components/catalogs/search-filter'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Printer, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { generateBarcodePdf, type BarcodeItem } from '@/lib/barcodes/generate-barcode-pdf'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { deleteProduct } from '@/actions/catalogs'
import { useStore } from '@/contexts/store-context'

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
  initialTotal: number
  lines: { id: string; name: string }[]
  categories: { id: string; name: string; line_id: string }[]
}

const PAGE_SIZE = 100

export function ProductsManager({ initialProducts, initialTotal, lines: initialLines, categories: initialCategories }: ProductsManagerProps) {
  const { selectedStore, storeId } = useStore()
  const [products, setProducts]     = useState<Product[]>(initialProducts)
  const [total, setTotal]           = useState(initialTotal)
  const [lines, setLines]           = useState(initialLines)
  const [categories, setCategories] = useState(initialCategories)
  const [loading, setLoading]       = useState(false)

  const [dialogOpen, setDialogOpen]       = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingProduct, setEditingProduct]   = useState<Product | null>(null)

  const [filterLine, setFilterLine]         = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [searchQuery, setSearchQuery]       = useState('')
  const [currentPage, setCurrentPage]       = useState(1)

  const debouncedSearch = useDebounce(searchQuery, 350)
  const router = useRouter()

  // Build API URL from current state
  const buildUrl = useCallback((page: number, search: string, line: string, cat: string, store: string) => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))
    if (search) params.set('search', search)
    if (line)   params.set('line_id', line)
    if (cat)    params.set('category_id', cat)
    if (store)  params.set('store_id', store)
    return `/api/catalogs/products?${params.toString()}`
  }, [])

  // Fetch products from API
  const fetchProducts = useCallback(async (page: number, search: string, line: string, cat: string, store: string) => {
    setLoading(true)
    try {
      const res = await fetch(buildUrl(page, search, line, cat, store))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setProducts(json.products || [])
      setTotal(json.total || 0)
      if (json.lines)      setLines(json.lines)
      if (json.categories) setCategories(json.categories)
    } catch (e) {
      console.error('Error loading products:', e)
      toast.error('Error al cargar productos', 'Intenta de nuevo o recarga la página')
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  // Re-fetch when store changes (reset all filters)
  useEffect(() => {
    setFilterLine('')
    setFilterCategory('')
    setSearchQuery('')
    setCurrentPage(1)
    fetchProducts(1, '', '', '', storeId || '')
  }, [selectedStore, storeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when search/filter changes (reset to page 1)
  useEffect(() => {
    setCurrentPage(1)
    fetchProducts(1, debouncedSearch, filterLine, filterCategory, storeId || '')
  }, [debouncedSearch, filterLine, filterCategory]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when page changes
  useEffect(() => {
    fetchProducts(currentPage, debouncedSearch, filterLine, filterCategory, storeId || '')
  }, [currentPage]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Handle create product
  const handleCreate = () => setCreateModalOpen(true)

  // Barcode printing — current page / filter result
  const handlePrintLabels = (useStock: boolean) => {
    const items: BarcodeItem[] = products
      .filter(p => p.barcode)
      .map(p => ({
        barcode: p.barcode!,
        name: p.name,
        size: p.size,
        color: p.color,
        price: p.price,
        quantity: useStock ? Math.max(1, p.stock?.quantity ?? 1) : 1,
      }))
    if (items.length === 0) {
      toast.error('Sin productos', 'No hay productos con código de barras en esta vista')
      return
    }
    try {
      generateBarcodePdf(items, {
        title: useStock
          ? `Etiquetas (×stock) — ${new Date().toLocaleDateString('es-PE')}`
          : `Etiquetas (1×SKU) — ${new Date().toLocaleDateString('es-PE')}`,
        showPrice: true,
      })
      const totalItems = items.reduce((s, x) => s + x.quantity, 0)
      toast.success('PDF generado', `${items.length} SKU(s) · ${totalItems} etiqueta(s)`)
    } catch (e) {
      toast.error('Error', e instanceof Error ? e.message : 'No se pudo generar el PDF')
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setDialogOpen(true)
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`¿Está seguro de eliminar el producto "${product.name}"?`)) return
    try {
      const result = await deleteProduct(product.id)
      if (!result.success) throw new Error(result.error as string || 'Error deleting product')
      setProducts(prev => prev.filter(p => p.id !== product.id))
      setTotal(t => t - 1)
      toast.success('Producto eliminado', `El producto "${product.name}" ha sido eliminado correctamente.`)
      router.refresh()
    } catch (error) {
      toast.error('Error', error instanceof Error ? error.message : 'Error al eliminar el producto')
    }
  }

  const handleFormSuccess = (product?: Product) => {
    if (editingProduct && product) {
      setProducts(prev => prev.map(p => p.id === product.id ? product : p))
      toast.success('Producto actualizado', `"${product.name}" actualizado correctamente.`)
    }
    setDialogOpen(false)
    setEditingProduct(null)
    router.refresh()
  }

  const handleFormCancel = () => {
    setDialogOpen(false)
    setEditingProduct(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Productos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? 'Cargando...'
              : `${total.toLocaleString('es-PE')} productos${filterLine || filterCategory || debouncedSearch ? ' (filtrado)' : ''} · página ${currentPage} de ${totalPages}`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handlePrintLabels(false)}
            disabled={products.length === 0 || loading}
            className="gap-2"
            title="1 etiqueta por SKU (página actual)"
          >
            <Printer className="h-4 w-4" />
            Etiquetas (1×SKU)
          </Button>
          <Button
            variant="outline"
            onClick={() => handlePrintLabels(true)}
            disabled={products.length === 0 || loading}
            className="gap-2"
            title="Una etiqueta por unidad en stock (página actual)"
          >
            <Printer className="h-4 w-4" />
            Etiquetas (×stock)
          </Button>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar por nombre o código de barras..."
          />
        </div>

        <div className="w-64">
          <label className="text-xs font-medium text-foreground/85 mb-1 block">
            Filtrar por Línea
          </label>
          <select
            value={filterLine}
            onChange={e => {
              setFilterLine(e.target.value)
              if (filterCategory) {
                const cat = categories.find(c => c.id === filterCategory)
                if (cat && cat.line_id !== e.target.value) setFilterCategory('')
              }
            }}
            className="w-full h-9 px-3 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las líneas</option>
            {lines.map(line => (
              <option key={line.id} value={line.id}>{line.name}</option>
            ))}
          </select>
        </div>

        <div className="w-64">
          <label className="text-xs font-medium text-foreground/85 mb-1 block">
            Filtrar por Categoría
          </label>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full h-9 px-3 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!filterLine}
            title={!filterLine ? 'Elige una línea primero' : ''}
          >
            <option value="">{filterLine ? 'Todas las categorías' : 'Elige línea primero'}</option>
            {categories
              .filter(cat => !filterLine || cat.line_id === filterLine)
              .map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
          </select>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando productos...
        </div>
      )}

      {/* Products Table */}
      <div className={loading ? 'opacity-50 pointer-events-none' : ''}>
        <ProductsTable
          products={products}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Página {currentPage} de {totalPages} · {total.toLocaleString('es-PE')} productos
            · mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0"
              disabled={currentPage === 1 || loading}
              onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, idx) =>
                p === '...' ? (
                  <span key={`dots-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                  <Button key={p}
                    variant={currentPage === p ? 'default' : 'outline'}
                    size="sm" className="h-7 min-w-[28px] px-2 text-xs"
                    disabled={loading}
                    onClick={() => setCurrentPage(p as number)}>
                    {p}
                  </Button>
                )
              )}
            <Button variant="outline" size="sm" className="h-7 w-7 p-0"
              disabled={currentPage === totalPages || loading}
              onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* New unified create modal */}
      <ProductCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          router.refresh()
          // Reload current page to reflect new product
          fetchProducts(currentPage, debouncedSearch, filterLine, filterCategory, storeId || '')
        }}
      />

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <ProductForm
              mode="edit"
              initialData={editingProduct}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
