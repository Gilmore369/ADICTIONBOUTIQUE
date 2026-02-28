/**
 * Clients with Overdue Payments API Route
 * 
 * GET /api/clients/with-overdue
 * Returns clients with overdue installments and valid coordinates
 * 
 * Requirements: Performance - LIMIT clause, only necessary data
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const todayDate = new Date()
    const today = todayDate.toISOString().split('T')[0]

    // Get clients with overdue installments
    const { data: overdueInstallments, error: installmentsError } = await supabase
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
            credit_limit
          )
        )
      `)
      .lt('due_date', today)
      .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
      .not('credit_plans.clients.lat', 'is', null)
      .not('credit_plans.clients.lng', 'is', null)
      .limit(100)

    if (installmentsError) {
      return NextResponse.json(
        { error: installmentsError.message },
        { status: 500 }
      )
    }

    // Group by client and calculate overdue amount + days overdue
    const clientsMap = new Map()

    overdueInstallments?.forEach((installment: any) => {
      const client       = installment.credit_plans.clients
      const overdueAmount = installment.amount - (installment.paid_amount || 0)
      const daysOverdue  = Math.floor(
        (todayDate.getTime() - new Date(installment.due_date).getTime()) / (1000 * 60 * 60 * 24)
      )

      if (clientsMap.has(client.id)) {
        const existing = clientsMap.get(client.id)
        existing.overdue_amount  += overdueAmount
        existing.overdue_count   += 1
        existing.max_days_overdue = Math.max(existing.max_days_overdue, daysOverdue)
      } else {
        clientsMap.set(client.id, {
          ...client,
          overdue_amount:   overdueAmount,
          overdue_count:    1,
          max_days_overdue: daysOverdue,
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
