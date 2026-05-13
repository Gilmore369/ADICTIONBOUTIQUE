/**
 * FACTORY RESET — Limpia toda la data transaccional.
 *
 * PRESERVA:
 *   - users (los 2 que quedan)
 *   - stores, lines, categories, brands, sizes, suppliers, supplier_brands, line_stores
 *   - audit_log (solo se trunca, no se borra tabla)
 *
 * BORRA todo lo demás: ventas, clientes, productos, deudas, pagos, stock, etc.
 *
 * Orden FK-safe: hijos antes que padres.
 */

import { createClient } from '@supabase/supabase-js'

const SUPA = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo'
const sb = createClient(SUPA, KEY, { auth: { persistSession: false } })

// Tablas a vaciar EN ORDEN (hijos primero — respeta foreign keys)
const TABLES_TO_TRUNCATE = [
  // Dependientes de pagos
  'payment_allocations',
  'payments',
  // Dependientes de installments
  'installments',
  // Dependientes de credit_plans
  'credit_plans',
  // Dependientes de sales
  'sale_items',
  'returns',           // returned_items es JSONB dentro del row
  'sales',
  // Tareas (FK a clients)
  'tasks',
  // Visitas / acciones
  'client_visits',
  'agenda_reminders',
  'collection_actions',
  // Caja
  'cash_expenses',
  'cash_shifts',
  // Inventario
  'movements',
  'stock',
  'product_images',
  'products',
  // Clientes
  'clients',
  // Auditoría legacy
  'legacy_import_batches',
  // Audit log (logs viejos)
  'audit_log',
]

console.log('═══════════════════════════════════════════════════════════════')
console.log('  FACTORY RESET — limpiando data transaccional')
console.log('═══════════════════════════════════════════════════════════════\n')

let totalDeleted = 0

for (const table of TABLES_TO_TRUNCATE) {
  try {
    // Delete all rows: usamos un filtro siempre verdadero
    // Supabase JS no permite `.delete()` sin filtro como protección
    // → usamos un filtro `id IS NOT NULL` o `created_at IS NOT NULL`
    const { count, error } = await sb
      .from(table)
      .delete({ count: 'exact' })
      .not('id', 'is', null)

    if (error) {
      // Si la tabla no tiene columna 'id', intentar con otra clave
      if (error.code === '42703') {
        const { count: c2, error: e2 } = await sb
          .from(table)
          .delete({ count: 'exact' })
          .gte('created_at', '1900-01-01')
        if (e2) {
          console.log(`  ⚠ ${table}: ${e2.message}`)
        } else {
          console.log(`  ✓ ${table.padEnd(25)} ${c2 ?? 0} fila(s) borrada(s)`)
          totalDeleted += c2 ?? 0
        }
      } else {
        console.log(`  ⚠ ${table}: ${error.message}`)
      }
    } else {
      console.log(`  ✓ ${table.padEnd(25)} ${count ?? 0} fila(s) borrada(s)`)
      totalDeleted += count ?? 0
    }
  } catch (e) {
    console.log(`  ✗ ${table}: ${e.message}`)
  }
}

console.log('')
console.log('═══════════════════════════════════════════════════════════════')
console.log(`  Total filas borradas: ${totalDeleted}`)
console.log('═══════════════════════════════════════════════════════════════\n')

// ── Verificación final ──────────────────────────────────────────────────
console.log('▶ Verificación post-cleanup\n')

console.log('── DATA (debe estar en 0) ──')
for (const t of TABLES_TO_TRUNCATE) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true })
  const status = (count ?? 0) === 0 ? '✓' : '⚠'
  console.log(`  ${status} ${t.padEnd(25)} ${count ?? 0}`)
}

console.log('\n── CATÁLOGOS (deben mantenerse) ──')
for (const t of ['users', 'stores', 'lines', 'categories', 'brands', 'sizes', 'suppliers', 'supplier_brands', 'line_stores']) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(`  • ${t.padEnd(20)} ${count ?? 0}`)
}

console.log('\n✅ Sistema listo para empezar a probar desde cero.')
console.log('   Los catálogos (líneas, categorías, marcas, tallas, proveedores) y los 2 usuarios')
console.log('   se conservan para que puedas crear productos y ventas directamente.\n')
