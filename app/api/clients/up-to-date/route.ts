import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayPeru } from '@/lib/utils/timezone'
import { getAllowedStoreNames, getAllowedPlanIds } from '@/lib/utils/store-filter'
import { fetchAllRows } from '@/lib/supabase/paginate'

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const today = getTodayPeru()

    // Store filter — respeta selección de tienda del UI y restricciones del perfil
    const { searchParams } = new URL(request.url)
    const requestedStore = searchParams.get('store')
    const allowedStoreNames = await getAllowedStoreNames(supabase, requestedStore)
    let planIdFilter: string[] | null = null
    if (allowedStoreNames) {
      planIdFilter = await getAllowedPlanIds(supabase, allowedStoreNames)
    }

    if (planIdFilter !== null && planIdFilter.length === 0) {
      return NextResponse.json({ data: [] })
    }
    const activePlans = await fetchAllRows<any>((from, to) => {
      let q = supabase
        .from('credit_plans')
        .select(`
          client_id,
          clients!inner (
            id,
            name,
            phone,
            address,
            lat,
            lng,
            credit_used,
            credit_limit,
            client_photo_url
          )
        `)
        .eq('status', 'ACTIVE')
        .range(from, to)
      if (planIdFilter !== null) q = q.in('id', planIdFilter) as typeof q
      return q
    })

    const overdueInstallments = await fetchAllRows<any>((from, to) => {
      let q = supabase
        .from('installments')
        .select('credit_plans!inner(client_id)')
        .lt('due_date', today)
        .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
        .range(from, to)
      if (planIdFilter !== null && planIdFilter.length > 0) {
        q = q.in('plan_id', planIdFilter) as typeof q
      }
      return q
    })
    const clientsWithOverdue = new Set(
      overdueInstallments.map((i: any) => i.credit_plans?.client_id).filter(Boolean)
    )

    const clientsMap = new Map()
    activePlans?.forEach((plan: any) => {
      const client = plan.clients
      if (!clientsWithOverdue.has(client.id) && !clientsMap.has(client.id)) {
        clientsMap.set(client.id, { ...client, status: 'up_to_date' })
      }
    })

    const data = await Promise.all(
      Array.from(clientsMap.values()).map(async (client) => {
        const { data: payments } = await supabase
          .from('payments')
          .select('id')
          .eq('client_id', client.id)
        return { ...client, payment_count: payments?.length || 0 }
      })
    )

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
