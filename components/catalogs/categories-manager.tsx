'use client'

/**
 * Categories Manager Component
 * 
 * Complete CRUD interface for product categories with filters
 */

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CatalogTable, CatalogTableColumn } from './catalog-table'
import { CatalogFormDialog } from './catalog-form-dialog'
import { DeleteConfirmationDialog } from './delete-confirmation-dialog'
import { CategoryForm } from './category-form'
import { createCategory, updateCategory, deleteCategory } from '@/actions/catalogs'
import { formatSafeDate } from '@/lib/utils/date'

interface Category {
  id: string
  name: string
  line_id: string
  description?: string
  active: boolean
  created_at: string
  lines?: { name: string }
}

interface Line {
  id: string
  name: string
}

interface CategoriesManagerProps {
  initialCategories: Category[]
  lines: Line[]
}

export function CategoriesManager({ initialCategories, lines }: CategoriesManagerProps) {
  const [categories, setCategories] = useState(initialCategories)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [lineFilter, setLineFilter] = useState('')

  // Filter categories by line
  const filteredCategories = useMemo(() => {
    if (!lineFilter) return categories
    return categories.filter(cat => cat.line_id === lineFilter)
  }, [categories, lineFilter])

  const columns: CatalogTableColumn<Category>[] = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'line_id',
      label: 'Línea',
      render: (category) => category.lines?.name || '-'
    },
    { key: 'description', label: 'Descripción' },
    {
      key: 'created_at',
      label: 'Fecha de creación',
      render: (category) => formatSafeDate(category.created_at, 'dd/MM/yyyy')
    }
  ]

  const handleCreate = () => {
    setSelectedCategory(null)
    setFormOpen(true)
  }

  const handleEdit = (category: Category) => {
    setSelectedCategory(category)
    setFormOpen(true)
  }

  const handleDelete = (category: Category) => {
    setSelectedCategory(category)
    setDeleteOpen(true)
  }

  const handleSubmit = async (formData: FormData) => {
    if (selectedCategory) {
      return await updateCategory(selectedCategory.id, formData)
    } else {
      return await createCategory(formData)
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedCategory) return { success: false, error: 'No category selected' }
    return await deleteCategory(selectedCategory.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Categoría
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
            {lines.map(line => (
              <option key={line.id} value={line.id}>{line.name}</option>
            ))}
          </select>
        </div>
      </div>

      <CatalogTable
        data={filteredCategories}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CatalogFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={selectedCategory ? 'Editar Categoría' : 'Nueva Categoría'}
        description={selectedCategory ? 'Modifica los datos de la categoría' : 'Crea una nueva categoría de producto'}
        onSubmit={handleSubmit}
      >
        <CategoryForm lines={lines} defaultValues={selectedCategory || undefined} />
      </CatalogFormDialog>

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar Categoría"
        description="¿Estás seguro de que deseas eliminar esta categoría? Esta acción no se puede deshacer."
        itemName={selectedCategory?.name}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
