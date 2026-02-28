import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { CashShiftManager } from '@/components/cash/cash-shift-manager'
import { Skeleton } from '@/components/ui/skeleton'

async function CashData() {
  const supabase = await createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check authorization
  const { data: profile } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single()

  if (!profile || (!((profile as any).roles?.includes('admin')) && !((profile as any).roles?.includes('cajero')))) {
    redirect('/')
  }

  // Get current open shifts (one per store)
  const { data: openShifts } = await supabase
    .from('cash_shifts')
    .select('*')
    .eq('status', 'OPEN')
    .order('opened_at', { ascending: false })

  // Get recent closed shifts
  const { data: recentShifts } = await supabase
    .from('cash_shifts')
    .select('*')
    .eq('status', 'CLOSED')
    .order('closed_at', { ascending: false })
    .limit(10)

  return (
    <CashShiftManager 
      openShifts={(openShifts || []) as any}
      recentShifts={(recentShifts || []) as any}
      userId={user.id}
    />
  )
}

export default function CashPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Caja</h1>
        <p className="text-muted-foreground">
          Apertura, cierre y control de turnos de caja
        </p>
      </div>
      
      <Suspense fallback={<CashSkeleton />}>
        <CashData />
      </Suspense>
    </div>
  )
}

function CashSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64" />
      <Skeleton className="h-96" />
    </div>
  )
}
