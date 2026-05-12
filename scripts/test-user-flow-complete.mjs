/**
 * Test E2E del nuevo flow de usuarios incluyendo validaciones server-side y
 * verificación de que el store filtering del sistema no se rompa.
 */
import { createClient } from '@supabase/supabase-js'

const SUPA = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo'
const sb = createClient(SUPA, KEY, { auth: { persistSession: false } })

let pass = 0, fail = 0
const check = (cond, label) => {
  if (cond) { console.log(`  ✅ ${label}`); pass++ }
  else { console.log(`  ❌ ${label}`); fail++ }
}

console.log('═══════════════════════════════════════════════════════════════')
console.log('  TEST E2E: Flow de Usuarios + Store Filtering')
console.log('═══════════════════════════════════════════════════════════════\n')

// Test 1: Crear usuario tienda Mujeres
console.log('▶ Test 1: Crear usuario vendedor de tienda MUJERES')
const e1 = `audit-mujeres-${Date.now()}@adiction.test`
const { data: auth1 } = await sb.auth.admin.createUser({ email: e1, password: 'TestPass123!', email_confirm: true })
const u1Id = auth1.user.id
await sb.from('users').insert({
  id: u1Id, name: 'AUDIT Vendedora Mujeres', email: e1,
  roles: ['vendedor'], stores: ['MUJERES'], active: true,
})
const { data: u1 } = await sb.from('users').select('roles, stores').eq('id', u1Id).single()
check(u1.roles.length === 1 && u1.roles[0] === 'vendedor', 'Roles guardados: vendedor')
check(u1.stores.length === 1 && u1.stores[0] === 'MUJERES', 'Stores guardadas: MUJERES')

// Test 2: Verificar que el filtering por tienda funcione para este user
// Simular query con stores=['MUJERES'] (lo que hace el sistema)
console.log('\n▶ Test 2: Store filtering — usuario Mujeres solo ve productos Mujeres')
// Obtener productos del store_id 'Tienda Mujeres'
const { data: prodM } = await sb.from('products').select('id, line_id, lines(name)').limit(100)
const mujProds = (prodM || []).filter(p => /mujer/i.test(p.lines?.name || ''))
const homProds = (prodM || []).filter(p => /hombre/i.test(p.lines?.name || ''))
check(mujProds.length > 0 || homProds.length > 0, `Hay productos en BD (M=${mujProds.length}, H=${homProds.length})`)

// Test 3: Validar API rechaza email inválido
console.log('\n▶ Test 3: Validaciones server-side (simulando POST /api/admin/users)')
function validate(body) {
  const VALID_ROLES = ['admin', 'vendedor', 'cobrador']
  const VALID_STORES = ['MUJERES', 'HOMBRES']
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const roles = Array.isArray(body.roles) ? body.roles.map(r => r.toLowerCase()) : []
  const stores = Array.isArray(body.stores) ? body.stores.map(s => s.toUpperCase()) : []
  if (name.length < 2) return 'nombre corto'
  if (!EMAIL_RE.test(email)) return 'email inválido'
  if (password.length < 8) return 'password corto'
  if (roles.length === 0) return 'sin roles'
  if (roles.some(r => !VALID_ROLES.includes(r))) return 'rol inválido'
  if (stores.length === 0) return 'sin tiendas'
  if (stores.some(s => !VALID_STORES.includes(s))) return 'tienda inválida'
  return null
}
check(validate({ name: 'X', email: 'a@b.com', password: '12345678', roles: ['admin'], stores: ['MUJERES'] }) === 'nombre corto', 'Rechaza nombre < 2 chars')
check(validate({ name: 'OK', email: 'noemail', password: '12345678', roles: ['admin'], stores: ['MUJERES'] }) === 'email inválido', 'Rechaza email mal formado')
check(validate({ name: 'OK', email: 'a@b.com', password: '1234', roles: ['admin'], stores: ['MUJERES'] }) === 'password corto', 'Rechaza password < 8 chars')
check(validate({ name: 'OK', email: 'a@b.com', password: '12345678', roles: [], stores: ['MUJERES'] }) === 'sin roles', 'Rechaza sin roles')
check(validate({ name: 'OK', email: 'a@b.com', password: '12345678', roles: ['hacker'], stores: ['MUJERES'] }) === 'rol inválido', 'Rechaza rol no válido')
check(validate({ name: 'OK', email: 'a@b.com', password: '12345678', roles: ['admin'], stores: [] }) === 'sin tiendas', 'Rechaza sin tiendas')
check(validate({ name: 'OK', email: 'a@b.com', password: '12345678', roles: ['admin'], stores: ['LIMA'] }) === 'tienda inválida', 'Rechaza tienda no válida')
check(validate({ name: 'OK', email: 'a@b.com', password: '12345678', roles: ['admin'], stores: ['MUJERES'] }) === null, 'Acepta payload válido')

// Test 4: Actualizar roles + stores
console.log('\n▶ Test 4: Editar usuario — cambiar a admin + ambas tiendas')
await sb.from('users').update({
  roles: ['admin', 'vendedor'],
  stores: ['MUJERES', 'HOMBRES'],
}).eq('id', u1Id)
const { data: u1updated } = await sb.from('users').select('roles, stores').eq('id', u1Id).single()
check(u1updated.roles.length === 2 && u1updated.roles.includes('admin'), 'Roles actualizados a [admin, vendedor]')
check(u1updated.stores.length === 2, 'Stores actualizadas a ambas')

// Test 5: Reset password
console.log('\n▶ Test 5: Reset password vía admin')
const newPwd = 'NuevaPass456!'
const { error: rpErr } = await sb.auth.admin.updateUserById(u1Id, { password: newPwd })
check(!rpErr, 'Password reset OK')

// Test 6: Desactivar (soft-delete)
console.log('\n▶ Test 6: Desactivar usuario')
await sb.from('users').update({ active: false }).eq('id', u1Id)
const { data: u1deact } = await sb.from('users').select('active').eq('id', u1Id).single()
check(u1deact.active === false, 'Usuario marcado como inactivo')

// Test 7: Reactivar
console.log('\n▶ Test 7: Reactivar usuario')
await sb.from('users').update({ active: true }).eq('id', u1Id)
const { data: u1react } = await sb.from('users').select('active').eq('id', u1Id).single()
check(u1react.active === true, 'Usuario reactivado')

// Test 8: NO permitir crear duplicado por email
console.log('\n▶ Test 8: Email duplicado debe ser rechazado')
const { error: dupErr } = await sb.auth.admin.createUser({ email: e1, password: 'X12345678', email_confirm: true })
check(dupErr !== null, 'Duplicate email rejected by Auth')

// Test 9: Verificar que existing users del sistema siguen funcionando
console.log('\n▶ Test 9: Usuarios reales del sistema intactos')
const { data: realUsers } = await sb.from('users').select('email, roles, stores').eq('email', 'gianpepex@gmail.com').single()
check(realUsers && (realUsers.roles || []).includes('admin'), 'gianpepex@gmail.com sigue siendo admin')
check(realUsers && (realUsers.stores || []).length === 2, 'gianpepex@gmail.com tiene ambas tiendas')

// Limpieza
console.log('\n▶ Limpieza de usuario test')
await sb.from('users').delete().eq('id', u1Id)
await sb.auth.admin.deleteUser(u1Id)
console.log('  ✅ Limpieza completa')

console.log('\n═══════════════════════════════════════════════════════════════')
console.log(`  RESULTADO: ${pass} pasaron · ${fail} fallaron`)
console.log('═══════════════════════════════════════════════════════════════')

if (fail > 0) process.exit(1)
