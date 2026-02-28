/**
 * Clients Up to Date API Route
 * 
 * GET /api/clients/up-to-date
 * Returns clients with active credit plans but no overdue installments
 * (Best clients - paying on time)
 * 
 * Requirements: Performance - LIMIT clause, only necessary data
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const today = new Date().toISOString().split('T')[0]

    // Get all clients with active credit plans
    const { data: activePlans, error: plansError } = await supabase
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
          credit_limit
        )
      `)
      .eq('status', 'ACTIVE')
      .not('clients.lat', 'is', null)
      .not('clients.lng', 'is', null)
      .limit(100)

    if (plansError) {
      return NextResponse.json(
        { error: plansError.message },
        { status: 500 }
      )
    }

    // Get clients with overdue installments
    const { data: overdueInstallments } = await supabase
      .from('installments')
      .select('credit_plans!inner(client_id)')
      .lt('due_date', today)
      .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])

    const clientsWithOverdue = new Set(
      overdueInstallments?.map((i: any) => i.credit_plans.client_id) || []
    )

    // Filter out clients with overdue payments
    const clientsMap = new Map()
    activePlans?.forEach((plan: any) => {
      const client = plan.clients
      if (!clientsWithOverdue.has(client.id) && !clientsMap.has(client.id)) {
        clientsMap.set(client.id, {
          ...client,
          status: 'up_to_date'
        })
      }
    })

    // Get payment history count for each client
    const data = await Promise.all(
      Array.from(clientsMap.values()).map(async (client) => {
        const { data: payments } = await supabase
          .from('payments')
          .select('id')
          .eq('client_id', client.id)

        return {
          ...client,
          payment_count: payments?.length || 0
        }
      })
    )

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
