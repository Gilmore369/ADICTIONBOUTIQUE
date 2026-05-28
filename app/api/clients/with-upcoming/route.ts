import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { addDaysPeru, getTodayPeru } from '@/lib/utils/timezone'
import { getAllowedStoreNames } from '@/lib/utils/store-filter'
import { fetchAllRows } from '@/lib/supabase/paginate'

// Deriva la tienda de un plan (legacy_source O sale.store_id)
function planStoreName(plan: any): string {
  const src = (plan?.legacy_source || '').toLowerCase()
  const saleStore = (plan?.sale as any)?.store_id
  const isHombres = src.includes('hombres') || src.includes('boutiquev') || saleStore === 'Tienda Hombres'
  return isHombres ? 'Tienda Hombres' : 'Tienda Mujeres'
}

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
    const allowedSet = allowedStoreNames ? new Set(allowedStoreNames) : null

    const upcomingInstallments = await fetchAllRows<any>((from, to) =>
      supabase
        .from('installments')
        .select(`
          id,
          plan_id,
          amount,
          paid_amount,
          due_date,
          credit_plans!inner (
            client_id,
            legacy_source,
            sale:sales(store_id),
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
    )

    const clientsMap = new Map()
    upcomingInstallments?.forEach((installment: any) => {
      if (allowedSet && !allowedSet.has(planStoreName(installment.credit_plans))) return
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
