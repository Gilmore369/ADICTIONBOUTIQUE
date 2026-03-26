/**
 * Collections Priority API
 * GET /api/collections/priority?store_id=&limit=20
 *
 * Lógica de tiendas:
 *  - Los CLIENTES no pertenecen a una tienda — pueden comprar en ambas
 *  - Las DEUDAS sí pertenecen a la tienda donde se hizo la compra (sale.store_id)
 *  - Sin filtro → todas las deudas de todos los clientes
 *  - Con filtro → solo deudas de compras hechas en esa tienda
 *    (un cliente puede aparecer en ambas tiendas si compró en las dos)
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

  // ── Step 1: si hay filtro de tienda, obtener plan_ids de esa tienda ──────────
  let allowedPlanIds: string[] | null = null   // null = sin restricción

  if (storeId) {
    // Ventas de esa tienda
    const { data: salesData } = await supabase
      .from('sales')
      .select('id')
      .eq('store_id', storeId)

    const saleIds = (salesData || []).map((s: any) => s.id)

    if (saleIds.length === 0) {
      // No hay ventas en esa tienda → no hay deudas
      return NextResponse.json({ data: [] })
    }

    // Planes de crédito de esas ventas
    const { data: plansData } = await supabase
      .from('credit_plans')
      .select('id')
      .in('sale_id', saleIds)
      .in('status', ['ACTIVE', 'OVERDUE'])

    allowedPlanIds = (plansData || []).map((p: any) => p.id)

    if (allowedPlanIds.length === 0) {
      return NextResponse.json({ data: [] })
    }
  }

  // ── Step 2: obtener cuotas pendientes/vencidas ───────────────────────────────
  let query = supabase
    .from('installments')
    .select(`
      due_date, amount, paid_amount, plan_id,
      credit_plans!inner(
        client_id,
        clients!inner(id, name, dni, phone, rating)
      )
    `)
    .in('status', ['OVERDUE', 'PARTIAL', 'PENDING'])

  if (allowedPlanIds !== null) {
    query = query.in('plan_id', allowedPlanIds)
  }

  const { data: rows, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Step 3: agrupar por cliente y calcular score ─────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const clientMap: Record<string, {
    id: string; name: string; dni: string; phone: string; rating: string
    totalDebt: number; overdueDebt: number; maxDaysOverdue: number; overdueCount: number
  }> = {}

  for (const row of rows || []) {
    const plan = row.credit_plans as any
    if (!plan) continue
    const client = plan.clients
    if (!client) continue

    const remaining = Number(row.amount) - Number(row.paid_amount || 0)
    if (remaining <= 0) continue

    // Comparar por fecha sin hora para evitar desfase de zona horaria
    const dueParts = (row.due_date as string).split('T')[0].split('-')
    const due = new Date(parseInt(dueParts[0]), parseInt(dueParts[1]) - 1, parseInt(dueParts[2]))
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
    .filter(c => c.totalDebt > 0)
    .map(c => ({ ...c, score: Math.round(c.totalDebt * 0.6 + c.maxDaysOverdue * 0.4) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return NextResponse.json({ data: result })
}
