/**
 * Installment Status Badge Component
 * 
 * Displays installment status with color coding:
 * - PENDING: yellow
 * - PARTIAL: blue
 * - PAID: green
 * - OVERDUE: red
 * 
 * Design tokens:
 * - Border radius: 999px (pills)
 * - Typography: 14px body
 */

import { Badge } from '@/components/ui/badge'

type InstallmentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE'

interface InstallmentStatusBadgeProps {
  status: InstallmentStatus
}

const statusConfig: Record<InstallmentStatus, { variant: 'warning' | 'info' | 'success' | 'destructive', label: string }> = {
  PENDING: { variant: 'warning', label: 'Pendiente' },
  PARTIAL: { variant: 'info', label: 'Parcial' },
  PAID: { variant: 'success', label: 'Pagado' },
  OVERDUE: { variant: 'destructive', label: 'Vencido' }
}

export function InstallmentStatusBadge({ status }: InstallmentStatusBadgeProps) {
  const config = statusConfig[status]
  
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  )
}
