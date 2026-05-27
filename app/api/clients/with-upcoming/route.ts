import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { addDaysPeru, getTodayPeru } from '@/lib/utils/timezone'
import { getAllowedStoreNames, getAllowedPlanIds } from '@/lib/utils/store-filter'
import { fetchAllRows } from '@/lib/supabase/paginate'

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const todayStr = getTodayPeru()
    const sevenDaysStr = addDaysPeru(7, todayStr)

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
    const upcomingInstallments = await fetchAllRows<any>((from, to) => {
      let q = supabase
        .from('installments')
        .select(`
          id,
          plan_id,
          amount,
          paid_amount,
          due_date,
          credit_plans!inner (
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
          )
        `)
        .gte('due_date', todayStr)
        .lte('due_date', sevenDaysStr)
        .in('status', ['PENDING', 'PARTIAL'])
        .range(from, to)
      if (planIdFilter !== null) q = q.in('plan_id', planIdFilter) as typeof q
      return q
    })

    const clientsMap = new Map()
    upcomingInstallments?.forEach((installment: any) => {
      const client = installment.credit_plans.clients
      const upcomingAmount = installment.amount - (installment.paid_amount || 0)
      if (clientsMap.has(client.id)) {
        const existing = clientsMap.get(client.id)
        existing.upcoming_amount += upcomingAmount
        existing.upcoming_count += 1
        if (installment.due_date < existing.next_due_date) {
          existing.next_due_date = installment.due_date
        }
      } else {
        clientsMap.set(client.id, {
          ...client,
          upcoming_amount: upcomingAmount,
          upcoming_count: 1,
          next_due_date: installment.due_date,
        })
      }
    })

    return NextResponse.json({ data: Array.from(clientsMap.values()) })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
