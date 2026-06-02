/**
 * Collections Layout
 *
 * Shared wrapper for /collections/payments and /collections/actions.
 * Renders the section header + tab navigation once, then {children}.
 */

import { CollectionsNav } from '@/components/collections/collections-nav'

interface CollectionsLayoutProps {
  children: React.ReactNode
}

export default function CollectionsLayout({ children }: CollectionsLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro de pagos y seguimiento de deuda
        </p>
      </div>

      {/* Tab navigation */}
      <CollectionsNav />

      {/* Page content */}
      {children}
    </div>
  )
}
