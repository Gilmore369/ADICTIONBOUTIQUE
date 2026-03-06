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

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

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
        payment_amount,
        payment_method,
        payment_proof_url,
        promise_date,
        promise_amount,
        notes,
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
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    
    const body = await request.json()

    const { 
      client_id, 
      visit_type, 
      result, 
      comment, 
      image_url,
      payment_amount,
      payment_method,
      payment_proof_url,
      promise_date,
      promise_amount
    } = body

    if (!client_id) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 })
    if (!result)    return NextResponse.json({ error: 'result requerido'    }, { status: 400 })

    // Get client info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name')
      .eq('id', client_id)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Create visit record
    const { data: visit, error: visitError } = await supabase
      .from('client_visits')
      .insert({
        client_id,
        user_id: user.id,
        visit_type: visit_type || 'Cobranza',
        result,
        comment: comment || null,
        image_url: image_url || null,
        payment_amount: payment_amount || null,
        payment_method: payment_method || null,
        payment_proof_url: payment_proof_url || null,
        promise_date: promise_date || null,
        promise_amount: promise_amount || null,
        visit_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (visitError) {
      console.error('Error creating visit:', visitError)
      return NextResponse.json({ error: visitError.message }, { status: 500 })
    }

    // Create corresponding collection action for tracking
    let collectionActionId: string | null = null
    
    // Map visit result to collection action result
    const actionResultMap: Record<string, string> = {
      'Pagó': 'PAGO_REALIZADO',
      'Abono parcial': 'PAGO_PARCIAL',
      'Prometió pagar': 'PROMETE_PAGAR_FECHA',
      'No estaba': 'CLIENTE_NO_UBICADO',
      'Rechazó': 'SE_NIEGA_PAGAR',
      'Interesado': 'CLIENTE_COLABORADOR',
      'Dejé recado': 'OTRO',
      'Sin respuesta': 'NO_CONTESTA',
    }

    const collectionResult = actionResultMap[result] || 'OTRO'
    
    const { data: collectionAction, error: actionError } = await supabase
      .from('collection_actions')
      .insert({
        client_id,
        client_name: client.name,
        action_type: 'VISITA',
        result: collectionResult,
        payment_promise_date: promise_date || null,
        notes: comment || `Visita de ${visit_type}: ${result}`,
        user_id: user.id,
      })
      .select('id')
      .single()

    if (!actionError && collectionAction) {
      collectionActionId = collectionAction.id
      
      // Link visit to collection action
      await supabase
        .from('client_visits')
        .update({ collection_action_id: collectionActionId })
        .eq('id', visit.id)
    }

    return NextResponse.json({ data: { ...visit, collection_action_id: collectionActionId } }, { status: 201 })
  } catch (error) {
    console.error('Error in visits API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
