/**
 * Credit Plan Card Component
 * 
 * Displays credit plan details including:
 * - Plan information (total, installments count, status)
 * - Client information
 * - Sale information
 * 
 * Design tokens:
 * - Card padding: 16px
 * - Border radius: 8px
 * - Spacing: 8px, 16px
 * - Typography: H2 16-18px, Body 14-16px
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatSafeDate } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/currency'

type CreditPlanStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

interface CreditPlan {
  id: string
  total_amount: number
  installments_count: number
  installment_amount: number
  status: CreditPlanStatus
  created_at: string
  client?: {
    id: string
    name: string
    dni?: string
  }
  sale?: {
    id: string
    sale_number: string
    created_at: string
  }
}

interface CreditPlanCardProps {
  plan: CreditPlan
}

const statusConfig: Record<CreditPlanStatus, { variant: 'success' | 'warning' | 'outline', label: string }> = {
  ACTIVE: { variant: 'warning', label: 'Activo' },
  COMPLETED: { variant: 'success', label: 'Completado' },
  CANCELLED: { variant: 'outline', label: 'Cancelado' }
}

export function CreditPlanCard({ plan }: CreditPlanCardProps) {
  const statusInfo = statusConfig[plan.status]

  return (
    <Card className="p-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              Plan de Crédito
            </CardTitle>
            <CardDescription className="mt-1">
              {plan.installments_count} cuotas de {formatCurrency(plan.installment_amount)}
            </CardDescription>
          </div>
          <Badge variant={statusInfo.variant}>
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Total Amount */}
        <div>
          <div className="text-sm text-muted-foreground">Monto Total</div>
          <div className="text-2xl font-semibold">
            {formatCurrency(plan.total_amount)}
          </div>
        </div>

        {/* Client Information */}
        {plan.client && (
          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-2">Cliente</div>
            <div className="space-y-1">
              <div className="text-sm">{plan.client.name}</div>
              {plan.client.dni && (
                <div className="text-sm text-muted-foreground">
                  DNI: {plan.client.dni}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sale Information */}
        {plan.sale && (
          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-2">Venta</div>
            <div className="space-y-1">
              <div className="text-sm">{plan.sale.sale_number}</div>
              <div className="text-sm text-muted-foreground">
                {formatSafeDate(plan.sale.created_at, 'dd/MM/yyyy')}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
