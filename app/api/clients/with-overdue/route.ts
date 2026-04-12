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

    const todayDate = new Date()
    const today = getTodayPeru()

    // Store filter — users restricted to one store only see their store's clients
    const allowedStoreNames = await getAllowedStoreNames(supabase)
    let planIdFilter: string[] | null = null
    if (allowedStoreNames) {
      planIdFilter = await getAllowedPlanIds(supabase, allowedStoreNames)
    }

    let query = supabase
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
      .not('credit_plans.clients.lat', 'is', null)
      .not('credit_plans.clients.lng', 'is', null)
      .limit(100)

    // Apply store filter if needed
    if (planIdFilter !== null) {
      if (planIdFilter.length === 0) return NextResponse.json({ data: [] })
      query = query.in('plan_id', planIdFilter) as typeof query
    }

    const { data: overdueInstallments, error: installmentsError } = await query

    if (installmentsError) {
      return NextResponse.json({ error: installmentsError.message }, { status: 500 })
    }

    const clientsMap = new Map()
    overdueInstallments?.forEach((installment: any) => {
      const client = installment.credit_plans.clients
      const overdueAmount = installment.amount - (installment.paid_amount || 0)
      const daysOverdue = Math.floor(
        (todayDate.getTime() - new Date(installment.due_date).getTime()) / (1000 * 60 * 60 * 24)
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
