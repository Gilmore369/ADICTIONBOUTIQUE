'use client'

/**
 * Lines Manager Component
 * 
 * Complete CRUD interface for product lines
 * Integrates table, form dialog, and delete confirmation
 * Filters lines by selected store
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
import { LineForm } from './line-form'
import { SearchFilter } from './search-filter'
import { createLine, updateLine, deleteLine, restoreLine } from '@/actions/catalogs'
import { formatSafeDate } from '@/lib/utils/date'
import { useStore } from '@/contexts/store-context'

interface Line {
  id: string
  name: string
  description?: string
  active: boolean
  created_at: string
}

interface LinesManagerProps {
  initialLines: Line[]
}

export function LinesManager({ initialLines }: LinesManagerProps) {
  const { storeId, selectedStore } = useStore()
  const [lines, setLines] = useState(initialLines)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedLine, setSelectedLine] = useState<Line | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Filter lines by store when store changes
  useEffect(() => {
    const filterLinesByStore = async () => {
      if (selectedStore === 'ALL') {
        setLines(initialLines)
      } else if (storeId) {
        // Filter lines that belong to the selected store
        try {
          const response = await fetch(`/api/catalogs/lines?store_id=${storeId}`)
          const data = await response.json()
          setLines(data || [])
        } catch (err) {
          console.error('Error filtering lines:', err)
          setLines(initialLines)
        }
      }
    }

    filterLinesByStore()
  }, [storeId, selectedStore, initialLines])

  const columns: CatalogTableColumn<Line>[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'description', label: 'Descripción' },
    {
      key: 'active',
      label: 'Estado',
      render: (line) => line.active
        ? <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">Activa</Badge>
        : <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200">Inactiva</Badge>
    },
    {
      key: 'created_at',
      label: 'Fecha de creación',
      render: (line) => formatSafeDate(line.created_at, 'dd/MM/yyyy')
    }
  ]

  const handleCreate = () => {
    setSelectedLine(null)
    setFormOpen(true)
  }

  const handleEdit = (line: Line) => {
    setSelectedLine(line)
    setFormOpen(true)
  }

  const handleDelete = (line: Line) => {
    setSelectedLine(line)
    setDeleteOpen(true)
  }

  const handleSubmit = async (formData: FormData) => {
    if (selectedLine) {
      return await updateLine(selectedLine.id, formData)
    } else {
      return await createLine(formData)
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedLine) return { success: false, error: 'No line selected' }
    return await deleteLine(selectedLine.id)
  }

  const handleRestore = async (line: Line) => {
    const res = await restoreLine(line.id)
    if (res.success) {
      setLines(prev => prev.map(l => l.id === line.id ? { ...l, active: true } : l))
      toast.success(`Línea "${line.name}" restaurada`)
    } else {
      toast.error(typeof res.error === 'string' ? res.error : 'Error al restaurar la línea')
    }
  }

  // Filter lines by search query + active state
  const filteredLines = useMemo(() => {
    let result = lines

    // Por defecto SOLO activas. Si showInactive, solo INACTIVAS
    result = result.filter(l => showInactive ? l.active === false : l.active !== false)

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(line =>
        line.name.toLowerCase().includes(query) ||
        line.description?.toLowerCase().includes(query)
      )
    }

    return result
  }, [lines, searchQuery, showInactive])

  const inactiveCount = useMemo(() => lines.filter(l => l.active === false).length, [lines])

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
            Nueva Línea
          </Button>
        )}
      </div>

      <SearchFilter
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Buscar por nombre o descripción..."
      />

      {showInactive && <InactiveBanner entityName="líneas" />}

      <CatalogTable
        data={filteredLines}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
      />

      <CatalogFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={selectedLine ? 'Editar Línea' : 'Nueva Línea'}
        description={selectedLine ? 'Modifica los datos de la línea' : 'Crea una nueva línea de producto'}
        onSubmit={handleSubmit}
      >
        <LineForm 
          defaultValues={selectedLine || undefined} 
          isEditing={!!selectedLine}
        />
      </CatalogFormDialog>

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar Línea"
        description="¿Estás seguro de que deseas eliminar esta línea? Esta acción no se puede deshacer."
        itemName={selectedLine?.name}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
