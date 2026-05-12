/**
 * Fix de datos: separar los 2 modelos que comparten base_code ZAP-001.
 * El modelo "MONOCROMADO" se mueve a ZAP-002.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://mwdqdrqlzlffmfqqcnmp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo',
  { auth: { persistSession: false } }
)

console.log('▶ Buscando productos MONOCROMADO con base_code ZAP-001...')

const { data: targets, error: e1 } = await sb
  .from('products')
  .select('id, barcode, name, base_code, base_name, size, color')
  .eq('base_code', 'ZAP-001')
  .ilike('base_name', '%MONOCROMADO%')

if (e1) { console.error('Error:', e1); process.exit(1) }
console.log(`  Encontrados: ${targets.length}`)
for (const p of targets) {
  console.log(`    • ${p.barcode} — ${p.size} ${p.color || '(sin color)'}`)
}

console.log('\n▶ Re-asignando a ZAP-002...')
for (const p of targets) {
  // Reescribir barcode: ZAP-001-... → ZAP-002-...
  const newBarcode = p.barcode.replace(/^ZAP-001/, 'ZAP-002')
  const { error } = await sb
    .from('products')
    .update({ base_code: 'ZAP-002', barcode: newBarcode })
    .eq('id', p.id)
  if (error) {
    console.error(`  ✗ ${p.id}: ${error.message}`)
  } else {
    console.log(`  ✓ ${p.barcode} → ${newBarcode}`)
  }
}

console.log('\n▶ Verificación final:')
const { data: zap001 } = await sb.from('products').select('id, barcode, base_name').eq('base_code', 'ZAP-001')
const { data: zap002 } = await sb.from('products').select('id, barcode, base_name').eq('base_code', 'ZAP-002')

const names001 = [...new Set((zap001 || []).map(p => p.base_name))]
const names002 = [...new Set((zap002 || []).map(p => p.base_name))]

console.log(`\n  ZAP-001: ${zap001.length} producto(s)`)
console.log(`    base_name(s) únicos: ${names001.join(', ')}`)
console.log(`\n  ZAP-002: ${zap002.length} producto(s)`)
console.log(`    base_name(s) únicos: ${names002.join(', ')}`)

if (names001.length === 1 && names002.length === 1) {
  console.log('\n✅ Cada base_code tiene un único modelo. Catálogo visual mostrará 2 tarjetas separadas.')
} else {
  console.log('\n⚠ Aún hay mezcla.')
}
