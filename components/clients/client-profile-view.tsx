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
import { Card } from '@/components/ui/card'
import { ClientHeader } from './client-header'
import { CreditSummaryCard } from './credit-summary-card'
import { InstallmentsTable } from './installments-table'
import { PurchaseHistoryTable } from './purchase-history-table'
import { ActionLogsTable } from './action-logs-table'
import { CollectionActionsTable } from './collection-actions-table'
import { ClientVisitsTable } from './client-visits-table'
import { AddActionForm } from './add-action-form'
import { AddCollectionActionForm } from './add-collection-action-form'

interface ClientProfileViewProps {
  profile: ClientProfile
}

export function ClientProfileView({ profile }: ClientProfileViewProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [visits, setVisits] = useState<any[]>([])
  const [loadingVisits, setLoadingVisits] = useState(false)
  const router = useRouter()

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
          <InstallmentsTable installments={profile.installments} />
        </TabsContent>

        {/* Purchases Tab */}
        <TabsContent value="purchases">
          <PurchaseHistoryTable purchases={profile.purchaseHistory} />
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits">
          <div className="space-y-4">
            {profile.creditHistory.map((plan) => (
              <div key={plan.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Venta #{plan.sale_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(plan.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${plan.total_amount?.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      Pagado: ${plan.paid_amount?.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {profile.creditHistory.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No hay planes de crédito
              </p>
            )}
          </div>
        </TabsContent>

        {/* Visits Tab */}
        <TabsContent value="visits" className="space-y-4">
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">Historial de Visitas</h3>
            <p className="text-xs text-blue-700">
              Registro de visitas de campo con evidencias fotográficas y resultados de gestión
            </p>
          </Card>
          <ClientVisitsTable visits={visits} loading={loadingVisits} />
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-6">
          {/* Collection Actions - Priority */}
          <AddCollectionActionForm clientId={profile.client.id} />
          <CollectionActionsTable actions={profile.collectionActions} />
          
          {/* Common Actions - Collapsible */}
          <details className="group">
            <summary className="cursor-pointer list-none">
              <Card className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Acciones Comunes</h3>
                  <svg
                    className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
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
    </div>
  )
}
