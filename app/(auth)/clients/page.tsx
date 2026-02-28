import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
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

  // Check authorization
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Error fetching user profile:', profileError)
    throw new Error(`Error loading user profile: ${profileError.message}`)
  }

  if (!profile || (!((profile as any).roles?.includes('admin')) && !((profile as any).roles?.includes('vendedor')))) {
    console.log('Access denied. User roles:', (profile as any)?.roles)
    redirect('/')
  }

  // Fetch first 100 clients for initial load with pagination
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .order('name')
    .limit(100)

  if (error) {
    console.error('Error loading clients:', error)
    throw new Error(`Error loading clients: ${error.message}`)
  }

  return <ClientsListView initialClients={(clients || []) as any} />
}


export default function ClientsPage() {
  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<TableSkeleton rows={10} columns={9} />}>
        <ClientsData />
      </Suspense>
    </div>
  )
}
