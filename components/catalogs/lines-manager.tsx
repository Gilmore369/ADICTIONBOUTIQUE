'use client'

/**
 * Lines Manager Component
 * 
 * Complete CRUD interface for product lines
 * Integrates table, form dialog, and delete confirmation
 */

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CatalogTable, CatalogTableColumn } from './catalog-table'
import { CatalogFormDialog } from './catalog-form-dialog'
import { DeleteConfirmationDialog } from './delete-confirmation-dialog'
import { LineForm } from './line-form'
import { SearchFilter } from './search-filter'
import { createLine, updateLine, deleteLine } from '@/actions/catalogs'
import { formatSafeDate } from '@/lib/utils/date'

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
  const [lines, setLines] = useState(initialLines)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedLine, setSelectedLine] = useState<Line | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const columns: CatalogTableColumn<Line>[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'description', label: 'Descripción' },
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

  // Filter lines by search query
  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return lines

    const query = searchQuery.toLowerCase()
    return lines.filter(line =>
      line.name.toLowerCase().includes(query) ||
      line.description?.toLowerCase().includes(query)
    )
  }, [lines, searchQuery])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Línea
        </Button>
      </div>

      <SearchFilter
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Buscar por nombre o descripción..."
      />

      <CatalogTable
        data={filteredLines}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CatalogFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={selectedLine ? 'Editar Línea' : 'Nueva Línea'}
        description={selectedLine ? 'Modifica los datos de la línea' : 'Crea una nueva línea de producto'}
        onSubmit={handleSubmit}
      >
        <LineForm defaultValues={selectedLine || undefined} />
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
