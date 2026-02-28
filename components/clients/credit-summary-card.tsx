/**
 * Credit Summary Card Component
 * 
 * Displays credit limit, used, available, total debt, and overdue debt
 * with visual indicators.
 * 
 * Requirements: 1.5
 */

'use client'

import { CreditSummary } from '@/lib/types/crm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard, TrendingUp, AlertCircle, DollarSign } from 'lucide-react'
import { formatCurrency, calculateAvailableCredit, calculateCreditUtilization } from '@/lib/utils/currency'

interface CreditSummaryCardProps {
  summary: CreditSummary
}

export function CreditSummaryCard({ summary }: CreditSummaryCardProps) {
  // Calcular crédito disponible (nunca negativo)
  const creditAvailable = calculateAvailableCredit(summary.creditLimit, summary.creditUsed)
  
  // Calcular porcentaje de utilización
  const utilizationPercentage = calculateCreditUtilization(summary.creditLimit, summary.creditUsed)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Resumen de Crédito
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Credit Limit */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>Límite de Crédito</span>
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.creditLimit)}
            </p>
          </div>

          {/* Credit Used */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Deuda Pendiente</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(summary.creditUsed)}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-orange-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Credit Available */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span>Crédito Disponible</span>
            </div>
            <p className={`text-2xl font-bold ${creditAvailable > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(creditAvailable)}
            </p>
          </div>

          {/* Overdue Debt */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>Deuda Vencida</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.overdueDebt)}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.overdueInstallments} cuotas vencidas
            </p>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="mt-6 pt-6 border-t grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Deuda Total</p>
            <p className="font-semibold">{formatCurrency(summary.totalDebt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cuotas Pendientes</p>
            <p className="font-semibold">{summary.pendingInstallments}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Utilización</p>
            <p className="font-semibold">{utilizationPercentage.toFixed(1)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
