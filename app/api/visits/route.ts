/**
 * Client Visits API
 *
 * GET  /api/visits?client_id=X           — history for one client
 * GET  /api/visits?visit_type=Cobranza   — filter by type
 * GET  /api/visits?date=2026-02-25       — filter by date (YYYY-MM-DD)
 * POST /api/visits                       — create a new visit record
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const params   = request.nextUrl.searchParams

    const clientId  = params.get('client_id')
    const visitType = params.get('visit_type')
    const date      = params.get('date') // YYYY-MM-DD

    let query = supabase
      .from('client_visits')
      .select(`
        id,
        client_id,
        visit_date,
        visit_type,
        result,
        comment,
        image_url,
        created_at,
        clients ( id, name, phone, address )
      `)
      .order('visit_date', { ascending: false })
      .limit(200)

    if (clientId)  query = query.eq('client_id', clientId)
    if (visitType) query = query.eq('visit_type', visitType)
    if (date) {
      // Filter visits on a specific calendar day
      query = query
        .gte('visit_date', `${date}T00:00:00.000Z`)
        .lt('visit_date',  `${date}T23:59:59.999Z`)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body     = await request.json()

    const { client_id, visit_type, result, comment, image_url } = body

    if (!client_id) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 })
    if (!result)    return NextResponse.json({ error: 'result requerido'    }, { status: 400 })

    const { data, error } = await supabase
      .from('client_visits')
      .insert({
        client_id,
        visit_type: visit_type || 'Cobranza',
        result,
        comment:   comment   || null,
        image_url: image_url || null,
        visit_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
