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

  // Parallel: client info + plans (with sale store) + actions
  const [clientRes, plansRes, actionsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, dni, phone, address, credit_used, credit_limit, rating, blacklisted')
      .eq('id', clientId)
      .single(),

    supabase
      .from('credit_plans')
      .select('id, sales(store_id)')
      .eq('client_id', clientId)
      .in('status', ['ACTIVE']),

    supabase
      .from('collection_actions')
      .select('id, action_type, result, payment_promise_date, notes, created_at, user:users(name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  // Build plan_id → store_id map from plans+sales join
  const planIds = (plansRes.data || []).map((p: any) => p.id)
  const planStoreMap: Record<string, string> = {}
  for (const plan of plansRes.data || []) {
    planStoreMap[(plan as any).id] = (plan as any).sales?.store_id || ''
  }

  // Fetch installments for active plans
  const installmentsRes = planIds.length > 0
    ? await supabase
        .from('installments')
        .select('id, installment_number, amount, due_date, paid_amount, status, plan_id')
        .in('plan_id', planIds)
        .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
        .order('due_date', { ascending: true })
    : { data: [] }

  const today = new Date()
  today.setHours(0, 0, 0, 0) // comparar solo fecha, sin hora

  const installments = ((installmentsRes as any).data || []).map((inst: any) => {
    const due = new Date(inst.due_date)
    due.setHours(0, 0, 0, 0)
    // Vencida si la fecha ya pasó, sin importar el status en BD
    const isOverdue = due < today
    const daysOverdue = isOverdue
      ? Math.floor((today.getTime() - due.getTime()) / 86400000)
      : 0
    // Attach store_id from plan's sale for client-side store validation
    return { ...inst, days_overdue: daysOverdue, is_overdue: isOverdue, store_id: planStoreMap[inst.plan_id] || '' }
  })

  const totalDebt = installments.reduce((s: number, i: any) => s + (Number(i.amount) - Number(i.paid_amount || 0)), 0)
  // "Vencida" = cuotas cuya fecha de vencimiento ya pasó (criterio por fecha, no por campo status)
  const overdueDebt = installments
    .filter((i: any) => i.is_overdue)
    .reduce((s: number, i: any) => s + (Number(i.amount) - Number(i.paid_amount || 0)), 0)

  return NextResponse.json({
    client: { ...clientRes.data, totalDebt, overdueDebt, pendingCount: installments.length },
    installments,
    actions: actionsRes.data || [],
  })
}
