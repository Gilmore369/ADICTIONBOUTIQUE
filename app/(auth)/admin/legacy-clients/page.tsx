import { LegacyClientsView } from '@/components/admin/legacy-clients-view'

export const metadata = {
  title: 'Clientes Duplicados (Legacy) | Adiction Boutique',
  description: 'Revisión y corrección de clientes duplicados entre tiendas tras la migración',
}

export default function LegacyClientsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Clientes Duplicados / Datos Legacy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personas que quedaron con un registro en cada tienda tras la migración. Revisa la deuda por tienda,
          corrige los datos migrados y desactiva el registro sobrante.
        </p>
      </div>
      <LegacyClientsView />
    </div>
  )
}
