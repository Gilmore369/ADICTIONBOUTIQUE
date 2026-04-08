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
import { ChevronDown, ChevronRight, CreditCard, AlertCircle, CheckCircle2, Clock, Phone, MessageSquare, Mail, FileText, MapPin, Video, Bike, Info, RefreshCw } from 'lucide-react'
import { getActionTypeLabel, getResultLabel, getResultColor, COLLECTION_RESULTS } from '@/lib/constants/collection-actions'
import { PERU_TZ } from '@/lib/utils/timezone'

interface ClientProfileViewProps {
  profile: ClientProfile
}

export function ClientProfileView({ profile }: ClientProfileViewProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [visits, setVisits] = useState<any[]>([])
  const [loadingVisits, setLoadingVisits] = useState(false)
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set())
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
                  // paid_amount doesn't exist in credit_plans; compute from installments
                  const paidAmt = planInsts.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0)
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
                                {(plan.sales as any)?.sale_number
                                  ? `Venta #${(plan.sales as any).sale_number}`
                                  : `Plan de crédito`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(plan.created_at).toLocaleDateString('es-PE', {day:'2-digit',month:'2-digit',year:'numeric',timeZone:PERU_TZ})}
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
                                              ? inst.dueDate.toLocaleDateString('es-PE', {day:'2-digit',month:'2-digit',year:'numeric',timeZone:PERU_TZ})
                                              : new Date(inst.dueDate).toLocaleDateString('es-PE', {day:'2-digit',month:'2-digit',year:'numeric',timeZone:PERU_TZ})}
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
        <TabsContent value="actions">
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

            {/* Left column: forms */}
            <div className="space-y-4">
              <AddCollectionActionForm clientId={profile.client.id} />

              {/* Common action form - collapsible */}
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border rounded-lg hover:bg-gray-100 transition-colors">
                    <span className="text-sm font-medium text-gray-600">Registrar nota / acción simple</span>
                    <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                  </div>
                </summary>
                <div className="mt-3 space-y-3">
                  <AddActionForm clientId={profile.client.id} />
                </div>
              </details>
            </div>

            {/* Right column: unified history timeline */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  Historial de Gestión
                  <span className="text-xs font-normal text-muted-foreground">
                    ({(profile.collectionActions as any[]).length + profile.actionLogs.length} registros)
                  </span>
                </h3>
              </div>

              {(profile.collectionActions as any[]).length === 0 && profile.actionLogs.length === 0 ? (
                <div className="text-center py-16 text-sm text-muted-foreground border rounded-xl bg-gray-50">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  No hay acciones registradas
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-gray-100" />

                  <div className="space-y-3">
                    {/* Merge and sort all actions by date desc */}
                    {[
                      ...(profile.collectionActions as any[]).map(a => ({ ...a, _kind: 'collection' })),
                      ...profile.actionLogs.map((l: any) => ({ ...l, _kind: 'log' })),
                    ]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((item: any) => {
                        const isCollection = item._kind === 'collection'
                        const dt = new Date(item.created_at)
                        const dateStr = dt.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: PERU_TZ })
                        const timeStr = dt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: PERU_TZ })

                        if (isCollection) {
                          const resultMeta = COLLECTION_RESULTS.find(r => r.value === item.result)
                          const dotBg =
                            item.result === 'PAGO_REALIZADO' || item.result === 'PAGO_PARCIAL' ? 'bg-green-500' :
                            item.result === 'SE_NIEGA_PAGAR' || item.result === 'DERIVADO_LEGAL' ? 'bg-red-500' :
                            item.result === 'COMPROMISO_PAGO' ? 'bg-blue-500' :
                            item.result === 'NO_CONTESTA' || item.result === 'NUMERO_EQUIVOCADO' ? 'bg-gray-400' :
                            item.result === 'SOLICITA_REFINANCIACION' || item.result === 'SOLICITA_PLAZO' ? 'bg-orange-500' :
                            'bg-purple-500'

                          const typeIcon =
                            item.action_type === 'LLAMADA' ? '📞' :
                            item.action_type === 'WHATSAPP' ? '💬' :
                            item.action_type === 'VISITA' ? '🚶' :
                            item.action_type === 'EMAIL' ? '📧' :
                            item.action_type === 'SMS' ? '📱' :
                            item.action_type === 'CARTA' ? '📄' :
                            item.action_type === 'MOTORIZADO' ? '🏍️' :
                            item.action_type === 'VIDEOLLAMADA' ? '📹' : '📋'

                          // Fix: date-only strings must use local noon to avoid UTC day-shift (Peru UTC-5)
                          const promiseDate = item.payment_promise_date
                            ? new Date(
                                /^\d{4}-\d{2}-\d{2}$/.test(item.payment_promise_date)
                                  ? item.payment_promise_date + 'T12:00:00'
                                  : item.payment_promise_date
                              ).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: PERU_TZ })
                            : null

                          return (
                            <div key={item.id} className="relative pl-11">
                              {/* Dot */}
                              <div className={`absolute left-2.5 top-3 w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-sm border-2 border-white ${dotBg}`}>
                                {typeIcon}
                              </div>
                              {/* Card */}
                              <div className="bg-white border rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-gray-800">
                                      {getActionTypeLabel(item.action_type)}
                                    </span>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-gray-50 border ${
                                      item.result === 'PAGO_REALIZADO' ? 'text-green-700 border-green-200 bg-green-50' :
                                      item.result === 'PAGO_PARCIAL' ? 'text-green-600 border-green-200 bg-green-50' :
                                      item.result === 'SE_NIEGA_PAGAR' ? 'text-red-700 border-red-200 bg-red-50' :
                                      item.result === 'COMPROMISO_PAGO' ? 'text-blue-700 border-blue-200 bg-blue-50' :
                                      item.result === 'NO_CONTESTA' ? 'text-gray-600 border-gray-200' :
                                      'text-purple-700 border-purple-200 bg-purple-50'
                                    }`}>
                                      {resultMeta?.icon} {getResultLabel(item.result)}
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-400 whitespace-nowrap font-mono flex-shrink-0">
                                    {dateStr} {timeStr}
                                  </span>
                                </div>

                                {item.notes && (
                                  <p className="text-sm text-gray-600 leading-relaxed mb-2">{item.notes}</p>
                                )}

                                {promiseDate && (
                                  <div className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full mb-2">
                                    <span>📅</span>
                                    <span className="font-medium">Promete pagar: {promiseDate}</span>
                                  </div>
                                )}

                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-gray-400">
                                    por <span className="font-medium text-gray-500">{item.user_name || 'Usuario'}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        } else {
                          // Common action log
                          const logIcon =
                            item.action_type === 'NOTA' ? '📝' :
                            item.action_type === 'LLAMADA' ? '📞' :
                            item.action_type === 'VISITA' ? '🚶' :
                            item.action_type === 'MENSAJE' ? '💬' :
                            item.action_type === 'REACTIVACION' ? '✅' : '📋'

                          return (
                            <div key={item.id} className="relative pl-11">
                              {/* Dot */}
                              <div className="absolute left-2.5 top-3 w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-sm border-2 border-white bg-gray-400">
                                {logIcon}
                              </div>
                              {/* Card */}
                              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 hover:shadow-sm transition-shadow">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                    {item.action_type}
                                  </span>
                                  <span className="text-xs text-gray-400 whitespace-nowrap font-mono flex-shrink-0">
                                    {dateStr} {timeStr}
                                  </span>
                                </div>
                                {item.description && (
                                  <p className="text-sm text-gray-700 leading-relaxed">{item.description}</p>
                                )}
                                <span className="text-xs text-gray-400 mt-1 block">
                                  por <span className="font-medium text-gray-500">{item.user_name || 'Usuario'}</span>
                                </span>
                              </div>
                            </div>
                          )
                        }
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

    </div>
  )
}
