/**
 * Collection Actions Table Component
 * 
 * Displays collection actions with action type, result, follow-up date, and notes.
 * 
 * Requirements: 8.3
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'
import { getActionTypeLabel, getResultLabel, getResultColor } from '@/lib/constants/collection-actions'

interface CollectionAction {
  id: string
  action_type: string
  result: string
  notes: string
  payment_promise_date: string | null
  created_at: string
}

interface CollectionActionsTableProps {
  actions: CollectionAction[]
}

export function CollectionActionsTable({ actions }: CollectionActionsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Acciones de Cobranza
        </CardTitle>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay acciones de cobranza registradas
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Seguimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(action.created_at).toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getActionTypeLabel(action.action_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={getResultColor(action.result)}>
                        {getResultLabel(action.result)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm line-clamp-2">{action.notes}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {action.payment_promise_date ? (
                        <span className="text-sm">
                          {new Date(action.payment_promise_date).toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
