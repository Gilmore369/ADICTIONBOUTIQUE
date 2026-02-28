/**
 * Overdue Installments API Route
 * 
 * Fetches overdue installments (due_date < current_date and status = 'pending' or 'partial')
 * 
 * Query Parameters:
 * - client_id: Filter by client UUID (optional)
 * - status: Filter by status (pending, partial, overdue) (optional)
 * - limit: Maximum results (default: 50, max: 100)
 * 
 * Requirements: 6.7
 * Task: 14.5 Create installments API route
 * 
 * @example
 * GET /api/installments/overdue?client_id=uuid&limit=20
 */

import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const searchParams = request.nextUrl.searchParams
    
    // Get query parameters
    const clientId = searchParams.get('client_id')
    const status = searchParams.get('status')
    
    // Get limit parameter (default 50, max 100 enforced)
    const limitParam = searchParams.get('limit')
    const requestedLimit = limitParam ? Number(limitParam) : 50
    const limit = Math.min(Math.max(requestedLimit, 1), 100)
    
    // Build query
    let query = supabase
      .from('installments')
      .select(`
        id,
        plan_id,
        installment_number,
        amount,
        due_date,
        paid_amount,
        status,
        paid_at,
        credit_plans!inner (
          id,
          sale_id,
          client_id,
          total_amount,
          installments_count,
          status,
          clients!inner (
            id,
            name,
            dni,
            phone,
            credit_limit,
            credit_used
          ),
          sales (
            id,
            sale_number,
            total,
            created_at
          )
        )
      `)
      .lt('due_date', new Date().toISOString().split('T')[0]) // due_date < today
      .in('status', ['PENDING', 'PARTIAL', 'OVERDUE']) // Only unpaid or partially paid
    
    // Apply optional filters
    if (clientId) {
      query = query.eq('credit_plans.client_id', clientId)
    }
    
    if (status) {
      query = query.eq('status', status.toUpperCase())
    }
    
    // Apply limit and ordering
    const { data, error } = await query
      .limit(limit)
      .order('due_date', { ascending: true }) // Oldest due first
    
    if (error) {
      console.error('Overdue installments fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch overdue installments', details: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Unexpected error in overdue installments fetch:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
