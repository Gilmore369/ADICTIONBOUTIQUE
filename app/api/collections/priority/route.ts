/**
 * Collections Priority API
 * GET /api/collections/priority?store_id=&limit=20
 * Returns top debtors sorted by risk score (debt*0.6 + days_overdue*0.4)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('store_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 50)

  const { data: rows, error } = await supabase
    .from('installments')
    .select(`
      due_date, amount, paid_amount,
      credit_plans!inner(
        client_id,
        sales!inner(store_id),
        clients!inner(id, name, dni, phone, rating)
      )
    `)
    .in('status', ['OVERDUE', 'PARTIAL', 'PENDING'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = new Date()
  const clientMap: Record<string, {
    id: string; name: string; dni: string; phone: string; rating: string
    totalDebt: number; overdueDebt: number; maxDaysOverdue: number; overdueCount: number
  }> = {}

  for (const row of rows || []) {
    const plan = row.credit_plans as any
    if (!plan) continue
    if (storeId && plan.sales?.store_id && plan.sales.store_id !== storeId) continue

    const client = plan.clients
    if (!client) continue

    const remaining = Number(row.amount) - Number(row.paid_amount || 0)
    const due = new Date(row.due_date)
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000))
    const isOverdue = due < today

    if (!clientMap[client.id]) {
      clientMap[client.id] = {
        id: client.id, name: client.name, dni: client.dni || '',
        phone: client.phone || '', rating: client.rating || 'E',
        totalDebt: 0, overdueDebt: 0, maxDaysOverdue: 0, overdueCount: 0,
      }
    }
    clientMap[client.id].totalDebt += remaining
    if (isOverdue) {
      clientMap[client.id].overdueDebt += remaining
      clientMap[client.id].maxDaysOverdue = Math.max(clientMap[client.id].maxDaysOverdue, daysOverdue)
      clientMap[client.id].overdueCount++
    }
  }

  const result = Object.values(clientMap)
    .map(c => ({ ...c, score: Math.round(c.totalDebt * 0.6 + c.maxDaysOverdue * 0.4) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return NextResponse.json({ data: result })
}
