'use client'

/**
 * Sizes Manager Component
 * 
 * Complete CRUD interface for sizes with filters
 */

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CatalogTable, CatalogTableColumn } from './catalog-table'
import { CatalogFormDialog } from './catalog-form-dialog'
import { DeleteConfirmationDialog } from './delete-confirmation-dialog'
import { SizeForm } from './size-form'
import { createSize, updateSize, deleteSize } from '@/actions/catalogs'
import { formatSafeDate } from '@/lib/utils/date'

interface Size {
  id: string
  name: string
  category_id: string
  active: boolean
  created_at: string
  categories?: { name: string; line_id?: string }
}

interface Category {
  id: string
  name: string
  line_id?: string
}

interface Line {
  id: string
  name: string
}

interface SizesManagerProps {
  initialSizes: Size[]
  categories: Category[]
  lines: Line[]
}

export function SizesManager({ initialSizes, categories, lines }: SizesManagerProps) {
  const [sizes, setSizes] = useState(initialSizes)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedSize, setSelectedSize] = useState<Size | null>(null)
  
  // Filters
  const [lineFilter, setLineFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Filter sizes - INDEPENDIENTES
  const filteredSizes = useMemo(() => {
    let result = sizes
    
    // Filtrar por línea (si está seleccionada)
    if (lineFilter) {
      const lineCategoryIds = categories
        .filter(c => c.line_id === lineFilter)
        .map(c => c.id)
      result = result.filter(s => lineCategoryIds.includes(s.category_id))
    }
    
    // Filtrar por categoría (si está seleccionada) - INDEPENDIENTE
    if (categoryFilter) {
      result = result.filter(s => s.category_id === categoryFilter)
    }
    
    return result
  }, [sizes, categoryFilter, lineFilter, categories])

  const columns: CatalogTableColumn<Size>[] = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'category_id',
      label: 'Categoría',
      render: (size) => size.categories?.name || '-'
    },
    {
      key: 'active',
      label: 'Estado',
      render: (size) => size.active ? 'Activo' : 'Inactivo'
    },
    {
      key: 'created_at',
      label: 'Fecha de creación',
      render: (size) => formatSafeDate(size.created_at, 'dd/MM/yyyy')
    }
  ]

  const handleCreate = () => {
    setSelectedSize(null)
    setFormOpen(true)
  }

  const handleEdit = (size: Size) => {
    setSelectedSize(size)
    setFormOpen(true)
  }

  const handleDelete = (size: Size) => {
    setSelectedSize(size)
    setDeleteOpen(true)
  }

  const handleSubmit = async (formData: FormData) => {
    if (selectedSize) {
      return await updateSize(selectedSize.id, formData)
    } else {
      return await createSize(formData)
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedSize) return { success: false, error: 'No size selected' }
    return await deleteSize(selectedSize.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Talla
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="w-64">
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Filtrar por Línea
          </label>
          <select
            value={lineFilter}
            onChange={(e) => setLineFilter(e.target.value)}
            className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las líneas</option>
            {lines.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="w-64">
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Filtrar por Categoría
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las categorías</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <CatalogTable
        data={filteredSizes}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CatalogFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={selectedSize ? 'Editar Talla' : 'Nueva Talla'}
        description={selectedSize ? 'Modifica los datos de la talla' : 'Crea una nueva talla'}
        onSubmit={handleSubmit}
      >
        <SizeForm categories={categories} defaultValues={selectedSize || undefined} />
      </CatalogFormDialog>

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar Talla"
        description="¿Estás seguro de que deseas eliminar esta talla? Esta acción no se puede deshacer."
        itemName={selectedSize?.name}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
