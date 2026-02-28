/**
 * Map Page
 * 
 * Mapa geográfico de clientes con deuda pendiente
 * Visualización con Google Maps y marcadores por nivel de deuda
 * 
 * Requirements: 10.1, 10.2
 * 
 * Design tokens used:
 * - Spacing: 16px, 24px
 * - Card padding: 16px
 */

import { Suspense } from 'react'
import { DebtorsMap } from '@/components/map/debtors-map'
import { Card } from '@/components/ui/card'

function MapSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
      </Card>
      <Card className="p-0">
        <div className="h-[600px] bg-gray-200 animate-pulse"></div>
      </Card>
    </div>
  )
}

export default function MapPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Mapa de Deudores</h1>
        <p className="text-sm text-gray-600 mt-1">
          Visualización geográfica de clientes con deuda pendiente
        </p>
      </div>

      {/* Map Component */}
      <Suspense fallback={<MapSkeleton />}>
        <DebtorsMap />
      </Suspense>
    </div>
  )
}
