import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayPeru } from '@/lib/utils/timezone'
import { getAllowedStoreNames, getAllowedPlanIds } from '@/lib/utils/store-filter'

export async function GET() {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const today = getTodayPeru()

    // Store filter
    const allowedStoreNames = await getAllowedStoreNames(supabase)
    let planIdFilter: string[] | null = null
    if (allowedStoreNames) {
      planIdFilter = await getAllowedPlanIds(supabase, allowedStoreNames)
    }

    let plansQuery = supabase
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
      .not('clients.lat', 'is', null)
      .not('clients.lng', 'is', null)
      .limit(100)

    if (planIdFilter !== null) {
      if (planIdFilter.length === 0) return NextResponse.json({ data: [] })
      plansQuery = plansQuery.in('id', planIdFilter) as typeof plansQuery
    }

    const { data: activePlans, error: plansError } = await plansQuery
    if (plansError) {
      return NextResponse.json({ error: plansError.message }, { status: 500 })
    }

    // Get clients with overdue installments (filtered too if needed)
    let overdueQuery = supabase
      .from('installments')
      .select('credit_plans!inner(client_id)')
      .lt('due_date', today)
      .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])

    if (planIdFilter !== null && planIdFilter.length > 0) {
      overdueQuery = overdueQuery.in('plan_id', planIdFilter) as typeof overdueQuery
    }

    const { data: overdueInstallments } = await overdueQuery
    const clientsWithOverdue = new Set(
      overdueInstallments?.map((i: any) => i.credit_plans.client_id) || []
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
