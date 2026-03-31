/**
 * API: Gestión de usuario individual (solo admin)
 * PATCH  /api/admin/users/[id]  — actualizar rol/tiendas/nombre
 * DELETE /api/admin/users/[id]  — desactivar usuario
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('roles').eq('id', user.id).single()
  const roles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  if (!roles.includes('admin')) return null
  return user
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, roles, stores, active } = body
  const updates: Record<string, any> = {}
  if (name !== undefined) updates.name = name
  if (roles !== undefined) updates.roles = roles
  if (stores !== undefined) updates.stores = stores
  if (active !== undefined) updates.active = active

  const service = createServiceClient()
  const { data, error } = await service
    .from('users')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // No eliminar — solo desactivar
  const service = createServiceClient()
  const { data, error } = await service
    .from('users')
    .update({ active: false })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
