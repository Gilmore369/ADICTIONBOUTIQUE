/**
 * Blacklist API Routes
 *
 * POST /api/clients/blacklist        — ejecuta auto_blacklist_overdue_clients() (solo admin)
 * DELETE /api/clients/blacklist?id=X — remueve un cliente de la lista negra
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// ── POST: ejecutar auto-blacklist (admin) ─────────────────────────────────────
export async function POST() {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar rol admin
    const { data: profile } = await supabase
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single()

    const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
    if (!profile || !userRoles.includes('admin')) {
      return NextResponse.json({ error: 'Solo administradores pueden ejecutar esta acción' }, { status: 403 })
    }

    // Ejecutar función de auto-blacklist
    const { data, error } = await supabase.rpc('auto_blacklist_overdue_clients')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      blacklisted_count: data,
      message: `${data} cliente(s) agregados a la lista negra`,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── DELETE: remover cliente de lista negra ────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const clientId = request.nextUrl.searchParams.get('id')
    if (!clientId) {
      return NextResponse.json({ error: 'Se requiere el ID del cliente' }, { status: 400 })
    }

    // Verificar que el cliente existe
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, blacklisted')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    if (!client.blacklisted) {
      return NextResponse.json({ error: 'El cliente no está en lista negra' }, { status: 400 })
    }

    // Remover de lista negra
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        blacklisted: false,
        blacklisted_at: null,
        blacklisted_reason: null,
      })
      .eq('id', clientId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Cliente ${client.name} removido de la lista negra`,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
