'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  AlertTriangle, 
  Cake, 
  UserMinus, 
  Clock 
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Alert } from '@/lib/types/crm'

interface AlertsListProps {
  alerts: Alert[]
}

export function AlertsList({ alerts }: AlertsListProps) {
  // Sort alerts by priority
  const sortedAlerts = [...alerts].sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'BIRTHDAY':
        return Cake
      case 'INACTIVITY':
        return UserMinus
      case 'INSTALLMENT':
        return Clock
      case 'OVERDUE':
        return AlertTriangle
    }
  }

  const getPriorityColor = (priority: Alert['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'LOW':
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityLabel = (priority: Alert['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'Alta'
      case 'MEDIUM':
        return 'Media'
      case 'LOW':
        return 'Baja'
    }
  }

  if (sortedAlerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No hay alertas en este momento
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas ({sortedAlerts.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedAlerts.map((alert) => {
            const Icon = getAlertIcon(alert.type)
            return (
              <Link
                key={alert.id}
                href={`/clients/${alert.clientId}`}
                className="block"
              >
                <div className="flex items-start gap-3 p-4 rounded-lg border hover:bg-accent transition-colors">
                  <div className={`${getPriorityColor(alert.priority)} p-2 rounded-lg`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">{alert.clientName}</p>
                      <Badge variant="outline" className={getPriorityColor(alert.priority)}>
                        {getPriorityLabel(alert.priority)}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {alert.message}
                    </p>
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {alert.dueDate && (
                        <span>
                          Fecha: {format(new Date(alert.dueDate), 'dd/MM/yyyy', { locale: es })}
                        </span>
                      )}
                      {alert.amount !== null && (
                        <span>
                          Monto: ${alert.amount.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
