import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayPeru, peruMidnightUTC } from '@/lib/utils/timezone'
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
    const todayMs = new Date(peruMidnightUTC(today)).getTime()

    // Store filter — respeta selección de tienda del UI y restricciones del perfil
    const { searchParams } = new URL(request.url)
    const requestedStore = searchParams.get('store')
    const allowedStoreNames = await getAllowedStoreNames(supabase, requestedStore)
    let planIdFilter: string[] | null = null
    if (allowedStoreNames) {
      planIdFilter = await getAllowedPlanIds(supabase, allowedStoreNames)
    }

    // ⚠️ ANTES tenía .limit(100) que excluía 3,267 de las 3,367 cuotas vencidas
    //    → solo se veía un puñado de clientes en el mapa. Usamos fetchAllRows.
    const overdueInstallments = await fetchAllRows<any>((from, to) => {
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
        .lt('due_date', today)
        .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
        .range(from, to)
      if (planIdFilter !== null) {
        q = q.in('plan_id', planIdFilter) as typeof q
      }
      return q
    })

    if (planIdFilter !== null && planIdFilter.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const clientsMap = new Map()
    overdueInstallments?.forEach((installment: any) => {
      const client = installment.credit_plans.clients
      const overdueAmount = installment.amount - (installment.paid_amount || 0)
      const dueDate = String(installment.due_date).split('T')[0]
      const daysOverdue = Math.floor(
        (todayMs - new Date(peruMidnightUTC(dueDate)).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (clientsMap.has(client.id)) {
        const existing = clientsMap.get(client.id)
        existing.overdue_amount += overdueAmount
        existing.overdue_count += 1
        existing.max_days_overdue = Math.max(existing.max_days_overdue, daysOverdue)
      } else {
        clientsMap.set(client.id, {
          ...client,
          overdue_amount: overdueAmount,
          overdue_count: 1,
          max_days_overdue: daysOverdue,
        })
      }
    })

    // Exclude clients whose overdue_amount is 0 or negative (installments already fully paid but status not updated)
    const result = Array.from(clientsMap.values()).filter(c => c.overdue_amount > 0.009)

    return NextResponse.json({ data: result })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
