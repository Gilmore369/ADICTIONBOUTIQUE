/**
 * GET  /api/agenda/scheduled-visits?year=2026&month=3  → list for month
 * POST /api/agenda/scheduled-visits                    → create visit
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTodayPeru } from '@/lib/utils/timezone'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const now   = new Date()
  const year  = parseInt(searchParams.get('year')  || String(now.getFullYear()))
  const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))

  const startStr = `${year}-${String(month).padStart(2,'0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endStr  = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`

  const { data, error } = await supabase
    .from('agenda_scheduled_visits')
    .select('*')
    .gte('scheduled_date', startStr)
    .lte('scheduled_date', endStr)
    .order('scheduled_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with client names
  const visits = data || []
  const allClientIds = [...new Set(visits.flatMap(v => v.client_ids || []))]

  let clientMap: Record<string, { name: string; phone: string | null; credit_used: number }> = {}
  if (allClientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, phone, credit_used')
      .in('id', allClientIds)
    if (clients) {
      for (const c of clients) clientMap[c.id] = c
    }
  }

  const enriched = visits.map(v => ({
    ...v,
    clients: (v.client_ids || []).map((id: string) => clientMap[id]).filter(Boolean),
  }))

  return NextResponse.json({ data: enriched })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, scheduled_date, visit_type, note, client_ids } = body

  if (!scheduled_date) {
    return NextResponse.json({ error: 'scheduled_date es requerido' }, { status: 400 })
  }
  if (!Array.isArray(client_ids) || client_ids.length === 0) {
    return NextResponse.json({ error: 'Debes seleccionar al menos un cliente' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('agenda_scheduled_visits')
    .insert({
      title: title?.trim() || 'Visita de cobranza',
      scheduled_date,
      visit_type: visit_type || 'Cobranza',
      note: note || null,
      client_ids,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
