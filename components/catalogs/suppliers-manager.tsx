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
import { Plus, Eye, Package, ChevronDown, ChevronRight, Loader2, Hash } from 'lucide-react'
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

// ── Types ──────────────────────────────────────────────────────────────────────

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
  stock: { quantity: number }[] | null
}

/** One model group (same base_code) within a day */
interface ModelGroup {
  key: string
  displayName: string
  baseCode: string | null
  variants: ProductEntry[]
  /** sizes ordered */
  sizes: string[]
  /** colors ordered */
  colors: string[]
  /** qty[color][size] */
  grid: Record<string, Record<string, number>>
  totalQty: number
}

interface DayGroup {
  date: string
  label: string
  models: ModelGroup[]
  totalVariants: number
  totalQty: number
}

interface SuppliersManagerProps {
  initialSuppliers: Supplier[]
}

// ── Size ordering ─────────────────────────────────────────────────────────────

const SIZE_ORDER = ['XS','S','M','L','XL','XXL','2XL','3XL','UNICA','ÚNICA',
  '28','30','32','34','36','38','40','42','44','46']

function sortSizes(sizes: string[]) {
  return [...sizes].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a.toUpperCase())
    const bi = SIZE_ORDER.indexOf(b.toUpperCase())
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b, undefined, { numeric: true })
  })
}

// ── Build model groups ────────────────────────────────────────────────────────

function buildDayGroups(data: ProductEntry[]): DayGroup[] {
  const dayMap: Record<string, ProductEntry[]> = {}
  for (const p of data) {
    const raw  = p.entry_date || p.created_at
    const date = raw ? raw.slice(0, 10) : 'sin-fecha'
    if (!dayMap[date]) dayMap[date] = []
    dayMap[date].push(p)
  }

  return Object.entries(dayMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, products]) => {
      // Group by base_code within the day
      const modelMap: Record<string, ProductEntry[]> = {}
      for (const p of products) {
        const key = p.base_code || p.base_name || p.name
        if (!modelMap[key]) modelMap[key] = []
        modelMap[key].push(p)
      }

      const models: ModelGroup[] = Object.entries(modelMap).map(([key, variants]) => {
        const sizes  = sortSizes([...new Set(variants.map(v => v.size).filter(Boolean) as string[])])
        const colors = [...new Set(variants.map(v => v.color).filter(Boolean) as string[])]

        // Build grid[color][size] = quantity
        const grid: Record<string, Record<string, number>> = {}
        for (const v of variants) {
          const c = v.color || '(sin color)'
          const s = v.size  || '(única)'
          if (!grid[c]) grid[c] = {}
          const qty = Array.isArray(v.stock)
            ? v.stock.reduce((sum, st) => sum + (st.quantity || 0), 0)
            : 0
          grid[c][s] = (grid[c][s] || 0) + qty
        }

        const totalQty = Object.values(grid)
          .flatMap(row => Object.values(row))
          .reduce((s, q) => s + q, 0)

        return {
          key,
          displayName: variants[0].base_name || variants[0].name,
          baseCode: variants[0].base_code,
          variants,
          sizes: sizes.length ? sizes : ['(única)'],
          colors: colors.length ? colors : ['(sin color)'],
          grid,
          totalQty,
        }
      })

      const totalVariants = models.reduce((s, m) => s + m.variants.length, 0)
      const totalQty      = models.reduce((s, m) => s + m.totalQty, 0)

      return {
        date,
        label: date === 'sin-fecha'
          ? 'Sin fecha'
          : new Date(date + 'T12:00:00').toLocaleDateString('es-PE', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            }),
        models,
        totalVariants,
        totalQty,
      }
    })
}

// ── ModelCard ─────────────────────────────────────────────────────────────────

function ModelCard({ model }: { model: ModelGroup }) {
  const hasMultiColor = model.colors.length > 1 || (model.colors[0] && model.colors[0] !== '(sin color)')
  const hasMultiSize  = model.sizes.length > 1  || (model.sizes[0]  && model.sizes[0]  !== '(única)')

  return (
    <div className="py-3 px-4">
      {/* Model header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{model.displayName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {model.baseCode && (
              <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {model.baseCode}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {model.variants.length} variante{model.variants.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-teal-700">{model.totalQty} uds</p>
          <p className="text-[10px] text-muted-foreground">en stock</p>
        </div>
      </div>

      {/* Grid: rows = colors, cols = sizes */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {/* Color header col */}
              {hasMultiColor && (
                <th className="text-left text-[10px] font-medium text-gray-400 pb-1 pr-2 min-w-[80px]">
                  Color
                </th>
              )}
              {model.sizes.map(size => (
                <th key={size} className="text-center font-semibold text-gray-600 pb-1 px-1.5 min-w-[36px]">
                  {size}
                </th>
              ))}
              <th className="text-center font-semibold text-gray-500 pb-1 px-1.5 min-w-[36px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {model.colors.map((color, ci) => {
              const rowQty = model.sizes.reduce((s, size) => s + (model.grid[color]?.[size] || 0), 0)
              return (
                <tr key={color} className={ci % 2 === 0 ? 'bg-gray-50/60' : ''}>
                  {hasMultiColor && (
                    <td className="pr-2 py-1 text-[11px] text-gray-600 font-medium capitalize truncate max-w-[100px]">
                      {color}
                    </td>
                  )}
                  {model.sizes.map(size => {
                    const qty = model.grid[color]?.[size] || 0
                    return (
                      <td key={size} className="text-center py-1 px-1.5">
                        {qty > 0 ? (
                          <span className={`inline-flex items-center justify-center w-7 h-6 rounded text-xs font-bold ${
                            qty >= 5 ? 'bg-teal-100 text-teal-700' :
                            qty >= 2 ? 'bg-blue-50 text-blue-600' :
                            'bg-orange-50 text-orange-600'
                          }`}>
                            {qty}
                          </span>
                        ) : (
                          <span className="text-gray-200 text-[10px]">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="text-center py-1 px-1.5">
                    <span className="inline-flex items-center justify-center w-7 h-6 rounded bg-gray-200 text-gray-700 text-xs font-bold">
                      {rowQty}
                    </span>
                  </td>
                </tr>
              )
            })}
            {/* Total row */}
            {(hasMultiColor || model.colors.length > 1) && (
              <tr className="border-t border-gray-200">
                {hasMultiColor && (
                  <td className="pr-2 py-1 text-[10px] font-semibold text-gray-500 uppercase">
                    Total
                  </td>
                )}
                {model.sizes.map(size => {
                  const colQty = model.colors.reduce((s, c) => s + (model.grid[c]?.[size] || 0), 0)
                  return (
                    <td key={size} className="text-center py-1 px-1.5">
                      <span className="inline-flex items-center justify-center w-7 h-6 rounded bg-gray-700 text-white text-xs font-bold">
                        {colQty}
                      </span>
                    </td>
                  )
                })}
                <td className="text-center py-1 px-1.5">
                  <span className="inline-flex items-center justify-center w-7 h-6 rounded bg-teal-600 text-white text-xs font-bold">
                    {model.totalQty}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
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
  const [loaded, setLoaded]     = useState<string | null>(null)

  const loadProducts = async (id: string) => {
    setLoading(true)
    setGroups([])
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('products')
      .select('id, barcode, name, base_name, base_code, size, color, created_at, entry_date, stock(quantity)')
      .eq('supplier_id', id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(2000)
    setLoading(false)
    if (error || !data) return

    const built = buildDayGroups(data as ProductEntry[])
    setGroups(built)
    if (built.length > 0) setExpanded(new Set([built[0].date]))
    setLoaded(id)
  }

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

  const totalVariants = groups.reduce((s, g) => s + g.totalVariants, 0)
  const totalQty      = groups.reduce((s, g) => s + g.totalQty, 0)
  const totalModels   = groups.reduce((s, g) => s + g.models.length, 0)

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setLoaded(null) } }}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
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
          <div className="overflow-y-auto flex-1">
            {/* Summary strip */}
            <div className="flex items-center gap-4 px-1 pb-3 pt-1 border-b mb-3">
              <div className="flex items-center gap-1.5 text-sm">
                <Hash className="h-3.5 w-3.5 text-teal-500" />
                <span className="font-semibold">{totalModels}</span>
                <span className="text-muted-foreground">modelos</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="text-sm">
                <span className="font-semibold">{totalVariants}</span>
                <span className="text-muted-foreground"> variantes</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="text-sm">
                <span className="font-semibold text-teal-700">{totalQty}</span>
                <span className="text-muted-foreground"> unidades en stock</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="text-sm text-muted-foreground">
                {groups.length} fecha{groups.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="space-y-2 pb-2">
              {groups.map(group => {
                const isOpen = expanded.has(group.date)
                return (
                  <div key={group.date} className="border rounded-lg overflow-hidden">
                    {/* Day header */}
                    <button
                      onClick={() => toggleGroup(group.date)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 transition-colors text-left"
                    >
                      {isOpen
                        ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold capitalize text-gray-800">{group.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {group.models.length} modelo{group.models.length !== 1 ? 's' : ''} ·{' '}
                          {group.totalVariants} variante{group.totalVariants !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                          {group.totalQty} uds
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {group.totalVariants}
                        </Badge>
                      </div>
                    </button>

                    {/* Models */}
                    {isOpen && (
                      <div className="divide-y">
                        {group.models.map(model => (
                          <ModelCard key={model.key} model={model} />
                        ))}
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
