import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { CashShiftManager } from '@/components/cash/cash-shift-manager'
import { Skeleton } from '@/components/ui/skeleton'
import { getCashShiftBreakdown } from '@/actions/cash'

async function CashData() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check authorization
  const { data: profile } = await supabase
    .from('users')
    .select('roles, stores')
    .eq('id', user.id)
    .single()

  const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  if (!profile || (!userRoles.includes('admin') && !userRoles.includes('cajero') && !userRoles.includes('vendedor'))) {
    redirect('/')
  }

  // Map store codes → display names used in cash_shifts.store_id
  const STORE_MAP: Record<string, string> = {
    MUJERES: 'Tienda Mujeres',
    HOMBRES: 'Tienda Hombres',
  }
  const isAdmin = userRoles.includes('admin')
  const userStoreCodes: string[] = (profile as any)?.stores || []

  // Read selected-store cookie
  const cookieStore = await cookies()
  const cookieSelected = cookieStore.get('selected-store')?.value  // 'ALL' | 'MUJERES' | 'HOMBRES'

  // Admin: respect cookie selection; non-admin: only their assigned stores
  let allowedStoreIds: string[]
  if (isAdmin) {
    if (cookieSelected && cookieSelected !== 'ALL') {
      const storeText = STORE_MAP[cookieSelected.toUpperCase()]
      allowedStoreIds = storeText ? [storeText] : ['Tienda Mujeres', 'Tienda Hombres']
    } else {
      allowedStoreIds = ['Tienda Mujeres', 'Tienda Hombres']
    }
  } else {
    allowedStoreIds = userStoreCodes.map((c: string) => STORE_MAP[c]).filter(Boolean)
  }

  // Get current open shifts — filtered by allowed stores (always, including admin)
  const { data: openShifts } = await supabase
    .from('cash_shifts')
    .select('*')
    .eq('status', 'OPEN')
    .in('store_id', allowedStoreIds)
    .order('opened_at', { ascending: false })

  // Get recent closed shifts — filtered by allowed stores (always, including admin)
  const { data: recentShifts } = await supabase
    .from('cash_shifts')
    .select('*')
    .eq('status', 'CLOSED')
    .in('store_id', allowedStoreIds)
    .order('closed_at', { ascending: false })
    .limit(10)

  // Fetch live breakdown for each open shift in parallel
  const breakdowns: Record<string, any> = {}
  if (openShifts && openShifts.length > 0) {
    await Promise.all(
      openShifts.map(async (shift: any) => {
        const result = await getCashShiftBreakdown(shift.id, shift.store_id, shift.opened_at)
        if (result.success) {
          breakdowns[shift.id] = result.data
        }
      })
    )
  }

  return (
    <CashShiftManager
      openShifts={(openShifts || []) as any}
      recentShifts={(recentShifts || []) as any}
      breakdowns={breakdowns}
      userId={user.id}
      allowedStoreIds={allowedStoreIds}
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
