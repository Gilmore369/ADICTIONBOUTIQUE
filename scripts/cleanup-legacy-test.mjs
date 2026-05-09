/**
 * Limpieza de datos de prueba 99TEST* y batches relacionados.
 * Borra en orden inverso de FK: payments → installments → credit_plans → clients → batches
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://mwdqdrqlzlffmfqqcnmp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo',
  { auth: { persistSession: false } }
)

console.log('▶ Buscando datos de prueba...')

// Encontrar batches con label TEST-99*
const { data: batches } = await sb.from('legacy_import_batches').select('id').like('source_label', 'TEST-99%')
const batchIds = (batches || []).map(b => b.id)
console.log(`  Batches: ${batchIds.length}`)

const { data: testClients } = await sb.from('clients').select('id').like('dni', '99TEST%')
const clientIds = (testClients || []).map(c => c.id)
console.log(`  Clientes test: ${clientIds.length}`)

const { data: testPlans } = await sb.from('credit_plans').select('id').in('legacy_batch_id', batchIds)
const planIds = (testPlans || []).map(p => p.id)
console.log(`  Planes test: ${planIds.length}`)

console.log('\n▶ Borrando en orden FK...')

// 1. payments
const { count: payCount } = await sb.from('payments').delete({ count: 'exact' }).in('legacy_batch_id', batchIds)
console.log(`  ✓ payments borrados: ${payCount}`)

// 2. installments
const { count: instCount } = await sb.from('installments').delete({ count: 'exact' }).in('plan_id', planIds)
console.log(`  ✓ installments borradas: ${instCount}`)

// 3. credit_plans
const { count: planCount } = await sb.from('credit_plans').delete({ count: 'exact' }).in('legacy_batch_id', batchIds)
console.log(`  ✓ credit_plans borrados: ${planCount}`)

// 4. clients (solo los test que ya no tengan dependencias)
const { count: cCount } = await sb.from('clients').delete({ count: 'exact' }).like('dni', '99TEST%')
console.log(`  ✓ clients borrados: ${cCount}`)

// 5. batches
const { count: bCount } = await sb.from('legacy_import_batches').delete({ count: 'exact' }).in('id', batchIds)
console.log(`  ✓ legacy_import_batches borrados: ${bCount}`)

// Verificar
const { data: leftClients } = await sb.from('clients').select('id').like('dni', '99TEST%')
const { data: leftBatches } = await sb.from('legacy_import_batches').select('id').like('source_label', 'TEST-99%')
console.log(`\n▶ Verificación:`)
console.log(`  Clientes 99TEST* restantes: ${leftClients?.length ?? 0}  ${leftClients?.length === 0 ? '✅' : '⚠'}`)
console.log(`  Batches TEST-99* restantes: ${leftBatches?.length ?? 0}  ${leftBatches?.length === 0 ? '✅' : '⚠'}`)
console.log('\n✅ Limpieza completa.')
