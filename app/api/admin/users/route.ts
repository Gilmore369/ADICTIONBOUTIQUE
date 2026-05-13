/**
 * API: Gestión de usuarios (solo admin)
 * GET  /api/admin/users        — listar usuarios
 * POST /api/admin/users        — crear usuario (Auth + tabla users)
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logAudit } from '@/lib/audit'

const VALID_ROLES = ['admin', 'vendedor', 'cajero', 'cobrador'] as const
const VALID_STORES = ['MUJERES', 'HOMBRES'] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, roles, stores, active, created_at, profile_photo_url')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const roles: string[] = Array.isArray(body.roles) ? body.roles : []
  const stores: string[] = Array.isArray(body.stores) ? body.stores : []
  const profilePhotoUrl: string | null = typeof body.profile_photo_url === 'string' && body.profile_photo_url.trim()
    ? body.profile_photo_url.trim()
    : null

  // ── Validaciones server-side ─────────────────────────────────────────────
  if (name.length < 2) return NextResponse.json({ error: 'El nombre debe tener al menos 2 caracteres' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Email con formato inválido' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  if (roles.length === 0) return NextResponse.json({ error: 'Debes asignar al menos un rol' }, { status: 400 })

  const normalizedRoles = roles.map(r => String(r).toLowerCase().trim())
  const invalidRole = normalizedRoles.find(r => !(VALID_ROLES as readonly string[]).includes(r))
  if (invalidRole) return NextResponse.json({ error: `Rol inválido: "${invalidRole}". Permitidos: ${VALID_ROLES.join(', ')}` }, { status: 400 })

  const normalizedStores = stores.map(s => String(s).toUpperCase().trim())
  if (normalizedStores.length === 0) return NextResponse.json({ error: 'Debes asignar al menos una tienda' }, { status: 400 })
  const invalidStore = normalizedStores.find(s => !(VALID_STORES as readonly string[]).includes(s))
  if (invalidStore) return NextResponse.json({ error: `Tienda inválida: "${invalidStore}". Permitidas: ${VALID_STORES.join(', ')}` }, { status: 400 })

  // ── Pre-check: email ya existe ───────────────────────────────────────────
  const service = createServiceClient()
  const { data: existing } = await service.from('users').select('id').eq('email', email).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 })

  // ── Crear en Supabase Auth ───────────────────────────────────────────────
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // ── Insertar en tabla users ──────────────────────────────────────────────
  const { data, error } = await service
    .from('users')
    .insert({
      id: authData.user.id,
      name,
      email,
      roles: normalizedRoles,
      stores: normalizedStores,
      active: true,
      profile_photo_url: profilePhotoUrl,
    } as any)
    .select()
    .single()

  if (error) {
    // Rollback en Auth si la BD falla
    await service.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Audit log ────────────────────────────────────────────────────────────
  await logAudit({
    userId: admin.id,
    action: 'CREATE',
    entityType: 'user',
    entityId: data.id,
    entityName: data.name,
    detail: `Usuario creado · roles: ${normalizedRoles.join(',')} · tiendas: ${normalizedStores.join(',')}`,
    newValues: { name, email, roles: normalizedRoles, stores: normalizedStores },
  }).catch(() => {})

  return NextResponse.json(data, { status: 201 })
}
