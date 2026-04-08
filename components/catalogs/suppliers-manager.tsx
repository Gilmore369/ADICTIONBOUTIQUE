'use client'

/**
 * Suppliers Manager Component
 *
 * Complete CRUD interface for suppliers, including a product-history panel
 * that shows all products entered under each supplier.
 */

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Eye, Package, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { CatalogTable, CatalogTableColumn } from './catalog-table'
import { CatalogFormDialog } from './catalog-form-dialog'
import { DeleteConfirmationDialog } from './delete-confirmation-dialog'
import { SupplierForm } from './supplier-form'
import { SearchFilter } from './search-filter'
import { createSupplier, updateSupplier, deleteSupplier } from '@/actions/catalogs'
import { formatSafeDate } from '@/lib/utils/date'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Supplier {
  id: string
  name: string
  contact_name?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  active: boolean
  created_at: string
}

interface ProductEntry {
  id: string
  barcode: string
  name: string
  base_name: string | null
  base_code: string | null
  size: string | null
  color: string | null
  created_at: string
  entry_date: string | null
}

interface DayGroup {
  date: string           // 'YYYY-MM-DD'
  label: string          // formatted label
  products: ProductEntry[]
}

interface SuppliersManagerProps {
  initialSuppliers: Supplier[]
}

// ── Product History Modal ──────────────────────────────────────────────────────

function SupplierProductsModal({
  supplier,
  open,
  onClose,
}: {
  supplier: Supplier | null
  open: boolean
  onClose: () => void
}) {
  const [loading, setLoading]   = useState(false)
  const [groups, setGroups]     = useState<DayGroup[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loaded, setLoaded]     = useState<string | null>(null) // last loaded supplier id

  // Fetch products when modal opens or supplier changes
  const loadProducts = async (id: string) => {
    setLoading(true)
    setGroups([])
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('products')
      .select('id, barcode, name, base_name, base_code, size, color, created_at, entry_date')
      .eq('supplier_id', id)
      .order('created_at', { ascending: false })
      .limit(2000)
    setLoading(false)
    if (error || !data) return

    // Group by date (prefer entry_date, fall back to created_at)
    const map: Record<string, ProductEntry[]> = {}
    for (const p of data as ProductEntry[]) {
      const raw  = p.entry_date || p.created_at
      const date = raw ? raw.slice(0, 10) : 'sin-fecha'
      if (!map[date]) map[date] = []
      map[date].push(p)
    }

    const sorted = Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, products]) => ({
        date,
        label: date === 'sin-fecha'
          ? 'Sin fecha'
          : new Date(date + 'T12:00:00').toLocaleDateString('es-PE', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            }),
        products,
      }))

    setGroups(sorted)
    // Auto-expand first group
    if (sorted.length > 0) setExpanded(new Set([sorted[0].date]))
    setLoaded(id)
  }

  // Trigger load when supplier changes (and modal is open)
  if (open && supplier && supplier.id !== loaded && !loading) {
    loadProducts(supplier.id)
  }

  const toggleGroup = (date: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  const totalProducts = groups.reduce((s, g) => s + g.products.length, 0)

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setLoaded(null) } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-teal-600" />
            Productos de {supplier?.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay productos registrados para este proveedor</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 pr-1">
            {/* Summary bar */}
            <div className="flex items-center gap-3 mb-4 px-1">
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{totalProducts}</span> productos
                en <span className="font-semibold text-foreground">{groups.length}</span> fechas
              </span>
            </div>

            <div className="space-y-2">
              {groups.map(group => {
                const isOpen = expanded.has(group.date)
                // Unique base_names (models) in this group
                const models = [...new Set(group.products.map(p => p.base_name || p.name))]

                return (
                  <div key={group.date} className="border rounded-lg overflow-hidden">
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.date)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isOpen
                          ? <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        }
                        <div>
                          <p className="text-sm font-semibold capitalize">{group.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.products.length} variante{group.products.length !== 1 ? 's' : ''} ·{' '}
                            {models.length} modelo{models.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {group.products.length}
                      </Badge>
                    </button>

                    {/* Product rows */}
                    {isOpen && (
                      <div className="divide-y">
                        {/* Group by base_code/base_name within the day */}
                        {(() => {
                          const modelMap: Record<string, ProductEntry[]> = {}
                          for (const p of group.products) {
                            const key = p.base_code || p.base_name || p.name
                            if (!modelMap[key]) modelMap[key] = []
                            modelMap[key].push(p)
                          }
                          return Object.entries(modelMap).map(([key, variants]) => {
                            const displayName = variants[0].base_name || variants[0].name
                            const sizes  = [...new Set(variants.map(v => v.size).filter(Boolean))]
                            const colors = [...new Set(variants.map(v => v.color).filter(Boolean))]
                            return (
                              <div key={key} className="px-4 py-2.5 hover:bg-gray-50/50">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{displayName}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                      {variants[0].base_code && (
                                        <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1 rounded">
                                          {variants[0].base_code}
                                        </span>
                                      )}
                                      {sizes.length > 0 && (
                                        <span className="text-[11px] text-gray-500">
                                          Tallas: {sizes.join(', ')}
                                        </span>
                                      )}
                                      {colors.length > 0 && (
                                        <span className="text-[11px] text-gray-500">
                                          Colores: {colors.join(', ')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-[10px] flex-shrink-0">
                                    {variants.length} var.
                                  </Badge>
                                </div>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SuppliersManager({ initialSuppliers }: SuppliersManagerProps) {
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Product history modal
  const [productsOpen, setProductsOpen]             = useState(false)
  const [selectedForProducts, setSelectedForProducts] = useState<Supplier | null>(null)

  const columns: CatalogTableColumn<Supplier>[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'contact_name', label: 'Contacto' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'email', label: 'Email' },
    {
      key: 'created_at',
      label: 'Fecha de creación',
      render: (supplier) => formatSafeDate(supplier.created_at, 'dd/MM/yyyy')
    },
    {
      key: '_products' as any,
      label: 'Productos',
      render: (supplier) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setSelectedForProducts(supplier)
            setProductsOpen(true)
          }}
          className="inline-flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors"
          title="Ver productos de este proveedor"
        >
          <Eye className="h-3.5 w-3.5" />
          Ver productos
        </button>
      ),
    },
  ]

  const handleCreate = () => {
    setSelectedSupplier(null)
    setFormOpen(true)
  }

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setFormOpen(true)
  }

  const handleDelete = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setDeleteOpen(true)
  }

  const handleSubmit = async (formData: FormData) => {
    if (selectedSupplier) {
      return await updateSupplier(selectedSupplier.id, formData)
    } else {
      return await createSupplier(formData)
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedSupplier) return { success: false, error: 'No supplier selected' }
    return await deleteSupplier(selectedSupplier.id)
  }

  // Filter suppliers by search query
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return suppliers

    const query = searchQuery.toLowerCase()
    return suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(query) ||
      supplier.contact_name?.toLowerCase().includes(query) ||
      supplier.email?.toLowerCase().includes(query) ||
      supplier.phone?.toLowerCase().includes(query)
    )
  }, [suppliers, searchQuery])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      <SearchFilter
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Buscar por nombre, contacto, email o teléfono..."
      />

      <CatalogTable
        data={filteredSuppliers}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CatalogFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={selectedSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        description={selectedSupplier ? 'Modifica los datos del proveedor' : 'Crea un nuevo proveedor'}
        onSubmit={handleSubmit}
      >
        <SupplierForm
          defaultValues={selectedSupplier || undefined}
          isEditing={!!selectedSupplier}
        />
      </CatalogFormDialog>

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar Proveedor"
        description="¿Estás seguro de que deseas eliminar este proveedor? Esta acción no se puede deshacer."
        itemName={selectedSupplier?.name}
        onConfirm={handleConfirmDelete}
      />

      {/* Product history modal */}
      <SupplierProductsModal
        supplier={selectedForProducts}
        open={productsOpen}
        onClose={() => { setProductsOpen(false); setSelectedForProducts(null) }}
      />
    </div>
  )
}
