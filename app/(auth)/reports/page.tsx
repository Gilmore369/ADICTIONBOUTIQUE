/**
 * Reports Page — generation + visualization with sidebar deep-linking.
 *
 * The sidebar links to /reports?tab=<category> to jump directly to a
 * pre-filtered category. Some entries also point at a specific report
 * (e.g. ?tab=top-products → "sales-by-product"). The mapping lives
 * here so the URL stays stable even if the UI groups change.
 */

import { ReportsGenerator } from '@/components/reports/reports-generator'

// Map sidebar `tab` query param to (category, optional initialReport).
// `category` is one of REPORT_TYPES.category; `initialReport` is a specific id.
const TAB_MAP: Record<string, { category?: string; report?: string }> = {
  sales:         { category: 'sales' },
  inventory:     { category: 'inventory' },
  clients:       { category: 'clients' },
  collections:   { category: 'financial' },
  'top-products':{ category: 'sales',     report: 'sales-by-product' },
  'low-stock':   { category: 'inventory', report: 'low-stock'        },
}

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams
  const mapped = params?.tab ? TAB_MAP[params.tab] : undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reportes y Análisis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Genera reportes personalizados con filtros y visualízalos antes de exportar.
        </p>
      </div>

      <ReportsGenerator
        initialCategory={mapped?.category}
        initialReport={mapped?.report}
      />
    </div>
  )
}
