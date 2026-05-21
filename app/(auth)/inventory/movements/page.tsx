/**
 * Movements Page — shell only. Data fetched client-side from
 * /api/inventory/movements/paginated (server-side pagination, 50 per page).
 * The previous implementation loaded all 86,000+ movements in one shot
 * and timed out.
 */

import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MovementsTable } from '@/components/inventory/movements-table'

export const metadata = {
  title: 'Movimientos | Adiction Boutique',
  description: 'Historial de movimientos de inventario',
}

export default async function MovementsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Movimientos de Inventario</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historial de entradas y salidas de productos
        </p>
      </div>
      <MovementsTable data={[]} singleStore={undefined} />
    </div>
  )
}
