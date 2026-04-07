/**
 * Client Profile Page
 * 
 * Shows comprehensive client information including:
 * - Client header with rating
 * - Credit summary
 * - Installments table
 * - Purchase history
 * - Action logs
 * - Collection actions
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 7.1, 7.2, 7.4, 8.1, 8.2, 8.3, 11.1, 13.1
 */

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { fetchClientProfile } from '@/lib/services/client-service'
import { ClientProfileView } from '@/components/clients/client-profile-view'
import { Skeleton } from '@/components/shared/loading-skeleton'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

interface ClientProfilePageProps {
  params: {
    id: string
  }
}

const STORE_KEY_MAP: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

async function ClientData({ clientId, storeFilter }: { clientId: string; storeFilter: string | null }) {
  try {
    const profile = await fetchClientProfile(clientId, storeFilter)
    return <ClientProfileView profile={profile} />
  } catch (error) {
    console.error('Error fetching client profile:', error)
    notFound()
  }
}

export default async function ClientProfilePage({ params }: ClientProfilePageProps) {
  const { id } = await params

  // Resolve store filter for the current user
  let storeFilter: string | null = null
  try {
    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (user) {
      const service = createServiceClient()
      const { data: profile } = await service
        .from('users')
        .select('roles,stores')
        .eq('id', user.id)
        .single()
      const stores: string[] = (profile as any)?.stores || []
      // If user has exactly 1 store, lock to it
      if (stores.length === 1) {
        const code = (stores[0] ?? '').toUpperCase()
        storeFilter = STORE_KEY_MAP[code] ?? stores[0]
      }
    }
  } catch {
    // Non-critical — proceed without filter
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ClientData clientId={id} storeFilter={storeFilter} />
      </Suspense>
    </div>
  )
}
