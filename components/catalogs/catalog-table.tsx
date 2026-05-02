'use client'

/**
 * Generic Catalog Table Component
 * 
 * Reusable table component for displaying catalog data (lines, categories, brands, sizes, suppliers)
 * Features:
 * - Responsive design with shadcn/ui Table
 * - Action buttons (edit, delete)
 * - Loading skeleton support
 * - Design tokens compliance
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, RotateCcw } from 'lucide-react'

export interface CatalogTableColumn<T> {
  key: keyof T | string
  label: string
  render?: (item: T) => React.ReactNode
}

interface CatalogTableProps<T> {
  data: T[]
  columns: CatalogTableColumn<T>[]
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  /** Si se pasa, muestra botón "Restaurar" cuando item.active === false */
  onRestore?: (item: T) => void
  idKey?: keyof T
}

export function CatalogTable<T extends Record<string, any>>({
  data,
  columns,
  onEdit,
  onDelete,
  onRestore,
  idKey = 'id' as keyof T
}: CatalogTableProps<T>) {
  const hasActions = !!(onEdit || onDelete || onRestore)
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={String(column.key)}>{column.label}</TableHead>
            ))}
            {hasActions && (
              <TableHead className="text-right">Acciones</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (hasActions ? 1 : 0)}
                className="text-center text-muted-foreground h-24"
              >
                No hay datos disponibles
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => {
              const isInactive = item.active === false
              return (
              <TableRow key={String(item[idKey])} className={isInactive ? 'opacity-60' : ''}>
                {columns.map((column) => (
                  <TableCell key={String(column.key)}>
                    {column.render
                      ? column.render(item)
                      : String(item[column.key] ?? '-')}
                  </TableCell>
                ))}
                {hasActions && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {/* Si está inactivo, mostramos solo Restaurar */}
                      {isInactive && onRestore && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRestore(item)}
                          className="h-8 px-2 text-green-700 hover:text-green-800 hover:bg-green-50"
                          title="Restaurar"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restaurar
                        </Button>
                      )}
                      {/* Si está activo, mostramos editar/eliminar */}
                      {!isInactive && onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(item)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                      )}
                      {!isInactive && onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(item)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
