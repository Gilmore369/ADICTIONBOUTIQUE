/**
 * Credit Plans Search API Route
 * 
 * GET /api/credit-plans/search?q=term&limit=50
 * Searches credit plans by client name, DNI, or sale number
 * 
 * Requirements: Performance - debounced search with LIMIT clause
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const searchParams = request.nextUrl.searchParams
    
    const query = searchParams.get('q') || ''
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(Number(limitParam), 100) : 50

    if (!query.trim()) {
      return NextResponse.json({ data: [] })
    }

    // Search in credit_plans with client and sale info
    const { data, error } = await supabase
      .from('credit_plans')
      .select(`
        id,
        total_amount,
        installments_count,
        installment_amount,
        status,
        created_at,
        client:clients!inner (
          id,
          name,
          dni
        ),
        sale:sales!inner (
          id,
          sale_number,
          created_at
        )
      `)
      .or(`clients.name.ilike.%${query}%,clients.dni.ilike.%${query}%,sales.sale_number.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Search error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Calculate paid and pending amounts for each plan
    const plansWithAmounts = await Promise.all(
      (data || []).map(async (plan) => {
        const { data: installments } = await supabase
          .from('installments')
          .select('paid_amount')
          .eq('plan_id', plan.id)

        const paidAmount = installments?.reduce((sum, i) => sum + (i.paid_amount || 0), 0) || 0

        // Get next due date
        const { data: nextInstallment } = await supabase
          .from('installments')
          .select('due_date')
          .eq('plan_id', plan.id)
          .in('status', ['PENDING', 'PARTIAL'])
          .order('due_date', { ascending: true })
          .limit(1)
          .single()

        return {
          ...plan,
          paid_amount: paidAmount,
          pending_amount: plan.total_amount - paidAmount,
          next_due_date: nextInstallment?.due_date || null
        }
      })
    )

    return NextResponse.json({ data: plansWithAmounts })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
