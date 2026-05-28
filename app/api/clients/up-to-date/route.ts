import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayPeru } from '@/lib/utils/timezone'
import { getAllowedStoreNames } from '@/lib/utils/store-filter'
import { fetchAllRows } from '@/lib/supabase/paginate'

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

    const today = getTodayPeru()

    // Store filter — respeta selección de tienda del UI y restricciones del perfil
    const { searchParams } = new URL(request.url)
    const requestedStore = searchParams.get('store')
    const allowedStoreNames = await getAllowedStoreNames(supabase, requestedStore)
    const allowedSet = allowedStoreNames ? new Set(allowedStoreNames) : null

    const activePlans = await fetchAllRows<any>((from, to) =>
      supabase
        .from('credit_plans')
        .select(`
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
        `)
        .eq('status', 'ACTIVE')
        .range(from, to)
    )

    const overdueInstallments = await fetchAllRows<any>((from, to) =>
      supabase
        .from('installments')
        .select('credit_plans!inner(client_id, legacy_source, sale:sales(store_id))')
        .lt('due_date', today)
        .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
        .range(from, to)
    )
    const clientsWithOverdue = new Set(
      overdueInstallments
        .filter((i: any) => !allowedSet || allowedSet.has(planStoreName(i.credit_plans)))
        .map((i: any) => i.credit_plans?.client_id).filter(Boolean)
    )

    const clientsMap = new Map()
    activePlans?.forEach((plan: any) => {
      if (allowedSet && !allowedSet.has(planStoreName(plan))) return
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
