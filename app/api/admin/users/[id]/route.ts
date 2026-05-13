/**
 * API: Gestión de usuario individual (solo admin)
 * PATCH  /api/admin/users/[id]  — actualizar nombre/roles/tiendas/activo
 * DELETE /api/admin/users/[id]  — desactivar usuario (soft-delete)
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logAudit } from '@/lib/audit'

const VALID_ROLES = ['admin', 'vendedor', 'cobrador'] as const
const VALID_STORES = ['MUJERES', 'HOMBRES'] as const

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('roles').eq('id', user.id).single()
  const roles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  if (!roles.includes('admin')) return null
  return user
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { name, roles, stores, active, profile_photo_url } = body
  const updates: Record<string, any> = {}

  if (profile_photo_url !== undefined) {
    if (profile_photo_url === null || profile_photo_url === '') {
      updates.profile_photo_url = null
    } else if (typeof profile_photo_url === 'string') {
      updates.profile_photo_url = profile_photo_url.trim()
    }
  }

  // ── Validar y armar updates ──────────────────────────────────────────────
  if (name !== undefined) {
    const n = String(name).trim()
    if (n.length < 2) return NextResponse.json({ error: 'El nombre debe tener al menos 2 caracteres' }, { status: 400 })
    updates.name = n
  }

  if (roles !== undefined) {
    if (!Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json({ error: 'Debes asignar al menos un rol' }, { status: 400 })
    }
    const normalized = roles.map((r: any) => String(r).toLowerCase().trim())
    const invalid = normalized.find(r => !(VALID_ROLES as readonly string[]).includes(r))
    if (invalid) return NextResponse.json({ error: `Rol inválido: "${invalid}"` }, { status: 400 })
    updates.roles = normalized
  }

  if (stores !== undefined) {
    if (!Array.isArray(stores) || stores.length === 0) {
      return NextResponse.json({ error: 'Debes asignar al menos una tienda' }, { status: 400 })
    }
    const normalized = stores.map((s: any) => String(s).toUpperCase().trim())
    const invalid = normalized.find(s => !(VALID_STORES as readonly string[]).includes(s))
    if (invalid) return NextResponse.json({ error: `Tienda inválida: "${invalid}"` }, { status: 400 })
    updates.stores = normalized
  }

  if (active !== undefined) updates.active = !!active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Sin cambios para aplicar' }, { status: 400 })
  }

  // ── Prevenir auto-desactivación o quitarse a sí mismo el rol admin ───────
  if (id === admin.id) {
    if (updates.active === false) {
      return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
    }
    if (updates.roles && !updates.roles.includes('admin')) {
      return NextResponse.json({ error: 'No puedes quitarte el rol admin a ti mismo' }, { status: 400 })
    }
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    userId: admin.id,
    action: 'UPDATE',
    entityType: 'user',
    entityId: id,
    entityName: (data as any)?.name ?? id,
    detail: `Actualizado: ${Object.keys(updates).join(', ')}`,
    newValues: updates,
  }).catch(() => {})

  return NextResponse.json(data)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (id === admin.id) {
    return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('users')
    .update({ active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    userId: admin.id,
    action: 'DELETE',
    entityType: 'user',
    entityId: id,
    entityName: (data as any)?.name ?? id,
    detail: 'Usuario desactivado',
  }).catch(() => {})

  return NextResponse.json(data)
}
