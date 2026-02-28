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

interface ClientProfilePageProps {
  params: {
    id: string
  }
}

async function ClientData({ clientId }: { clientId: string }) {
  try {
    const profile = await fetchClientProfile(clientId)
    return <ClientProfileView profile={profile} />
  } catch (error) {
    console.error('Error fetching client profile:', error)
    notFound()
  }
}

export default async function ClientProfilePage({ params }: ClientProfilePageProps) {
  const { id } = await params
  
  return (
    <div className="container mx-auto py-6 px-4">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ClientData clientId={id} />
      </Suspense>
    </div>
  )
}
