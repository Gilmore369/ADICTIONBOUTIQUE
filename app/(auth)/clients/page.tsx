import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ClientsListView } from '@/components/clients/clients-list-view'
import { TableSkeleton } from '@/components/shared/loading-skeleton'

/**
 * Clients Page
 *
 * Server Component — only handles auth + role check.
 * Data is fetched client-side via /api/clients/paginated (50 per page)
 * so the page is fast and never loads all 4,927+ clients at once.
 */

async function ClientsData() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()
  const { data: profile, error: profileError } = await service
    .from('users')
    .select('roles, stores')
    .eq('id', user.id)
    .single()

  if (profileError) {
    throw new Error(`Error loading user profile: ${profileError.message}`)
  }

  const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  const validRoles = ['admin', 'vendedor', 'cajero', 'cobrador']
  if (!profile || !userRoles.some(r => validRoles.includes(r))) {
    redirect('/')
  }

  return <ClientsListView />
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
