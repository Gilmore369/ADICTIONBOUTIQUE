/**
 * Client Profile View Component
 * 
 * Main component that displays the complete client profile with tabs
 * for different sections: overview, purchases, credits, visits, and actions.
 * 
 * Requirements: 1.1
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ClientProfile } from '@/lib/types/crm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClientHeader } from './client-header'
import { CreditSummaryCard } from './credit-summary-card'
import { InstallmentsTable } from './installments-table'
import { PurchaseHistoryTable } from './purchase-history-table'
import { ActionLogsTable } from './action-logs-table'
import { CollectionActionsTable } from './collection-actions-table'
import { ClientVisitsTable } from './client-visits-table'
import { AddActionForm } from './add-action-form'
import { AddCollectionActionForm } from './add-collection-action-form'
import { ChevronDown, ChevronRight, CreditCard, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { getActionTypeLabel, getResultLabel, getResultColor } from '@/lib/constants/collection-actions'

interface ClientProfileViewProps {
  profile: ClientProfile
}

export function ClientProfileView({ profile }: ClientProfileViewProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [visits, setVisits] = useState<any[]>([])
  const [loadingVisits, setLoadingVisits] = useState(false)
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set())
  const [selectedAction, setSelectedAction] = useState<any | null>(null)
  const router = useRouter()

  // Group installments by plan_id for Credits tab
  const installmentsByPlan = profile.installments.reduce((acc: Record<string, any[]>, inst: any) => {
    const planId = inst.planId || inst.plan_id
    if (!acc[planId]) acc[planId] = []
    acc[planId].push(inst)
    return acc
  }, {})

  const togglePlan = (planId: string) => {
    setExpandedPlans(prev => {
      const next = new Set(prev)
      next.has(planId) ? next.delete(planId) : next.add(planId)
      return next
    })
  }

  const getPlanStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':    return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Activo</Badge>
      case 'PAID':      return <Badge className="bg-green-600 text-white">Pagado</Badge>
      case 'CANCELLED': return <Badge variant="destructive">Cancelado</Badge>
      case 'OVERDUE':   return <Badge variant="destructive">Vencido</Badge>
      default:          return <Badge variant="outline">{status}</Badge>
    }
  }

  const getInstStatusBadge = (status: string, daysOverdue: number) => {
    if (daysOverdue > 0 && status !== 'PAID')
      return <Badge variant="destructive" className="text-xs">Vencida</Badge>
    switch (status) {
      case 'PAID':    return <Badge className="bg-green-600 text-white text-xs">Pagada</Badge>
      case 'PARTIAL': return <Badge variant="secondary" className="text-xs">Parcial</Badge>
      case 'PENDING': return <Badge variant="outline" className="text-xs">Pendiente</Badge>
      case 'OVERDUE': return <Badge variant="destructive" className="text-xs">Vencida</Badge>
      default:        return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  // Listen for data updates and refresh without changing tabs
  useEffect(() => {
    const handleUpdate = () => {
      router.refresh()
    }
    window.addEventListener('client-data-updated', handleUpdate)
    return () => window.removeEventListener('client-data-updated', handleUpdate)
  }, [router])

  // Load visits when tab is opened
  useEffect(() => {
    if (activeTab === 'visits' && visits.length === 0) {
      loadVisits()
    }
  }, [activeTab])

  const loadVisits = async () => {
    setLoadingVisits(true)
    try {
      const response = await fetch(`/api/visits?client_id=${profile.client.id}`)
      const { data } = await response.json()
      setVisits(data || [])
    } catch (error) {
      console.error('Error loading visits:', error)
    } finally {
      setLoadingVisits(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Client Header with Rating */}
      <ClientHeader client={profile.client} rating={profile.rating} />

      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="purchases">Compras</TabsTrigger>
          <TabsTrigger value="credits">Créditos</TabsTrigger>
          <TabsTrigger value="visits">Visitas</TabsTrigger>
          <TabsTrigger value="actions">Acciones</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <CreditSummaryCard summary={profile.creditSummary} />
          <InstallmentsTable
            installments={profile.installments.filter((i: any) => i.status !== 'PAID')}
          />
        </TabsContent>

        {/* Purchases Tab */}
        <TabsContent value="purchases">
          <PurchaseHistoryTable
            purchases={profile.purchaseHistory}
            clientName={profile.client?.name}
          />
        </TabsContent>

        {/* Credits Tab — plans with installments expandable */}
        <TabsContent value="credits">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Historial de Créditos
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {profile.creditHistory.length} plan{profile.creditHistory.length !== 1 ? 'es' : ''}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.creditHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No hay planes de crédito</p>
              ) : (
                profile.creditHistory.map((plan: any) => {
                  const planInsts: any[] = installmentsByPlan[plan.id] || []
                  const paid = planInsts.filter(i => i.status === 'PAID').length
                  const total = planInsts.length || plan.installments_count || 0
                  const paidAmt = plan.paid_amount || 0
                  const totalAmt = plan.total_amount || 0
                  const pendingAmt = Math.max(0, totalAmt - paidAmt)
                  const progress = totalAmt > 0 ? Math.round((paidAmt / totalAmt) * 100) : 0
                  const isExpanded = expandedPlans.has(plan.id)
                  const hasOverdue = planInsts.some((i: any) => i.daysOverdue > 0 && i.status !== 'PAID')

                  return (
                    <div key={plan.id} className="border rounded-lg overflow-hidden">
                      {/* Plan header - clickable */}
                      <button
                        onClick={() => togglePlan(plan.id)}
                        className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                            <div className="min-w-0">
                              <p className="font-semibold text-sm">
                                {plan.sale_number ? `Venta #${plan.sale_number}` : 'Plan de crédito'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(plan.created_at).toLocaleDateString('es-PE', {day:'2-digit',month:'2-digit',year:'numeric'})}
                                {total > 0 && ` · ${paid}/${total} cuotas pagadas`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {getPlanStatusBadge(plan.status || 'ACTIVE')}
                            {hasOverdue && <Badge variant="destructive" className="text-xs">Mora</Badge>}
                            <div className="text-right">
                              <p className="text-sm font-bold">S/ {totalAmt.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">Pend: S/ {pendingAmt.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        {total > 0 && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Pagado: S/ {paidAmt.toFixed(2)}</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : hasOverdue ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </button>

                      {/* Expanded installments */}
                      {isExpanded && (
                        <div className="border-t bg-muted/20">
                          {planInsts.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Sin cuotas registradas</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b bg-muted/40">
                                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cuota</th>
                                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Vencimiento</th>
                                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Monto</th>
                                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Pagado</th>
                                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Pendiente</th>
                                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Estado</th>
                                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Mora</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {planInsts
                                    .sort((a: any, b: any) => a.installmentNumber - b.installmentNumber)
                                    .map((inst: any) => {
                                      const pending = Math.max(0, inst.amount - inst.paidAmount)
                                      const isOverdue = inst.daysOverdue > 0 && inst.status !== 'PAID'
                                      return (
                                        <tr key={inst.id} className={`border-b last:border-0 ${isOverdue ? 'bg-red-50' : inst.status === 'PAID' ? 'bg-green-50/50' : ''}`}>
                                          <td className="px-4 py-2 font-medium"># {inst.installmentNumber}</td>
                                          <td className="px-4 py-2 text-muted-foreground">
                                            {inst.dueDate instanceof Date
                                              ? inst.dueDate.toLocaleDateString('es-PE', {day:'2-digit',month:'2-digit',year:'numeric'})
                                              : new Date(inst.dueDate).toLocaleDateString('es-PE', {day:'2-digit',month:'2-digit',year:'numeric'})}
                                          </td>
                                          <td className="px-4 py-2 text-right">S/ {inst.amount.toFixed(2)}</td>
                                          <td className="px-4 py-2 text-right text-green-700">S/ {inst.paidAmount.toFixed(2)}</td>
                                          <td className={`px-4 py-2 text-right font-semibold ${isOverdue ? 'text-red-600' : ''}`}>
                                            S/ {pending.toFixed(2)}
                                          </td>
                                          <td className="px-4 py-2 text-center">
                                            {getInstStatusBadge(inst.status, inst.daysOverdue)}
                                          </td>
                                          <td className="px-4 py-2 text-center">
                                            {isOverdue
                                              ? <span className="font-bold text-red-600">{inst.daysOverdue}d</span>
                                              : <span className="text-muted-foreground">—</span>}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visits Tab */}
        <TabsContent value="visits" className="space-y-4">
          <ClientVisitsTable visits={visits} loading={loadingVisits} />
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <AddCollectionActionForm clientId={profile.client.id} />

          {/* Collection Actions table with click-to-detail */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Acciones de Cobranza
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  Click en una fila para ver detalle
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(profile.collectionActions as any[]).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No hay acciones registradas</p>
              ) : (
                <div className="space-y-2">
                  {(profile.collectionActions as any[]).map((action: any) => (
                    <button
                      key={action.id}
                      onClick={() => setSelectedAction(action)}
                      className="w-full text-left border rounded-lg p-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {getActionTypeLabel(action.action_type)}
                          </Badge>
                          <span className={`text-sm font-medium truncate ${getResultColor(action.result)}`}>
                            {getResultLabel(action.result)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {action.payment_promise_date && (
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                              📅 {new Date(action.payment_promise_date).toLocaleDateString('es-PE', {day:'2-digit',month:'2-digit'})}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(action.created_at).toLocaleDateString('es-PE', {day:'2-digit',month:'2-digit',year:'numeric'})}
                          </span>
                        </div>
                      </div>
                      {action.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{action.notes}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Common Actions - Collapsible */}
          <details className="group">
            <summary className="cursor-pointer list-none">
              <Card className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Registro de Acciones Comunes</h3>
                  <ChevronDown className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180" />
                </div>
              </Card>
            </summary>
            <div className="mt-4 space-y-4">
              <AddActionForm clientId={profile.client.id} />
              <ActionLogsTable logs={profile.actionLogs} />
            </div>
          </details>
        </TabsContent>
      </Tabs>

      {/* Action Detail Modal */}
      {selectedAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setSelectedAction(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold">Detalle de Acción</h3>
              <button
                onClick={() => setSelectedAction(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Fecha</p>
                <p className="font-medium">
                  {new Date(selectedAction.created_at).toLocaleDateString('es-PE', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                  })}
                  {' '}
                  {new Date(selectedAction.created_at).toLocaleTimeString('es-PE', {
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tipo de Acción</p>
                <Badge variant="outline">{getActionTypeLabel(selectedAction.action_type)}</Badge>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Resultado</p>
                <span className={`font-semibold ${getResultColor(selectedAction.result)}`}>
                  {getResultLabel(selectedAction.result)}
                </span>
              </div>
              {selectedAction.payment_promise_date && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Fecha de Compromiso</p>
                  <p className="font-medium text-blue-700">
                    📅 {new Date(selectedAction.payment_promise_date).toLocaleDateString('es-PE', {
                      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>

            {selectedAction.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Notas / Descripción</p>
                <div className="bg-muted/40 rounded-lg p-3 text-sm leading-relaxed">
                  {selectedAction.notes}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedAction(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
