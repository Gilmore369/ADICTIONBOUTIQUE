/**
 * GET  /api/agenda/reminders?year=2026&month=3  → list reminders for that month
 * POST /api/agenda/reminders                    → create reminder
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
    .from('agenda_reminders')
    .select('*')
    .gte('date', startStr)
    .lte('date', endStr)
    .order('date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, date, note, color } = body

  if (!title?.trim() || !date) {
    return NextResponse.json({ error: 'title y date son requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('agenda_reminders')
    .insert({ title: title.trim(), date, note: note || null, color: color || 'purple', user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
