/**
 * Clients with Upcoming Payments API Route
 * 
 * GET /api/clients/with-upcoming
 * Returns clients with installments due in the next 7 days and valid coordinates
 * 
 * Requirements: Performance - LIMIT clause, only necessary data
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayPeru } from '@/lib/utils/timezone'

export async function GET() {
  try {
    const supabase = await createServerClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const today = new Date()
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(today.getDate() + 7)

    const todayStr = getTodayPeru()
    const sevenDaysStr = sevenDaysFromNow.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

    // Get clients with upcoming installments (next 7 days)
    const { data: upcomingInstallments, error: installmentsError } = await supabase
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
      .not('credit_plans.clients.lat', 'is', null)
      .not('credit_plans.clients.lng', 'is', null)
      .limit(100)

    if (installmentsError) {
      return NextResponse.json(
        { error: installmentsError.message },
        { status: 500 }
      )
    }

    // Group by client and calculate upcoming amount
    const clientsMap = new Map()

    upcomingInstallments?.forEach((installment: any) => {
      const client = installment.credit_plans.clients
      const upcomingAmount = installment.amount - (installment.paid_amount || 0)

      if (clientsMap.has(client.id)) {
        const existing = clientsMap.get(client.id)
        existing.upcoming_amount += upcomingAmount
        existing.upcoming_count += 1
        // Keep earliest due date
        if (installment.due_date < existing.next_due_date) {
          existing.next_due_date = installment.due_date
        }
      } else {
        clientsMap.set(client.id, {
          ...client,
          upcoming_amount: upcomingAmount,
          upcoming_count: 1,
          next_due_date: installment.due_date
        })
      }
    })

    const data = Array.from(clientsMap.values())

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
