/**
 * GET /api/agenda/events?year=2026&month=3
 * Returns all calendar events for a given month:
 *  - Client birthdays (from clients.birthday)
 *  - Installments due (from installments.due_date)
 *  - Overdue installments (past due_date, not fully paid)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year  = parseInt(searchParams.get('year')  || String(now.getFullYear()))
  const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))

  // Range for the month
  const startDate = new Date(year, month - 1, 1)
  const endDate   = new Date(year, month, 0) // last day of month
  const startStr  = startDate.toISOString().split('T')[0]
  const endStr    = endDate.toISOString().split('T')[0]
  const todayStr  = now.toISOString().split('T')[0]

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
    const { data: installments } = await supabase
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

    if (installments) {
      for (const inst of installments as any[]) {
        const plan = inst.credit_plans
        if (!plan) continue
        const client = plan.clients
        if (!client) continue

        const remaining = (inst.amount || 0) - (inst.paid_amount || 0)
        const isPast    = inst.due_date < todayStr
        const type = isPast ? 'installment_overdue' : 'installment_due'

        events.push({
          id: `installment-${inst.id}`,
          type,
          date: inst.due_date,
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

  // ── 3. Overdue installments from previous months (show on day 1) ────────────
  try {
    const { data: overdue } = await supabase
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

    if (overdue) {
      // Group by client to avoid flooding the calendar
      const byClient: Record<string, { name: string; phone: string | null; count: number; total: number }> = {}
      for (const inst of overdue as any[]) {
        const plan   = inst.credit_plans
        const client = plan?.clients
        if (!client) continue
        const remaining = (inst.amount || 0) - (inst.paid_amount || 0)
        if (!byClient[client.id]) {
          byClient[client.id] = { name: client.name, phone: client.phone, count: 0, total: 0 }
        }
        byClient[client.id].count++
        byClient[client.id].total += remaining
      }
      // Pin these to day 1 of the viewed month
      for (const [clientId, info] of Object.entries(byClient)) {
        events.push({
          id: `overdue-prev-${clientId}`,
          type: 'installment_overdue',
          date: startStr,
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
        events.push({
          id: `svisit-${v.id}`,
          type: 'scheduled_visit',
          date: v.scheduled_date,
          title: v.title,
          subtitle: `🗓️ ${clientCount} cliente${clientCount !== 1 ? 's' : ''} · ${v.visit_type}`,
          color: '#6366f1',
          visit_id: v.id,
          visit_type: v.visit_type,
          client_ids: v.client_ids,
          status: v.status,
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
