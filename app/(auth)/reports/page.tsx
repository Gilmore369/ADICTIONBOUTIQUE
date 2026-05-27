import { ReportsGenerator } from '@/components/reports/reports-generator'
import { ComparativeMetricsView } from '@/components/reports/comparative-metrics-view'
import type { ReportTypeId } from '@/lib/reports/report-types'

const TAB_MAP: Record<string, { category?: string; report?: ReportTypeId }> = {
  sales: { category: 'sales' },
  inventory: { category: 'inventory' },
  clients: { category: 'clients' },
  collections: { category: 'clients', report: 'collection-effectiveness' },
  'top-products': { category: 'sales', report: 'sales-by-product' },
  'low-stock': { category: 'inventory', report: 'low-stock' },
}

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams
  const tab = params?.tab
  const mapped = tab ? TAB_MAP[tab] : undefined

  // Nueva sección "métricas" — comparar 2 períodos
  // No afecta a las demás reportes — solo se activa con ?tab=metricas
  if (tab === 'metricas') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Métricas Comparativas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compara indicadores entre dos períodos de tiempo (mes a mes, año a año, o rango personalizado).
          </p>
        </div>
        <ComparativeMetricsView />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reportes y Análisis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Genera reportes personalizados con filtros, gráficos y exportación profesional.
        </p>
      </div>

      <ReportsGenerator
        initialCategory={mapped?.category}
        initialReport={mapped?.report}
      />
    </div>
  )
}
