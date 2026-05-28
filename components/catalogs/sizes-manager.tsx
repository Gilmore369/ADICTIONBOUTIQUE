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
import { Plus, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { CatalogTable, CatalogTableColumn } from './catalog-table'
import { CatalogFormDialog } from './catalog-form-dialog'
import { DeleteConfirmationDialog } from './delete-confirmation-dialog'
import { ActiveInactiveToggle, InactiveBanner } from './active-inactive-toggle'
import { SizeForm } from './size-form'
import { SearchableSelect } from '@/components/ui/searchable-select'
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
  const [nameSearch, setNameSearch] = useState('')

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

    // Búsqueda por nombre de talla
    const q = nameSearch.trim().toLowerCase()
    if (q) {
      result = result.filter(s => (s.name || '').toLowerCase().includes(q))
    }

    return result
  }, [sizes, categoryFilter, lineFilter, categories, showInactive, nameSearch])

  // Conteo de inactivas para mostrar badge en el toggle
  const inactiveCount = useMemo(() => sizes.filter(s => s.active === false).length, [sizes])

  // Paginación cliente — 50 por página (la tabla tenía 696 filas → lag)
  const PAGE_SIZE = 50
  const [currentPage, setCurrentPage] = useState(1)
  useEffect(() => { setCurrentPage(1) }, [categoryFilter, lineFilter, showInactive])
  const totalPages = Math.max(1, Math.ceil(filteredSizes.length / PAGE_SIZE))
  const pagedSizes = useMemo(
    () => filteredSizes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredSizes, currentPage]
  )

  // Reset a página 1 al buscar/filtrar
  useEffect(() => { setCurrentPage(1) }, [nameSearch, lineFilter, categoryFilter, showInactive])

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
      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs font-medium text-foreground/80 mb-1 block">
            Buscar talla
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder="Buscar por nombre de talla… (S, M, 38, 6 1/2)"
              className="pl-8 pr-8 h-9"
            />
            {nameSearch && (
              <button
                type="button"
                onClick={() => setNameSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="w-64">
          <label className="text-xs font-medium text-foreground/80 mb-1 block">
            Filtrar por Línea
          </label>
          <SearchableSelect
            options={[
              { value: '', label: 'Todas las líneas' },
              ...lines.map(l => ({ value: l.id, label: l.name })),
            ]}
            value={lineFilter}
            onChange={(v) => { setLineFilter(v); setCategoryFilter('') }}
            placeholder="Todas las líneas"
            searchPlaceholder="Buscar línea…"
          />
        </div>

        <div className="w-64">
          <label className="text-xs font-medium text-foreground/80 mb-1 block">
            Filtrar por Categoría
          </label>
          <SearchableSelect
            options={[
              { value: '', label: lineFilter ? 'Todas las categorías' : 'Elige línea primero' },
              ...categories
                .filter(c => !lineFilter || c.line_id === lineFilter)
                .map(c => ({ value: c.id, label: c.name })),
            ]}
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder={lineFilter ? 'Todas las categorías' : 'Elige línea primero'}
            searchPlaceholder="Buscar categoría…"
            disabled={!lineFilter}
          />
        </div>
      </div>

      {showInactive && <InactiveBanner entityName="tallas" />}

      <CatalogTable
        data={pagedSizes}
        columns={columns}
        searchable={false}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Página {currentPage} de {totalPages} · {filteredSizes.length} tallas
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0"
              disabled={currentPage === 1}
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
                    onClick={() => setCurrentPage(p as number)}>
                    {p}
                  </Button>
                )
              )}
            <Button variant="outline" size="sm" className="h-7 w-7 p-0"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

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
