/**
 * PATCH /api/collections/actions/[id]  — Edit a collection action
 * DELETE /api/collections/actions/[id] — Delete a collection action
 *
 * Only the owner (user_id) or an admin can edit/delete.
 */

import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    // Verify ownership or admin
    const { data: existing } = await service
      .from('collection_actions')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Check if user is admin
    const { data: profile } = await service
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single()
    const isAdmin = ((profile as any)?.roles || [])
      .map((r: string) => r.toLowerCase())
      .includes('admin')

    if (existing.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: solo el cobrador o un admin puede editar' }, { status: 403 })
    }

    const body = await request.json()
    const { action_type, result, notes, payment_promise_date } = body

    const { data, error } = await service
      .from('collection_actions')
      .update({
        action_type,
        result,
        notes: notes || null,
        payment_promise_date: payment_promise_date || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('PATCH collection_action error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    // Verify ownership or admin
    const { data: existing } = await service
      .from('collection_actions')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: profile } = await service
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single()
    const isAdmin = ((profile as any)?.roles || [])
      .map((r: string) => r.toLowerCase())
      .includes('admin')

    if (existing.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: solo el cobrador o un admin puede eliminar' }, { status: 403 })
    }

    const { error } = await service
      .from('collection_actions')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE collection_action error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
