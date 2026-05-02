'use client'

/**
 * Categories Manager Component
 * 
 * Complete CRUD interface for product categories with filters
 * Filters categories by selected store (through their lines)
 */

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { CatalogTable, CatalogTableColumn } from './catalog-table'
import { CatalogFormDialog } from './catalog-form-dialog'
import { DeleteConfirmationDialog } from './delete-confirmation-dialog'
import { ActiveInactiveToggle, InactiveBanner } from './active-inactive-toggle'
import { CategoryForm } from './category-form'
import { createCategory, updateCategory, deleteCategory, restoreCategory } from '@/actions/catalogs'
import { formatSafeDate } from '@/lib/utils/date'
import { useStore } from '@/contexts/store-context'

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

export function CategoriesManager({ initialCategories, lines: initialLines }: CategoriesManagerProps) {
  const { storeId, selectedStore } = useStore()
  const [categories, setCategories] = useState(initialCategories)
  const [lines, setLines] = useState(initialLines)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [lineFilter, setLineFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Filter lines and categories by store when store changes
  useEffect(() => {
    const filterByStore = async () => {
      if (selectedStore === 'ALL') {
        setLines(initialLines)
        setCategories(initialCategories)
      } else if (storeId) {
        try {
          // Fetch filtered lines
          const linesRes = await fetch(`/api/catalogs/lines?store_id=${storeId}`)
          const filteredLines = await linesRes.json()
          setLines(filteredLines)

          // Filter categories that belong to filtered lines
          const lineIds = filteredLines.map((l: Line) => l.id)
          const filteredCategories = initialCategories.filter(cat => 
            lineIds.includes(cat.line_id)
          )
          setCategories(filteredCategories)
        } catch (err) {
          console.error('Error filtering by store:', err)
        }
      }
    }

    filterByStore()
  }, [storeId, selectedStore, initialLines, initialCategories])

  // Filter categories by line + active state
  const filteredCategories = useMemo(() => {
    let result = categories
    result = result.filter(c => showInactive ? c.active === false : c.active !== false)
    if (lineFilter) {
      result = result.filter(cat => cat.line_id === lineFilter)
    }
    return result
  }, [categories, lineFilter, showInactive])

  const inactiveCount = useMemo(() => categories.filter(c => c.active === false).length, [categories])

  const columns: CatalogTableColumn<Category>[] = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'line_id',
      label: 'Línea',
      render: (category) => category.lines?.name || '-'
    },
    { key: 'description', label: 'Descripción' },
    {
      key: 'active',
      label: 'Estado',
      render: (category) => category.active
        ? <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">Activa</Badge>
        : <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200">Inactiva</Badge>
    },
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
    let result
    if (selectedCategory) {
      result = await updateCategory(selectedCategory.id, formData)
    } else {
      result = await createCategory(formData)
    }
    
    return result
  }

  const handleConfirmDelete = async () => {
    if (!selectedCategory) return { success: false, error: 'No category selected' }
    const result = await deleteCategory(selectedCategory.id)
    return result
  }

  const handleRestore = async (category: Category) => {
    const res = await restoreCategory(category.id)
    if (res.success) {
      setCategories(prev => prev.map(c => c.id === category.id ? { ...c, active: true } : c))
      toast.success(`Categoría "${category.name}" restaurada`)
    } else {
      toast.error(typeof res.error === 'string' ? res.error : 'Error al restaurar la categoría')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <ActiveInactiveToggle
          showInactive={showInactive}
          onChange={setShowInactive}
          inactiveCount={inactiveCount}
          activeLabel="Activas"
          inactiveLabel="Inactivas"
        />

        {!showInactive && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Categoría
          </Button>
        )}
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

      {showInactive && <InactiveBanner entityName="categorías" />}

      <CatalogTable
        data={filteredCategories}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
      />

      <CatalogFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={selectedCategory ? 'Editar Categoría' : 'Nueva Categoría'}
        description={selectedCategory ? 'Modifica los datos de la categoría' : 'Crea una nueva categoría de producto'}
        onSubmit={handleSubmit}
      >
        <CategoryForm 
          lines={lines} 
          defaultValues={selectedCategory || undefined} 
          isEditing={!!selectedCategory}
        />
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
