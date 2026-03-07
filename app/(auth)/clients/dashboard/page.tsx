import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { fetchDashboardMetrics } from '@/lib/services/dashboard-service'
import { generateAlerts } from '@/lib/services/alert-service'
import { DashboardMetrics } from '@/components/clients/dashboard-metrics'
import { AlertsList } from '@/components/clients/alerts-list'
import { Skeleton } from '@/components/ui/skeleton'

export const revalidate = 300 // 5 minutes cache

async function DashboardContent() {
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

  const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  if (!profile || (!userRoles.includes('admin') && !userRoles.includes('vendedor'))) {
    redirect('/')
  }

  // Fetch metrics and alerts in parallel
  const [metrics, alerts] = await Promise.all([
    fetchDashboardMetrics(),
    generateAlerts()
  ])

  return (
    <div className="space-y-6">
      <DashboardMetrics metrics={metrics} />
      <AlertsList alerts={alerts} />
    </div>
  )
}

export default function ClientDashboardPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard de Clientes</h1>
        <p className="text-muted-foreground">
          Métricas y alertas del sistema de gestión de clientes
        </p>
      </div>
      
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  )
}
