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
  imported_from_legacy?: boolean
  legacy_purchase_description?: string | null
  legacy_purchase_date?: string | null
  legacy_original_total?: number | null
  legacy_source?: string | null
  legacy_imported_at?: string | null
  legacy_notes?: string | null
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
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">
                Plan de Crédito
              </CardTitle>
              {plan.imported_from_legacy && (
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                  title="Esta deuda fue importada desde otro sistema"
                >
                  🏷 LEGACY
                </Badge>
              )}
            </div>
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

        {/* Legacy Import Information */}
        {plan.imported_from_legacy && (
          <div className="pt-4 border-t bg-amber-50/30 dark:bg-amber-950/20 -mx-6 px-6 -mb-4 pb-4 rounded-b-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-amber-900 dark:text-amber-200">📦 Información del sistema anterior</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {plan.legacy_purchase_description && (
                <div className="md:col-span-2">
                  <div className="text-xs text-muted-foreground">Qué compró</div>
                  <div className="font-medium">{plan.legacy_purchase_description}</div>
                </div>
              )}
              {plan.legacy_purchase_date && (
                <div>
                  <div className="text-xs text-muted-foreground">Fecha de compra original</div>
                  <div>{formatSafeDate(plan.legacy_purchase_date, 'dd/MM/yyyy')}</div>
                </div>
              )}
              {plan.legacy_original_total != null && (
                <div>
                  <div className="text-xs text-muted-foreground">Total original</div>
                  <div className="font-semibold tabular-nums">{formatCurrency(Number(plan.legacy_original_total))}</div>
                </div>
              )}
              {plan.legacy_source && (
                <div>
                  <div className="text-xs text-muted-foreground">Origen</div>
                  <div className="text-xs">{plan.legacy_source}</div>
                </div>
              )}
              {plan.legacy_imported_at && (
                <div>
                  <div className="text-xs text-muted-foreground">Importado el</div>
                  <div className="text-xs">{formatSafeDate(plan.legacy_imported_at, 'dd/MM/yyyy HH:mm')}</div>
                </div>
              )}
              {plan.legacy_notes && (
                <div className="md:col-span-2">
                  <div className="text-xs text-muted-foreground">Notas</div>
                  <div className="text-sm italic text-muted-foreground">{plan.legacy_notes}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
