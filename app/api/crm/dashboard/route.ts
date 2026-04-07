import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchDashboardMetrics } from '@/lib/services/dashboard-service'

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  // sales.store_id guarda texto ("Tienda Mujeres"), no UUID
  const storeCode = (searchParams.get('store_code') || '').toUpperCase() || null
  const STORE_TEXT: Record<string, string> = {
    MUJERES: 'Tienda Mujeres',
    HOMBRES: 'Tienda Hombres',
  }
  let storeId = storeCode && STORE_TEXT[storeCode] ? STORE_TEXT[storeCode] : null

  // Enforce store permissions — if user has exactly 1 store, force it
  const service = createServiceClient()
  const { data: userProfile } = await service
    .from('users')
    .select('stores')
    .eq('id', user.id)
    .single()
  const userStores: string[] = ((userProfile as any)?.stores || []).map((s: string) => s.toUpperCase())
  if (userStores.length === 1) {
    storeId = STORE_TEXT[userStores[0]] || storeId
  }

  try {
    // 1. Base metrics via RPC (global) or filtered if store is forced
    const metrics = await fetchDashboardMetrics()

    // 2. Debt aging buckets — overdue installments grouped by days past due
    const { data: overdueRows } = await supabase
      .from('installments')
      .select('due_date, amount, paid_amount, credit_plans!inner(sale_id, sales!inner(store_id))')
      .in('status', ['OVERDUE', 'PARTIAL'])

    const ageingBuckets = { '0-30': 0, '31-60': 0, '61-90': 0, '+90': 0 }
    const today = new Date()
    for (const row of overdueRows || []) {
      // Store filter
      if (storeId) {
        const saleStoreId = (row.credit_plans as any)?.sales?.store_id
        if (saleStoreId && saleStoreId !== storeId) continue
      }
      const due = new Date(row.due_date)
      const days = Math.floor((today.getTime() - due.getTime()) / 86400000)
      const remaining = Number(row.amount) - Number(row.paid_amount || 0)
      if (days <= 30) ageingBuckets['0-30'] += remaining
      else if (days <= 60) ageingBuckets['31-60'] += remaining
      else if (days <= 90) ageingBuckets['61-90'] += remaining
      else ageingBuckets['+90'] += remaining
    }

    // 3. Top debtors: clients with highest risk score
    // score = total_debt * 0.6 + max_days_overdue * 0.4
    const { data: debtorRows } = await supabase
      .from('installments')
      .select(`
        due_date, amount, paid_amount,
        credit_plans!inner(
          client_id,
          sale_id,
          clients(id, name, dni, phone),
          sales!inner(store_id)
        )
      `)
      .in('status', ['OVERDUE', 'PARTIAL', 'PENDING'])

    // Group by client
    const clientMap: Record<string, {
      id: string; name: string; dni: string; phone: string;
      totalDebt: number; maxDaysOverdue: number; overdueDebt: number
    }> = {}

    for (const row of debtorRows || []) {
      const plan = row.credit_plans as any
      if (!plan) continue
      if (storeId && plan.sales?.store_id && plan.sales.store_id !== storeId) continue
      const client = plan.clients
      if (!client) continue

      const clientId = client.id
      const remaining = Number(row.amount) - Number(row.paid_amount || 0)
      const due = new Date(row.due_date)
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000))
      const isOverdue = new Date(row.due_date) < today

      if (!clientMap[clientId]) {
        clientMap[clientId] = {
          id: clientId,
          name: client.name,
          dni: client.dni || '',
          phone: client.phone || '',
          totalDebt: 0,
          maxDaysOverdue: 0,
          overdueDebt: 0,
        }
      }
      clientMap[clientId].totalDebt += remaining
      if (isOverdue) {
        clientMap[clientId].overdueDebt += remaining
        clientMap[clientId].maxDaysOverdue = Math.max(clientMap[clientId].maxDaysOverdue, daysOverdue)
      }
    }

    const topDebtors = Object.values(clientMap)
      .map(c => ({
        ...c,
        score: Math.round(c.totalDebt * 0.6 + c.maxDaysOverdue * 0.4),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    // When store filter is active, override debt KPIs with store-filtered values
    if (storeId) {
      const allClients = Object.values(clientMap)
      ;(metrics as any).totalOutstandingDebt = allClients.reduce((s, c) => s + c.totalDebt, 0)
      ;(metrics as any).totalOverdueDebt = allClients.reduce((s, c) => s + c.overdueDebt, 0)
      ;(metrics as any).clientsWithDebt = allClients.filter(c => c.totalDebt > 0).length
      ;(metrics as any).clientsWithOverdueDebt = allClients.filter(c => c.overdueDebt > 0).length
    }

    // 4. Monthly trend — last 6 months: credit plans created + payments made
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    // Debt created per month (from credit_plans)
    const { data: plansRows } = await supabase
      .from('credit_plans')
      .select('total_amount, created_at, sale_id, sales!inner(store_id)')
      .gte('created_at', sixMonthsAgo.toISOString().split('T')[0])

    // Payments per month
    const { data: paymentsRows } = await supabase
      .from('payments')
      .select('amount, payment_date')
      .gte('payment_date', sixMonthsAgo.toISOString().split('T')[0])

    // Build 6-month labels
    const monthLabels: string[] = []
    const monthKeys: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('es-PE', { month: 'short' })
        .replace('.', '')
        .replace(/^\w/, c => c.toUpperCase())
      monthLabels.push(label)
      monthKeys.push(key)
    }

    const debtByMonth: Record<string, number> = {}
    const paidByMonth: Record<string, number> = {}
    monthKeys.forEach(k => { debtByMonth[k] = 0; paidByMonth[k] = 0 })

    for (const plan of plansRows || []) {
      if (storeId && (plan.sales as any)?.store_id !== storeId) continue
      const key = plan.created_at.substring(0, 7)
      if (debtByMonth[key] !== undefined) debtByMonth[key] += Number(plan.total_amount || 0)
    }

    for (const pmt of paymentsRows || []) {
      const key = pmt.payment_date.substring(0, 7)
      if (paidByMonth[key] !== undefined) paidByMonth[key] += Number(pmt.amount || 0)
    }

    const monthlyTrend = monthKeys.map((key, i) => ({
      month: monthLabels[i],
      deuda: Math.round(debtByMonth[key]),
      cobrado: Math.round(paidByMonth[key]),
    }))

    // 5. Client status for pie chart
    const clientStatus = [
      { name: 'Sin deuda', value: metrics.totalActiveClients - metrics.clientsWithDebt, color: '#22c55e' },
      { name: 'Con deuda', value: metrics.clientsWithDebt - metrics.clientsWithOverdueDebt, color: '#f59e0b' },
      { name: 'Morosos', value: metrics.clientsWithOverdueDebt, color: '#ef4444' },
    ].filter(s => s.value > 0)

    return NextResponse.json({
      metrics,
      ageingBuckets: [
        { bucket: '0-30 días', monto: Math.round(ageingBuckets['0-30']), color: '#f59e0b' },
        { bucket: '31-60 días', monto: Math.round(ageingBuckets['31-60']), color: '#f97316' },
        { bucket: '61-90 días', monto: Math.round(ageingBuckets['61-90']), color: '#ef4444' },
        { bucket: '+90 días', monto: Math.round(ageingBuckets['+90']), color: '#7f1d1d' },
      ],
      topDebtors,
      monthlyTrend,
      clientStatus,
    })
  } catch (err: any) {
    console.error('[crm/dashboard]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
