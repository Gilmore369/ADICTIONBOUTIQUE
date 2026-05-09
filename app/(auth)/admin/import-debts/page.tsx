import { ImportDebtsView } from '@/components/admin/import-debts-view'

export const metadata = {
  title: 'Importar Deudas Legacy | Adiction Boutique',
  description: 'Migración masiva de deudas desde otro sistema',
}

export default function ImportDebtsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Importar Deudas (Legacy)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Migración masiva de deudas históricas desde otro sistema. Las deudas importadas quedan marcadas para trazabilidad y seguimiento.
        </p>
      </div>

      <ImportDebtsView />
    </div>
  )
}
