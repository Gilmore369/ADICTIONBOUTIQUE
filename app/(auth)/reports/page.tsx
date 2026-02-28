/**
 * Reports Page - Generación y visualización de reportes
 */

import { ReportsGenerator } from '@/components/reports/reports-generator'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reportes y Análisis</h1>
        <p className="text-sm text-gray-600 mt-1">
          Genera reportes personalizados con filtros y visualízalos antes de exportar
        </p>
      </div>

      <ReportsGenerator />
    </div>
  )
}
