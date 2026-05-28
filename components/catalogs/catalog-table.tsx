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

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, RotateCcw, Search, X } from 'lucide-react'

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
  /** Buscador integrado (default true). */
  searchable?: boolean
  searchPlaceholder?: string
}

/** Coincidencia genérica: busca el texto en cualquier campo string/number del item
 *  (incluye objetos anidados con .name, ej. línea de una categoría). */
function itemMatches<T extends Record<string, any>>(item: T, q: string): boolean {
  const ql = q.toLowerCase()
  for (const v of Object.values(item)) {
    if (v == null) continue
    if (typeof v === 'string' || typeof v === 'number') {
      if (String(v).toLowerCase().includes(ql)) return true
    } else if (typeof v === 'object' && (v as any).name) {
      if (String((v as any).name).toLowerCase().includes(ql)) return true
    }
  }
  return false
}

export function CatalogTable<T extends Record<string, any>>({
  data,
  columns,
  onEdit,
  onDelete,
  onRestore,
  idKey = 'id' as keyof T,
  searchable = true,
  searchPlaceholder = 'Buscar…',
}: CatalogTableProps<T>) {
  const hasActions = !!(onEdit || onDelete || onRestore)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return data
    return data.filter((item) => itemMatches(item, q))
  }, [data, query])

  return (
    <div className="space-y-2">
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8 pr-8 h-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {searchable && query && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} de {data.length}
        </p>
      )}
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
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (hasActions ? 1 : 0)}
                className="text-center text-muted-foreground h-24"
              >
                {query ? `Sin resultados para "${query}"` : 'No hay datos disponibles'}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((item) => {
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
    </div>
  )
}
