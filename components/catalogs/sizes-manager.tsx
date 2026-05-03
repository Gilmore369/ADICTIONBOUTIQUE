'use client'

/**
 * Sizes Manager Component
 * 
 * Complete CRUD interface for sizes with filters
 * Filters sizes by selected store (through categories and lines)
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
import { SizeForm } from './size-form'
import { createSize, updateSize, deleteSize, restoreSize } from '@/actions/catalogs'
import { formatSafeDate } from '@/lib/utils/date'
import { useStore } from '@/contexts/store-context'

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

export function SizesManager({ initialSizes, categories: initialCategories, lines: initialLines }: SizesManagerProps) {
  const { storeId, selectedStore } = useStore()
  const [sizes, setSizes] = useState(initialSizes)
  const [categories, setCategories] = useState(initialCategories)
  const [lines, setLines] = useState(initialLines)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedSize, setSelectedSize] = useState<Size | null>(null)
  
  // Filters
  const [lineFilter, setLineFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Filter by store when store changes
  useEffect(() => {
    const filterByStore = async () => {
      if (selectedStore === 'ALL') {
        setLines(initialLines)
        setCategories(initialCategories)
        setSizes(initialSizes)
      } else if (storeId) {
        try {
          // Fetch filtered lines
          const linesRes = await fetch(`/api/catalogs/lines?store_id=${storeId}`)
          const filteredLines = await linesRes.json()
          setLines(filteredLines)

          // Filter categories that belong to filtered lines
          const lineIds = filteredLines.map((l: Line) => l.id)
          const filteredCategories = initialCategories.filter(cat => 
            cat.line_id && lineIds.includes(cat.line_id)
          )
          setCategories(filteredCategories)

          // Filter sizes that belong to filtered categories
          const categoryIds = filteredCategories.map(c => c.id)
          const filteredSizes = initialSizes.filter(size => 
            categoryIds.includes(size.category_id)
          )
          setSizes(filteredSizes)
        } catch (err) {
          console.error('Error filtering by store:', err)
        }
      }
    }

    filterByStore()
  }, [storeId, selectedStore, initialLines, initialCategories, initialSizes])

  // Filter sizes - INDEPENDIENTES
  const filteredSizes = useMemo(() => {
    let result = sizes

    // Por defecto SOLO activas. Si showInactive, solo INACTIVAS (para restaurarlas)
    if (showInactive) {
      result = result.filter(s => s.active === false)
    } else {
      result = result.filter(s => s.active !== false)
    }

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
  }, [sizes, categoryFilter, lineFilter, categories, showInactive])

  // Conteo de inactivas para mostrar badge en el toggle
  const inactiveCount = useMemo(() => sizes.filter(s => s.active === false).length, [sizes])

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
      render: (size) => size.active
        ? <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">Activo</Badge>
        : <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200">Inactivo</Badge>
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

  const handleRestore = async (size: Size) => {
    const res = await restoreSize(size.id)
    if (res.success) {
      // Actualizar estado local
      setSizes(prev => prev.map(s => s.id === size.id ? { ...s, active: true } : s))
      toast.success(`Talla "${size.name}" restaurada`)
    } else {
      toast.error(typeof res.error === 'string' ? res.error : 'Error al restaurar la talla')
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
            Nueva Talla
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

      {showInactive && <InactiveBanner entityName="tallas" />}

      <CatalogTable
        data={filteredSizes}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
      />

      <CatalogFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={selectedSize ? 'Editar Talla' : 'Nueva Talla'}
        description={selectedSize ? 'Modifica los datos de la talla' : 'Crea una nueva talla'}
        onSubmit={handleSubmit}
      >
        <SizeForm
          categories={categories}
          lines={lines}
          defaultValues={selectedSize || undefined}
          isEditing={!!selectedSize}
        />
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
