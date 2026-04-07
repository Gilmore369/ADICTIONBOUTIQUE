import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ClientsListView } from '@/components/clients/clients-list-view'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

/**
 * Clients Page
 * 
 * Server Component that fetches clients data with credit information
 * and renders the ClientsListView component with advanced filtering.
 * Uses Suspense for lazy loading with skeleton.
 * 
 * Requirements: 5.1, 13.1, 14.5
 * Task: 18.1 Create client list page
 */

async function ClientsData() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check authorization — use service client to bypass RLS on users table
  const service = createServiceClient()
  const { data: profile, error: profileError } = await service
    .from('users')
    .select('roles, stores')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Error fetching user profile:', profileError)
    throw new Error(`Error loading user profile: ${profileError.message}`)
  }

  const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  if (!profile || (!userRoles.includes('admin') && !userRoles.includes('vendedor') && !userRoles.includes('cobrador'))) {
    redirect('/')
  }

  // Build client IDs filter if user has exactly 1 store
  // Clients are linked to stores via their sales → filter by clients that have bought in this store
  const userStores: string[] = ((profile as any)?.stores || []).map((s: string) => s.toUpperCase())
  const STORE_TEXT: Record<string, string> = {
    MUJERES: 'Tienda Mujeres',
    HOMBRES: 'Tienda Hombres',
  }

  let clientIds: string[] | null = null
  if (userStores.length === 1) {
    const storeText = STORE_TEXT[userStores[0]]
    if (storeText) {
      // Get client IDs that have sales in this store
      const { data: salesRows } = await service
        .from('sales')
        .select('client_id')
        .eq('store_id', storeText)
        .not('client_id', 'is', null)
      clientIds = [...new Set((salesRows || []).map((r: any) => r.client_id).filter(Boolean))]
    }
  }

  // Fetch clients — try with blacklisted column first, fall back without it
  let clients: any[] | null = null

  let queryWithBL = supabase
    .from('clients')
    .select('id, dni, name, phone, rating, rating_score, last_purchase_date, credit_used, active, deactivation_reason, blacklisted, birthday')
    .eq('active', true)
    .order('blacklisted', { ascending: false })
    .order('name')
    .limit(500)

  if (clientIds !== null) {
    queryWithBL = queryWithBL.in('id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])
  }

  const { data: clientsWithBL, error: errorWithBL } = await queryWithBL

  if (errorWithBL) {
    // Columna blacklisted aún no existe en BD — cargar sin ella
    console.warn('blacklisted column not available:', errorWithBL.message)
    let queryNoBL = supabase
      .from('clients')
      .select('id, dni, name, phone, rating, rating_score, last_purchase_date, credit_used, active, deactivation_reason, birthday')
      .eq('active', true)
      .order('name')
      .limit(500)
    if (clientIds !== null) {
      queryNoBL = queryNoBL.in('id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])
    }
    const { data: clientsNoBL, error: errorNoBL } = await queryNoBL

    if (errorNoBL) {
      console.error('Error loading clients:', errorNoBL)
      throw new Error(`Error loading clients: ${errorNoBL.message}`)
    }
    clients = clientsNoBL
  } else {
    clients = clientsWithBL
  }

  return <ClientsListView initialClients={(clients || []) as any} />
}


export default function ClientsPage() {
  return (
    <div className="container mx-auto py-4">
      <Suspense fallback={<TableSkeleton rows={10} columns={9} />}>
        <ClientsData />
      </Suspense>
    </div>
  )
}
