'use client'

/**
 * Brands Manager Component
 * 
 * Complete CRUD interface for brands with search
 */

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CatalogTable, CatalogTableColumn } from './catalog-table'
import { CatalogFormDialog } from './catalog-form-dialog'
import { DeleteConfirmationDialog } from './delete-confirmation-dialog'
import { SearchFilter } from './search-filter'
import { BrandForm } from './brand-form'
import { createBrand, updateBrand, deleteBrand } from '@/actions/catalogs'
import { formatSafeDate } from '@/lib/utils/date'

interface Brand {
  id: string
  name: string
  description?: string
  active: boolean
  created_at: string
  supplier_brands?: Array<{
    supplier_id: string
    suppliers: { id: string; name: string } | null
  }>
}

interface Supplier {
  id: string
  name: string
}

interface BrandsManagerProps {
  initialBrands: Brand[]
  suppliers: Supplier[]
}

export function BrandsManager({ initialBrands, suppliers }: BrandsManagerProps) {
  const [brands, setBrands] = useState(initialBrands)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')

  // Filter brands by search query and supplier
  const filteredBrands = useMemo(() => {
    let result = brands
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(brand =>
        brand.name.toLowerCase().includes(query) ||
        brand.description?.toLowerCase().includes(query)
      )
    }
    
    // Filter by supplier
    if (supplierFilter) {
      result = result.filter(brand =>
        brand.supplier_brands?.some(sb => sb.supplier_id === supplierFilter)
      )
    }
    
    return result
  }, [brands, searchQuery, supplierFilter])

  const columns: CatalogTableColumn<Brand>[] = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'supplier_brands',
      label: 'Proveedores',
      render: (brand) => {
        const supplierNames = brand.supplier_brands
          ?.map(sb => sb.suppliers?.name)
          .filter(Boolean)
          .join(', ')
        return supplierNames || '-'
      }
    },
    { key: 'description', label: 'Descripción' },
    {
      key: 'created_at',
      label: 'Fecha de creación',
      render: (brand) => formatSafeDate(brand.created_at, 'dd/MM/yyyy')
    }
  ]

  const handleCreate = () => {
    setSelectedBrand(null)
    setFormOpen(true)
  }

  const handleEdit = (brand: Brand) => {
    setSelectedBrand(brand)
    setFormOpen(true)
  }

  const handleDelete = (brand: Brand) => {
    setSelectedBrand(brand)
    setDeleteOpen(true)
  }

  const handleSubmit = async (formData: FormData) => {
    if (selectedBrand) {
      return await updateBrand(selectedBrand.id, formData)
    } else {
      return await createBrand(formData)
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedBrand) return { success: false, error: 'No brand selected' }
    return await deleteBrand(selectedBrand.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Marca
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3">
        <div className="flex-1">
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar marcas..."
          />
        </div>
        <div className="w-64">
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Filtrar por Proveedor
          </label>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los proveedores</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </div>
      </div>

      <CatalogTable
        data={filteredBrands}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CatalogFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={selectedBrand ? 'Editar Marca' : 'Nueva Marca'}
        description={selectedBrand ? 'Modifica los datos de la marca' : 'Crea una nueva marca'}
        onSubmit={handleSubmit}
      >
        <BrandForm suppliers={suppliers} defaultValues={selectedBrand || undefined} />
      </CatalogFormDialog>

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar Marca"
        description="¿Estás seguro de que deseas eliminar esta marca? Esta acción no se puede deshacer."
        itemName={selectedBrand?.name}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
