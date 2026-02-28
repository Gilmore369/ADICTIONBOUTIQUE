/**
 * Client Profile View Component
 * 
 * Main component that displays the complete client profile with tabs
 * for different sections: overview, purchases, credits, and actions.
 * 
 * Requirements: 1.1
 */

'use client'

import { useState } from 'react'
import { ClientProfile } from '@/lib/types/crm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientHeader } from './client-header'
import { CreditSummaryCard } from './credit-summary-card'
import { InstallmentsTable } from './installments-table'
import { PurchaseHistoryTable } from './purchase-history-table'
import { ActionLogsTable } from './action-logs-table'
import { CollectionActionsTable } from './collection-actions-table'
import { AddActionForm } from './add-action-form'
import { AddCollectionActionForm } from './add-collection-action-form'

interface ClientProfileViewProps {
  profile: ClientProfile
}

export function ClientProfileView({ profile }: ClientProfileViewProps) {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="space-y-6">
      {/* Client Header with Rating */}
      <ClientHeader client={profile.client} rating={profile.rating} />

      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="purchases">Compras</TabsTrigger>
          <TabsTrigger value="credits">Créditos</TabsTrigger>
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

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AddActionForm clientId={profile.client.id} />
            <AddCollectionActionForm clientId={profile.client.id} />
          </div>
          
          <ActionLogsTable logs={profile.actionLogs} />
          <CollectionActionsTable actions={profile.collectionActions} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
