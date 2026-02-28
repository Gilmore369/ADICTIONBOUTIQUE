'use client'

/**
 * Client Credit Plans Component
 * 
 * Displays client's credit plans and payment status
 */

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatSafeDate } from '@/lib/utils/date'
import { ChevronRight } from 'lucide-react'

interface CreditPlan {
  id: string
  sale_id: string
  total_amount: number
  paid_amount: number
  remaining_amount: number
  installments_count: number
  status: string
  created_at: string
  sales?: {
    sale_number: string
    sale_date: string
  }
}

import { formatCurrency } from '@/lib/utils/currency'

interface ClientCreditPlansProps {
  creditPlans: CreditPlan[]
}

export function ClientCreditPlans({ creditPlans }: ClientCreditPlansProps) {
  if (creditPlans.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No hay planes de crédito registrados
      </Card>
    )
  }

  const activePlans = creditPlans.filter(p => p.status === 'ACTIVE')
  const totalDebt = activePlans.reduce((sum, p) => sum + p.remaining_amount, 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Planes activos</p>
            <p className="text-2xl font-bold">{activePlans.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Deuda total</p>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalDebt)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total pagado</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(creditPlans.reduce((sum, p) => sum + p.paid_amount, 0))}
            </p>
          </div>
        </div>
      </Card>

      {/* Credit Plans List */}
      <Card className="divide-y">
        {creditPlans.map((plan) => {
          const paymentProgress = (plan.paid_amount / plan.total_amount) * 100

          return (
            <div key={plan.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">
                      {plan.sales?.sale_number || `Plan ${plan.id.slice(0, 8)}`}
                    </span>
                    <Badge variant={plan.status === 'ACTIVE' ? 'default' : plan.status === 'COMPLETED' ? 'secondary' : 'destructive'}>
                      {plan.status === 'ACTIVE' ? 'Activo' : plan.status === 'COMPLETED' ? 'Completado' : 'Vencido'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan.installments_count} cuotas • {formatSafeDate(plan.created_at, 'dd/MM/yyyy')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = `/debt/plans/${plan.id}`}
                >
                  Ver detalles
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              {/* Payment Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pagado:</span>
                  <span className="font-semibold">{formatCurrency(plan.paid_amount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pendiente:</span>
                  <span className="font-semibold text-orange-600">{formatCurrency(plan.remaining_amount)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{ width: `${paymentProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {paymentProgress.toFixed(0)}% completado
                </p>
              </div>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
