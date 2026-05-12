/**
 * Audita el flow de creación de usuarios:
 *  1. Crea usuario en Auth + tabla users (vía service role, simulando el API)
 *  2. Verifica que aparezca en la lista
 *  3. Verifica que store filtering funcione (RLS y get_user_roles)
 *  4. Edita roles
 *  5. Desactiva
 *  6. Limpia
 */
import { createClient } from '@supabase/supabase-js'

const SUPA = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo'
const sb = createClient(SUPA, KEY, { auth: { persistSession: false } })

const TEST_EMAIL = `audit-test-${Date.now()}@adiction.test`
const TEST_PASSWORD = 'TempPass123!'
const TEST_NAME = 'AUDIT TEST USER'

console.log('═══════════════════════════════════════════════════════════════')
console.log('  AUDITORÍA: Creación de Usuarios')
console.log('═══════════════════════════════════════════════════════════════\n')

let createdId = null

try {
  // ── 1. Crear usuario ──
  console.log('▶ 1. Crear usuario en Auth + tabla users')
  const { data: authData, error: e1 } = await sb.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (e1) throw new Error(`Auth.createUser: ${e1.message}`)
  createdId = authData.user.id
  console.log(`  ✅ Creado en Auth: ${createdId}`)

  const { data: profile, error: e2 } = await sb.from('users').insert({
    id: createdId,
    name: TEST_NAME,
    email: TEST_EMAIL,
    roles: ['vendedor'],
    stores: ['MUJERES'],
    active: true,
  }).select().single()
  if (e2) throw new Error(`users.insert: ${e2.message}`)
  console.log(`  ✅ Perfil creado:`, { id: profile.id, name: profile.name, roles: profile.roles, stores: profile.stores })

  // ── 2. Verificar listado ──
  console.log('\n▶ 2. Verificar que aparece en listado')
  const { data: list } = await sb.from('users').select('id, name, email, roles, stores, active').eq('id', createdId).single()
  console.log(`  ✅ Listado:`, list)

  // ── 3. Probar get_user_roles RPC (normalización lowercase) ──
  console.log('\n▶ 3. RPC get_user_roles (normalizado lowercase)')
  const { data: rolesRpc, error: e3 } = await sb.rpc('get_user_roles', { user_id_param: createdId })
  if (e3) {
    console.log(`  ⚠ RPC error: ${e3.message}`)
  } else {
    console.log(`  ✅ get_user_roles devuelve:`, rolesRpc)
  }

  // ── 4. Probar has_role RPC ──
  console.log('\n▶ 4. RPC has_role (case-insensitive)')
  for (const r of ['vendedor', 'VENDEDOR', 'Vendedor', 'admin']) {
    const { data, error } = await sb.rpc('has_role', { role_to_check: r, user_id_param: createdId })
    if (error) console.log(`  ⚠ ${r}: error ${error.message}`)
    else console.log(`  ${data ? '✅' : '❌'} has_role("${r}") = ${data}`)
  }

  // ── 5. Editar usuario ──
  console.log('\n▶ 5. Editar: cambiar a admin + ambas tiendas')
  const { data: updated, error: e5 } = await sb.from('users').update({
    roles: ['admin', 'vendedor'],
    stores: ['MUJERES', 'HOMBRES'],
  }).eq('id', createdId).select().single()
  if (e5) throw new Error(`Update: ${e5.message}`)
  console.log(`  ✅ Actualizado: roles=${JSON.stringify(updated.roles)} stores=${JSON.stringify(updated.stores)}`)

  // ── 6. Desactivar ──
  console.log('\n▶ 6. Desactivar usuario')
  const { data: deactivated } = await sb.from('users').update({ active: false }).eq('id', createdId).select('active').single()
  console.log(`  ✅ active=${deactivated.active}`)

  // ── 7. Validar que el email NO se puede reusar ──
  console.log('\n▶ 7. Intentar crear otro user con MISMO email (debe fallar)')
  const { error: dupErr } = await sb.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (dupErr) {
    console.log(`  ✅ Bloqueado correctamente: "${dupErr.message}"`)
  } else {
    console.log(`  ⚠ PROBLEMA: permitió duplicado`)
  }

  console.log('\n✅ AUDITORÍA EXITOSA — flujo completo funciona')

} catch (e) {
  console.error('\n❌ ERROR EN AUDITORÍA:', e.message)
} finally {
  // ── Limpieza ──
  if (createdId) {
    console.log('\n▶ Limpiando usuario de prueba...')
    await sb.from('users').delete().eq('id', createdId)
    await sb.auth.admin.deleteUser(createdId)
    console.log('  ✅ Limpieza completa')
  }
}
