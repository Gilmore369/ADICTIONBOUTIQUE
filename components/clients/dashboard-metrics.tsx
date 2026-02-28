'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users,
  UserX,
  CreditCard,
  AlertTriangle,
  UserMinus,
  Cake,
  ClipboardList,
  DollarSign,
  TrendingDown,
  ChevronRight
} from 'lucide-react'
import type { DashboardMetrics as DashboardMetricsType } from '@/lib/types/crm'
import { formatCurrency } from '@/lib/utils/currency'

interface DashboardMetricsProps {
  metrics: DashboardMetricsType
}

export function DashboardMetrics({ metrics }: DashboardMetricsProps) {
  const metricCards = [
    {
      title: 'Clientes Activos',
      value: metrics.totalActiveClients,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      hoverBorder: 'hover:border-blue-300',
      hoverChevron: 'group-hover:text-blue-500',
      href: '/clients'
    },
    {
      title: 'Clientes Dados de Baja',
      value: metrics.totalDeactivatedClients,
      icon: UserX,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      hoverBorder: 'hover:border-gray-400',
      hoverChevron: 'group-hover:text-gray-500',
      href: '/clients'
    },
    {
      title: 'Clientes con Deuda',
      value: metrics.clientsWithDebt,
      icon: CreditCard,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      hoverBorder: 'hover:border-yellow-300',
      hoverChevron: 'group-hover:text-yellow-500',
      href: '/debt/plans'
    },
    {
      title: 'Clientes Morosos',
      value: metrics.clientsWithOverdueDebt,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      hoverBorder: 'hover:border-red-300',
      hoverChevron: 'group-hover:text-red-500',
      href: '/collections/actions'
    },
    {
      title: 'Clientes Inactivos',
      value: metrics.inactiveClients,
      icon: UserMinus,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      hoverBorder: 'hover:border-orange-300',
      hoverChevron: 'group-hover:text-orange-500',
      href: '/clients'
    },
    {
      title: 'Cumpleanos Este Mes',
      value: metrics.birthdaysThisMonth,
      icon: Cake,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      hoverBorder: 'hover:border-pink-300',
      hoverChevron: 'group-hover:text-pink-500',
      href: '/clients'
    },
    {
      title: 'Acciones Pendientes',
      value: metrics.pendingCollectionActions,
      icon: ClipboardList,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      hoverBorder: 'hover:border-purple-300',
      hoverChevron: 'group-hover:text-purple-500',
      href: '/collections/actions'
    },
    {
      title: 'Deuda Total',
      value: `S/ ${formatCurrency(metrics.totalOutstandingDebt)}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      hoverBorder: 'hover:border-green-300',
      hoverChevron: 'group-hover:text-green-500',
      href: '/debt/plans'
    },
    {
      title: 'Deuda Vencida',
      value: `S/ ${formatCurrency(metrics.totalOverdueDebt)}`,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      hoverBorder: 'hover:border-red-300',
      hoverChevron: 'group-hover:text-red-500',
      href: '/debt/plans'
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {metricCards.map((metric, index) => {
        const Icon = metric.icon
        return (
          <Link key={index} href={metric.href} className="group block">
            <Card className={`transition-all hover:shadow-md cursor-pointer ${metric.hoverBorder} h-full`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {metric.title}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <div className={`${metric.bgColor} p-2 rounded-lg`}>
                    <Icon className={`h-4 w-4 ${metric.color}`} />
                  </div>
                  <ChevronRight className={`h-4 w-4 text-gray-300 transition-colors ${metric.hoverChevron}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-gray-900">{metric.value}</div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
