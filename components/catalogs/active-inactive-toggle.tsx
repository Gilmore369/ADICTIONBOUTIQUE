'use client'

/**
 * ActiveInactiveToggle — pestañas para alternar entre items activos y soft-deleted
 *
 * Reemplaza el header genérico de los managers de catálogos. Permite ver
 * los items inactivos para restaurarlos. Creado en la auditoría 2026-05-01
 * para resolver: usuario no podía ver qué había eliminado.
 */

interface ActiveInactiveToggleProps {
  showInactive: boolean
  onChange: (showInactive: boolean) => void
  inactiveCount: number
  activeLabel?: string
  inactiveLabel?: string
}

export function ActiveInactiveToggle({
  showInactive,
  onChange,
  inactiveCount,
  activeLabel = 'Activos',
  inactiveLabel = 'Inactivos',
}: ActiveInactiveToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 text-sm">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-1.5 rounded-md transition-colors ${
          !showInactive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        {activeLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
          showInactive ? 'bg-gray-600 text-white' : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        {inactiveLabel}
        {inactiveCount > 0 && (
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded-full ${
              showInactive ? 'bg-white text-gray-700' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {inactiveCount}
          </span>
        )}
      </button>
    </div>
  )
}

interface InactiveBannerProps {
  entityName: string  // ej: "líneas", "tallas"
}

export function InactiveBanner({ entityName }: InactiveBannerProps) {
  return (
    <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-3">
      Estás viendo {entityName} <strong>desactivadas</strong>. Usa &quot;Restaurar&quot; para reactivarlas.
    </div>
  )
}
