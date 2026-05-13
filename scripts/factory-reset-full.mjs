/**
 * FACTORY RESET COMPLETO — borra todo y recrea estructura básica.
 *
 * PRESERVA SOLO:
 *   - users
 *   - stores (Tienda Mujeres + Tienda Hombres)
 *
 * BORRA TODO LO DEMÁS (transaccional + catálogos).
 *
 * RECREA:
 *   - Línea "Hombres" → asociada a Tienda Hombres
 *   - Línea "Mujeres" → asociada a Tienda Mujeres
 *   - Línea "Niños"   → asociada a Tienda Mujeres
 *
 * Después de esto:
 *   - 0 categorías, 0 marcas, 0 tallas, 0 proveedores
 *   - 3 líneas asignadas correctamente a tiendas
 *   - 0 productos, ventas, clientes, etc.
 */

import { createClient } from '@supabase/supabase-js'

const SUPA = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo'
const sb = createClient(SUPA, KEY, { auth: { persistSession: false } })

const STORE_HOMBRES = '234267d8-cc8f-4baa-9201-e9c009781b2a'
const STORE_MUJERES = 'c7627467-dce8-43f7-8fe0-343e64f7986d'

console.log('═══════════════════════════════════════════════════════════════')
console.log('  FACTORY RESET COMPLETO')
console.log('═══════════════════════════════════════════════════════════════\n')

// ── Paso 1: borrar TODO incluyendo catálogos ────────────────────────────
const ORDER = [
  // Data transaccional (orden FK-safe)
  'payment_allocations', 'payments', 'installments', 'credit_plans',
  'sale_items', 'returns', 'sales',
  'tasks', 'client_visits', 'agenda_reminders', 'collection_actions',
  'cash_expenses', 'cash_shifts',
  'movements', 'stock', 'product_images', 'products', 'clients',
  'legacy_import_batches', 'audit_log',
  // Catálogos (orden FK-safe: hijos antes de padres)
  'sizes',           // FK → categories
  'supplier_brands', // M2M brands↔suppliers
  'line_stores',     // M2M lines↔stores
  'categories',      // FK → lines
  'brands',          // FK → suppliers
  'suppliers',
  'lines',
]

console.log('▶ Paso 1: Borrar todas las tablas')
let totalDeleted = 0
for (const t of ORDER) {
  try {
    const { count, error } = await sb.from(t).delete({ count: 'exact' }).not('id', 'is', null)
    if (error) {
      if (error.code === '42703') {
        // tabla sin columna id, intentar con created_at
        const { count: c2 } = await sb.from(t).delete({ count: 'exact' }).gte('created_at', '1900-01-01')
        console.log(`  ✓ ${t.padEnd(25)} ${c2 ?? 0} filas`)
        totalDeleted += c2 ?? 0
      } else {
        console.log(`  ⚠ ${t.padEnd(25)} ${error.message}`)
      }
    } else {
      console.log(`  ✓ ${t.padEnd(25)} ${count ?? 0} filas`)
      totalDeleted += count ?? 0
    }
  } catch (e) {
    console.log(`  ✗ ${t}: ${e.message}`)
  }
}
console.log(`\n  Total filas borradas: ${totalDeleted}\n`)

// ── Paso 2: crear líneas nuevas ─────────────────────────────────────────
console.log('▶ Paso 2: Crear líneas')

const newLines = [
  { name: 'Hombres', active: true, store: STORE_HOMBRES, storeLabel: 'Tienda Hombres' },
  { name: 'Mujeres', active: true, store: STORE_MUJERES, storeLabel: 'Tienda Mujeres' },
  { name: 'Niños',   active: true, store: STORE_MUJERES, storeLabel: 'Tienda Mujeres' },
]

const createdLines = []
for (const line of newLines) {
  const { data, error } = await sb
    .from('lines')
    .insert({ name: line.name, active: line.active })
    .select('id, name')
    .single()
  if (error) {
    console.log(`  ✗ ${line.name}: ${error.message}`)
    continue
  }
  console.log(`  ✓ Línea "${data.name}" creada (id ${data.id.slice(0, 8)}...)`)
  createdLines.push({ ...data, storeId: line.store, storeLabel: line.storeLabel })
}

// ── Paso 3: asociar líneas a tiendas (line_stores M2M) ──────────────────
console.log('\n▶ Paso 3: Vincular líneas con tiendas')

for (const line of createdLines) {
  const { error } = await sb
    .from('line_stores')
    .insert({ line_id: line.id, store_id: line.storeId })
  if (error) {
    console.log(`  ✗ ${line.name} → ${line.storeLabel}: ${error.message}`)
  } else {
    console.log(`  ✓ ${line.name.padEnd(10)} → ${line.storeLabel}`)
  }
}

// ── Paso 4: verificación ────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════')
console.log('  VERIFICACIÓN FINAL')
console.log('═══════════════════════════════════════════════════════════════\n')

const { data: stores } = await sb.from('stores').select('id, code, name').order('code')
console.log(`Tiendas (${stores?.length || 0}):`)
for (const s of stores || []) {
  console.log(`  • ${s.code}: ${s.name}`)
}

const { data: lines } = await sb
  .from('lines')
  .select('id, name, active, line_stores(stores(code, name))')
  .order('name')
console.log(`\nLíneas (${lines?.length || 0}):`)
for (const l of lines || []) {
  const stores = (l.line_stores || []).map(ls => ls.stores?.code).filter(Boolean).join(', ')
  console.log(`  • ${l.name.padEnd(10)} [${l.active ? 'activa' : 'inactiva'}] → tienda(s): ${stores || 'NINGUNA'}`)
}

console.log('\nTotales en otros catálogos:')
for (const t of ['categories', 'brands', 'sizes', 'suppliers']) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(`  • ${t.padEnd(15)} ${count ?? 0}`)
}

console.log('\nUsuarios:')
const { data: users } = await sb.from('users').select('name, email, roles')
for (const u of users || []) {
  console.log(`  • ${u.email.padEnd(40)} ${u.name} [${u.roles.join(', ')}]`)
}

console.log('\n✅ Sistema reseteado con estructura limpia.')
console.log('\n   Próximos pasos sugeridos:')
console.log('   1. Crear categorías por línea (en /catalogs/categories)')
console.log('   2. Crear tallas por categoría (en /catalogs/sizes)')
console.log('   3. Crear marcas y proveedores')
console.log('   4. Cargar productos masivamente (en /inventory/bulk-entry)')
