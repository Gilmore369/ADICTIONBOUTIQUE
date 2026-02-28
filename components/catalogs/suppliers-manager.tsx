'use client'

/**
 * Suppliers Manager Component
 * 
 * Complete CRUD interface for suppliers
 */

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CatalogTable, CatalogTableColumn } from './catalog-table'
import { CatalogFormDialog } from './catalog-form-dialog'
import { DeleteConfirmationDialog } from './delete-confirmation-dialog'
import { SupplierForm } from './supplier-form'
import { SearchFilter } from './search-filter'
import { createSupplier, updateSupplier, deleteSupplier } from '@/actions/catalogs'
import { formatSafeDate } from '@/lib/utils/date'

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

interface SuppliersManagerProps {
  initialSuppliers: Supplier[]
}

export function SuppliersManager({ initialSuppliers }: SuppliersManagerProps) {
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const columns: CatalogTableColumn<Supplier>[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'contact_name', label: 'Contacto' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'email', label: 'Email' },
    {
      key: 'created_at',
      label: 'Fecha de creación',
      render: (supplier) => formatSafeDate(supplier.created_at, 'dd/MM/yyyy')
    }
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
        <SupplierForm defaultValues={selectedSupplier || undefined} />
      </CatalogFormDialog>

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar Proveedor"
        description="¿Estás seguro de que deseas eliminar este proveedor? Esta acción no se puede deshacer."
        itemName={selectedSupplier?.name}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
