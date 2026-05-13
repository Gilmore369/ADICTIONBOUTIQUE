/**
 * Limpieza segura de usuarios + datos test del sistema.
 *
 * Conserva SOLO:
 *   - Admin User (gianpepex@gmail.com)
 *   - Arizitah TuLof (karianaghostimporter@gmail.com)
 *
 * Para cada usuario a borrar:
 *   1. Detecta referencias FK en tablas (sales, payments, cash_shifts, etc.)
 *   2. Las reasigna al admin principal (preserva integridad histórica)
 *   3. Borra el row de public.users
 *   4. Borra de auth.users vía admin API
 *
 * También limpia datos test 99TEST* y batches TEST-99*.
 */

import { createClient } from '@supabase/supabase-js'

const SUPA = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo'

const sb = createClient(SUPA, KEY, { auth: { persistSession: false } })

// IDs a conservar
const KEEP_IDS = new Set([
  '804419ec-cda6-4a6e-9388-c44f0058e635', // Admin User gianpepex
  '3cadd8ca-07dd-495c-82f5-65afc5fd5bc3', // Arizitah karianaghostimporter
])
const ADMIN_ID = '804419ec-cda6-4a6e-9388-c44f0058e635' // donde reasignamos referencias

// Tablas con user_id que requieren reasignación (preservar historial)
const TABLES_TO_REASSIGN = [
  'sales',
  'payments',
  'cash_shifts',
  'cash_expenses',
  'movements',
  'returns',
  'collection_actions',
  'client_visits',
  'audit_log',
]

console.log('═══════════════════════════════════════════════════════════════')
console.log('  LIMPIEZA — Usuarios + datos test 99TEST*')
console.log('═══════════════════════════════════════════════════════════════\n')

// ── 1. Limpieza datos test 99TEST* ───────────────────────────────────────
console.log('▶ Paso 1: Limpiando datos test 99TEST*')
{
  const { data: batches } = await sb
    .from('legacy_import_batches')
    .select('id')
    .like('source_label', 'TEST-99%')
  const batchIds = (batches || []).map(b => b.id)
  console.log(`  Batches test encontrados: ${batchIds.length}`)

  const { data: testClients } = await sb.from('clients').select('id').like('dni', '99TEST%')
  const clientIds = (testClients || []).map(c => c.id)
  console.log(`  Clientes test (DNI 99TEST*): ${clientIds.length}`)

  if (batchIds.length > 0 || clientIds.length > 0) {
    // Orden FK-safe: payments → installments → credit_plans → clients → batches
    const { count: payCount } = await sb.from('payments')
      .delete({ count: 'exact' }).in('legacy_batch_id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000'])
    console.log(`  ✓ payments borrados: ${payCount ?? 0}`)

    const { data: testPlans } = await sb.from('credit_plans').select('id').in('legacy_batch_id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000'])
    const planIds = (testPlans || []).map(p => p.id)
    if (planIds.length > 0) {
      const { count: instCount } = await sb.from('installments').delete({ count: 'exact' }).in('plan_id', planIds)
      console.log(`  ✓ installments borradas: ${instCount ?? 0}`)
      const { count: planCount } = await sb.from('credit_plans').delete({ count: 'exact' }).in('id', planIds)
      console.log(`  ✓ credit_plans borrados: ${planCount ?? 0}`)
    }

    const { count: cCount } = await sb.from('clients').delete({ count: 'exact' }).like('dni', '99TEST%')
    console.log(`  ✓ clients borrados: ${cCount ?? 0}`)

    if (batchIds.length > 0) {
      const { count: bCount } = await sb.from('legacy_import_batches').delete({ count: 'exact' }).in('id', batchIds)
      console.log(`  ✓ legacy_import_batches borrados: ${bCount ?? 0}`)
    }
  } else {
    console.log('  ✓ Ya no había datos test')
  }
}

// ── 2. Listar usuarios actuales ──────────────────────────────────────────
console.log('\n▶ Paso 2: Identificando usuarios a borrar')
const { data: { users: authUsers }, error: listErr } = await sb.auth.admin.listUsers({ perPage: 200 })
if (listErr) {
  console.error('Error listando usuarios:', listErr)
  process.exit(1)
}

const toDelete = authUsers.filter(u => !KEEP_IDS.has(u.id))
console.log(`  Total auth.users: ${authUsers.length}`)
console.log(`  Conservar: ${authUsers.length - toDelete.length}`)
console.log(`  Borrar: ${toDelete.length}\n`)

for (const u of toDelete) {
  console.log(`  • ${u.email} (${u.id.slice(0, 8)}...)`)
}

// ── 3. Reasignar referencias FK al admin principal ───────────────────────
console.log('\n▶ Paso 3: Reasignando referencias FK al admin principal')
console.log(`  Target: gianpepex@gmail.com (${ADMIN_ID.slice(0, 8)}...)`)

for (const user of toDelete) {
  console.log(`\n  Usuario: ${user.email}`)
  for (const table of TABLES_TO_REASSIGN) {
    try {
      const { count, error } = await sb.from(table)
        .update({ user_id: ADMIN_ID }, { count: 'exact' })
        .eq('user_id', user.id)
      if (error) {
        // Si la tabla no existe o no tiene user_id, ignorar
        if (error.code === '42P01' || error.code === '42703') continue
        console.log(`    ⚠ ${table}: ${error.message}`)
      } else if (count && count > 0) {
        console.log(`    ✓ ${table}: ${count} filas reasignadas`)
      }
    } catch (e) {
      // Silencio para tablas inexistentes
    }
  }
}

// ── 4. Borrar de public.users ────────────────────────────────────────────
console.log('\n▶ Paso 4: Borrando filas de public.users')
const idsToDelete = toDelete.map(u => u.id)
const { count: userRowsDeleted, error: delUsersErr } = await sb
  .from('users')
  .delete({ count: 'exact' })
  .in('id', idsToDelete)
if (delUsersErr) {
  console.error(`  ✗ Error: ${delUsersErr.message}`)
} else {
  console.log(`  ✓ ${userRowsDeleted ?? 0} fila(s) borradas de public.users`)
}

// ── 5. Borrar de auth.users ──────────────────────────────────────────────
console.log('\n▶ Paso 5: Borrando de auth.users')
let okCount = 0
let failCount = 0
for (const user of toDelete) {
  const { error } = await sb.auth.admin.deleteUser(user.id)
  if (error) {
    console.log(`  ✗ ${user.email}: ${error.message}`)
    failCount++
  } else {
    console.log(`  ✓ ${user.email}`)
    okCount++
  }
}

// ── 6. Verificación final ────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════')
console.log('  VERIFICACIÓN FINAL')
console.log('═══════════════════════════════════════════════════════════════\n')

const { data: { users: remainingAuth } } = await sb.auth.admin.listUsers({ perPage: 100 })
console.log(`auth.users restantes: ${remainingAuth.length}`)
for (const u of remainingAuth) {
  console.log(`  • ${u.email}  (${u.id.slice(0, 8)}...)`)
}

const { data: remainingPublic } = await sb.from('users').select('id, name, email, roles')
console.log(`\npublic.users restantes: ${remainingPublic?.length || 0}`)
for (const u of remainingPublic || []) {
  console.log(`  • ${u.email} — ${u.name} [${u.roles.join(', ')}]`)
}

const { data: testCheck } = await sb.from('clients').select('id').like('dni', '99TEST%')
console.log(`\nDatos test 99TEST* restantes: ${testCheck?.length || 0}`)

console.log('\n✅ Limpieza completa.')
