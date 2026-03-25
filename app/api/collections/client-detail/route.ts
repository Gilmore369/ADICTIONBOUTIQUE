/**
 * Client Detail for Collections
 * GET /api/collections/client-detail?client_id=X
 * Returns: client info, pending installments, last actions timeline
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = request.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 })

  // Parallel: client info + installments + actions
  const [clientRes, installmentsRes, actionsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, dni, phone, address, credit_used, credit_limit, rating, blacklisted')
      .eq('id', clientId)
      .single(),

    supabase
      .from('installments')
      .select('id, installment_number, amount, due_date, paid_amount, status, plan_id')
      .in('plan_id',
        (await supabase
          .from('credit_plans')
          .select('id')
          .eq('client_id', clientId)
          .in('status', ['ACTIVE'])
        ).data?.map((p: any) => p.id) || []
      )
      .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
      .order('due_date', { ascending: true }),

    supabase
      .from('collection_actions')
      .select('id, action_type, result, payment_promise_date, notes, created_at, user:users(name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const today = new Date()
  const installments = (installmentsRes.data || []).map((inst: any) => {
    const due = new Date(inst.due_date)
    const daysOverdue = inst.status === 'OVERDUE'
      ? Math.floor((today.getTime() - due.getTime()) / 86400000)
      : 0
    return { ...inst, days_overdue: daysOverdue }
  })

  const totalDebt = installments.reduce((s: number, i: any) => s + (Number(i.amount) - Number(i.paid_amount || 0)), 0)
  const overdueDebt = installments
    .filter((i: any) => i.status === 'OVERDUE')
    .reduce((s: number, i: any) => s + (Number(i.amount) - Number(i.paid_amount || 0)), 0)

  return NextResponse.json({
    client: { ...clientRes.data, totalDebt, overdueDebt, pendingCount: installments.length },
    installments,
    actions: actionsRes.data || [],
  })
}
