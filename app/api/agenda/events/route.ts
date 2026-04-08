/**
 * GET /api/agenda/events?year=2026&month=3
 * Returns all calendar events for a given month:
 *  - Client birthdays (from clients.birthday)
 *  - Installments due (from installments.due_date)
 *  - Overdue installments (past due_date, not fully paid)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayPeru } from '@/lib/utils/timezone'

const STORE_KEY_MAP: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Resolver filtro de tienda según perfil del usuario ──────────────────────
  const { data: profile } = await supabase
    .from('users')
    .select('roles, stores')
    .eq('id', user.id)
    .single()

  const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  const isAdmin = userRoles.includes('admin')
  const userStores: string[] = (profile as any)?.stores || []
  let storeFilter: string | null = null
  if (!isAdmin && userStores.length === 1) {
    storeFilter = STORE_KEY_MAP[userStores[0]] ?? userStores[0]
  }

  // Pre-fetch plan IDs for the store (used to filter installments)
  let planIds: string[] | null = null
  if (storeFilter) {
    const { data: plans } = await supabase
      .from('credit_plans')
      .select('id, sales!inner(store_id)')
      .eq('sales.store_id', storeFilter as string)
    planIds = (plans || []).map((p: any) => p.id)
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year  = parseInt(searchParams.get('year')  || String(now.getFullYear()))
  const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))

  // ── Usar fecha de Perú (America/Lima, UTC-5) para evitar desfase de zona horaria
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startStr = `${year}-${pad(month)}-01`
  const endStr   = `${year}-${pad(month)}-${pad(lastDay)}`
  // Fecha de hoy en hora de Perú (no UTC del servidor)
  const todayStr = getTodayPeru()

  const events: {
    id: string
    type: 'birthday' | 'installment_due' | 'installment_overdue' | 'reminder' | 'scheduled_visit'
    date: string        // YYYY-MM-DD
    title: string
    subtitle?: string
    client_id?: string
    client_name?: string
    amount?: number
    phone?: string
    color: string
  }[] = []

  // ── 1. Birthdays this month ─────────────────────────────────────────────────
  try {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, phone, birthday')
      .eq('active', true)
      .not('birthday', 'is', null)

    if (clients) {
      for (const c of clients) {
        if (!c.birthday) continue
        const bd = new Date(c.birthday)
        const bdMonth = bd.getUTCMonth() + 1
        const bdDay   = bd.getUTCDate()
        if (bdMonth === month) {
          const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(bdDay).padStart(2,'0')}`
          events.push({
            id: `birthday-${c.id}`,
            type: 'birthday',
            date: dateStr,
            title: c.name,
            subtitle: `🎂 Cumpleaños`,
            client_id: c.id,
            client_name: c.name,
            phone: c.phone ?? undefined,
            color: '#ec4899',
          })
        }
      }
    }
  } catch (e) {
    console.error('Error loading birthdays:', e)
  }

  // ── 2. Installments due this month ──────────────────────────────────────────
  try {
    let instQuery = supabase
      .from('installments')
      .select(`
        id,
        due_date,
        amount,
        paid_amount,
        status,
        credit_plans ( client_id, clients ( id, name, phone ) )
      `)
      .gte('due_date', startStr)
      .lte('due_date', endStr)
      .not('status', 'eq', 'PAID')

    if (planIds !== null) {
      if (planIds.length === 0) {
        instQuery = instQuery.in('plan_id', ['00000000-0000-0000-0000-000000000000'])
      } else {
        instQuery = instQuery.in('plan_id', planIds)
      }
    }

    const { data: installments } = await instQuery

    if (installments) {
      for (const inst of installments as any[]) {
        const plan = inst.credit_plans
        if (!plan) continue
        const client = plan.clients
        if (!client) continue

        const remaining = (inst.amount || 0) - (inst.paid_amount || 0)
        // Comparar strings YYYY-MM-DD directamente (sin new Date() para evitar desfase)
        const dueDateStr = (inst.due_date as string).split('T')[0]
        const isPast    = dueDateStr < todayStr
        const type = isPast ? 'installment_overdue' : 'installment_due'

        events.push({
          id: `installment-${inst.id}`,
          type,
          date: dueDateStr,
          title: client.name,
          subtitle: isPast ? `⚠️ Vencida: S/ ${remaining.toFixed(2)}` : `💰 Cuota: S/ ${remaining.toFixed(2)}`,
          client_id: client.id,
          client_name: client.name,
          amount: remaining,
          phone: client.phone ?? undefined,
          color: isPast ? '#ef4444' : '#f59e0b',
        })
      }
    }
  } catch (e) {
    console.error('Error loading installments:', e)
  }

  // ── 3. Overdue installments from previous months ────────────────────────────
  //    Grouped by client, pinned to the same day-of-month as their latest due_date
  //    (clamped to the last day of the current month)
  try {
    let overdueQuery = supabase
      .from('installments')
      .select(`
        id,
        due_date,
        amount,
        paid_amount,
        status,
        credit_plans ( client_id, clients ( id, name, phone ) )
      `)
      .lt('due_date', startStr)
      .not('status', 'eq', 'PAID')

    if (planIds !== null) {
      if (planIds.length === 0) {
        overdueQuery = overdueQuery.in('plan_id', ['00000000-0000-0000-0000-000000000000'])
      } else {
        overdueQuery = overdueQuery.in('plan_id', planIds)
      }
    }

    const { data: overdue } = await overdueQuery

    if (overdue) {
      // Group by client — track count, total, and latest day-of-month
      const byClient: Record<string, {
        name: string; phone: string | null
        count: number; total: number; latestDay: number
      }> = {}

      for (const inst of overdue as any[]) {
        const plan   = inst.credit_plans
        const client = plan?.clients
        if (!client) continue
        const remaining = (inst.amount || 0) - (inst.paid_amount || 0)
        // Extract day number from due_date (YYYY-MM-DD)
        const dueDayStr = (inst.due_date as string).split('T')[0]
        const dueDay = parseInt(dueDayStr.split('-')[2], 10)

        if (!byClient[client.id]) {
          byClient[client.id] = { name: client.name, phone: client.phone, count: 0, total: 0, latestDay: dueDay }
        }
        byClient[client.id].count++
        byClient[client.id].total += remaining
        // Keep the highest day number seen (most recent day-of-month pattern)
        if (dueDay > byClient[client.id].latestDay) {
          byClient[client.id].latestDay = dueDay
        }
      }

      // Pin each group to the same day-of-month as their due date, within current month
      for (const [clientId, info] of Object.entries(byClient)) {
        const pinnedDay = Math.min(info.latestDay, lastDay)
        const dateStr = `${year}-${pad(month)}-${pad(pinnedDay)}`
        events.push({
          id: `overdue-prev-${clientId}`,
          type: 'installment_overdue',
          date: dateStr,
          title: info.name,
          subtitle: `🔴 ${info.count} cuota${info.count > 1 ? 's' : ''} atrasada${info.count > 1 ? 's' : ''}: S/ ${info.total.toFixed(2)}`,
          client_id: clientId,
          client_name: info.name,
          amount: info.total,
          phone: info.phone ?? undefined,
          color: '#ef4444',
        })
      }
    }
  } catch (e) {
    console.error('Error loading overdue installments:', e)
  }

  // ── 4. Recordatorios ───────────────────────────────────────────────────────
  try {
    const { data: reminders } = await supabase
      .from('agenda_reminders')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr)

    if (reminders) {
      const colorMap: Record<string, string> = {
        purple: '#8b5cf6', blue: '#3b82f6', green: '#22c55e',
        orange: '#f97316', red: '#ef4444',
      }
      for (const r of reminders) {
        events.push({
          id: `reminder-${r.id}`,
          type: 'reminder',
          date: r.date,
          title: r.title,
          subtitle: r.note ? `📝 ${r.note}` : '📝 Recordatorio',
          color: colorMap[r.color] || '#8b5cf6',
          reminder_id: r.id,
        } as any)
      }
    }
  } catch (e) {
    console.error('Error loading reminders:', e)
  }

  // ── 5. Visitas programadas ──────────────────────────────────────────────────
  try {
    const { data: visits } = await supabase
      .from('agenda_scheduled_visits')
      .select('*')
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .not('status', 'eq', 'cancelled')

    if (visits) {
      for (const v of visits) {
        const clientCount = (v.client_ids || []).length
        // Construir subtitle con nota si existe
        const baseSub = `🗓️ ${clientCount} cliente${clientCount !== 1 ? 's' : ''} · ${v.visit_type}`
        const subtitle = v.note ? `${baseSub} — ${v.note}` : baseSub

        events.push({
          id: `svisit-${v.id}`,
          type: 'scheduled_visit',
          date: v.scheduled_date,
          title: v.title,
          subtitle,
          color: '#6366f1',
          visit_id: v.id,
          visit_type: v.visit_type,
          client_ids: v.client_ids,
          status: v.status,
          note: v.note || null,
        } as any)
      }
    }
  } catch (e) {
    console.error('Error loading scheduled visits:', e)
  }

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    year,
    month,
    startStr,
    endStr,
    events,
    summary: {
      birthdays: events.filter(e => e.type === 'birthday').length,
      due: events.filter(e => e.type === 'installment_due').length,
      overdue: events.filter(e => e.type === 'installment_overdue').length,
      reminders: events.filter(e => e.type === 'reminder').length,
      visits: events.filter(e => e.type === 'scheduled_visit').length,
    },
  })
}
