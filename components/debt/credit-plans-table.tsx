'use client'

/**
 * Credit Plans Table Component
 * 
 * Vista de tabla con búsqueda debounced para planes de crédito
 * 
 * Design tokens:
 * - Card padding: 16px
 * - Border radius: 8px
 * - Spacing: 8px, 16px
 * - Button height: 36px
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search } from 'lucide-react'
import { formatSafeDate } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/currency'

interface CreditPlan {
  id: string
  total_amount: number
  installments_count: number
  installment_amount: number
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  created_at: string
  client: {
    id: string
    name: string
    dni?: string
  }
  sale: {
    id: string
    sale_number: string
    created_at: string
  }
  paid_amount?: number
  pending_amount?: number
  next_due_date?: string
}

interface CreditPlansTableProps {
  initialPlans: CreditPlan[]
}

const statusConfig = {
  ACTIVE: { variant: 'warning' as const, label: 'Activo' },
  COMPLETED: { variant: 'success' as const, label: 'Completado' },
  CANCELLED: { variant: 'outline' as const, label: 'Cancelado' }
}

export function CreditPlansTable({ initialPlans }: CreditPlansTableProps) {
  const router = useRouter()
  const [plans, setPlans] = useState<CreditPlan[]>(initialPlans)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  // Debounced search - 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        handleSearch(searchTerm)
      } else {
        setPlans(initialPlans)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, initialPlans])

  const handleSearch = async (term: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/credit-plans/search?q=${encodeURIComponent(term)}&limit=50`)
      const { data } = await response.json()
      setPlans(data || [])
    } catch (error) {
      console.error('Error searching plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRowClick = (planId: string) => {
    router.push(`/debt/plans/${planId}`)
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por cliente, DNI o número de venta..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Venta</TableHead>
              <TableHead className="text-right">Monto Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
              <TableHead>Próximo Venc.</TableHead>
              <TableHead>Cuotas</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  Buscando...
                </TableCell>
              </TableRow>
            ) : plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  No se encontraron planes de crédito
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan) => {
                const statusInfo = statusConfig[plan.status]
                const paidAmount = plan.paid_amount || 0
                const pendingAmount = plan.total_amount - paidAmount

                return (
                  <TableRow
                    key={plan.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleRowClick(plan.id)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{plan.client.name}</div>
                        {plan.client.dni && (
                          <div className="text-xs text-gray-500">DNI: {plan.client.dni}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{plan.sale.sale_number}</div>
                        <div className="text-xs text-gray-500">
                          {formatSafeDate(plan.sale.created_at, 'dd/MM/yyyy')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(plan.total_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {formatCurrency(paidAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-orange-600">
                      {formatCurrency(pendingAmount)}
                    </TableCell>
                    <TableCell>
                      {plan.next_due_date ? (
                        <div className="text-sm">
                          {formatSafeDate(plan.next_due_date, 'dd/MM/yyyy')}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {plan.installments_count} x {formatCurrency(plan.installment_amount)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
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
