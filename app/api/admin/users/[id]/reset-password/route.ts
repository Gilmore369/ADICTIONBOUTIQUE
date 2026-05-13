/**
 * POST /api/admin/users/[id]/reset-password
 * Permite que un admin asigne una nueva contraseña a cualquier usuario.
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logAudit } from '@/lib/audit'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = createServiceClient()
  const { data: profile } = await service.from('users').select('roles').eq('id', user.id).single()
  const roles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  if (!roles.includes('admin')) return null
  return user
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const password = String(body.password || '')
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const service = createServiceClient()
  // Resetea la contraseña en Auth
  const { error } = await service.auth.admin.updateUserById(id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Obtener nombre para audit log
  const { data: user } = await service.from('users').select('name').eq('id', id).single()

  await logAudit({
    userId: admin.id,
    action: 'UPDATE',
    entityType: 'user',
    entityId: id,
    entityName: (user as any)?.name ?? id,
    detail: 'Contraseña restablecida por admin',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
