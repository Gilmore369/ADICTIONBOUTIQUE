/**
 * API: Gestión de usuarios (solo admin)
 * GET  /api/admin/users        — listar usuarios
 * POST /api/admin/users        — crear usuario (crea en Auth + tabla users)
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

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, roles, stores, active, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, email, password, roles, stores } = body

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email y password son requeridos' }, { status: 400 })
  }

  // Crear en Supabase Auth usando service role
  const service = createServiceClient()
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Insertar en tabla users
  const { data, error } = await service
    .from('users')
    .insert({
      id: authData.user.id,
      name,
      email,
      roles: roles || ['vendedor'],
      stores: stores || ['MUJERES'],
      active: true,
    })
    .select()
    .single()

  if (error) {
    // Revertir creación en Auth si falla la BD
    await service.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
