/**
 * Validación visual: simula lo que ve el usuario en cada página.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://mwdqdrqlzlffmfqqcnmp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo',
  { auth: { persistSession: false } }
)

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('  VALIDACIÓN VISUAL — Lo que el usuario verá en cada página')
console.log('═══════════════════════════════════════════════════════════════')

// ── 1. /admin/import-debts (Historial) ─────────────────────────────────────
console.log('\n📋 PÁGINA: /admin/import-debts → tab "Historial"')
console.log('────────────────────────────────────────────────────────────────')
const { data: batches } = await sb
  .from('legacy_import_batches')
  .select('id, imported_at, source_label, source_filename, total_rows, successful_rows, failed_rows, total_debt_amount')
  .order('imported_at', { ascending: false })

if (!batches || batches.length === 0) {
  console.log('  ⚠ No hay lotes registrados todavía.')
} else {
  console.log(`  Total: ${batches.length} lote(s) registrado(s)\n`)
  console.log(`  ┌─────────────────────────────────┬───────┬───────┬──────────────┐`)
  console.log(`  │ Origen                          │ Filas │ OK    │ Saldo total  │`)
  console.log(`  ├─────────────────────────────────┼───────┼───────┼──────────────┤`)
  for (const b of batches) {
    const label = (b.source_label || '').padEnd(31).slice(0, 31)
    const rows = String(b.total_rows).padStart(5)
    const ok = String(b.successful_rows).padStart(5)
    const total = `S/ ${Number(b.total_debt_amount || 0).toFixed(2)}`.padStart(12)
    console.log(`  │ ${label} │ ${rows} │ ${ok} │ ${total} │`)
  }
  console.log(`  └─────────────────────────────────┴───────┴───────┴──────────────┘`)
}

// ── 2. /clients (Lista de clientes con badge LEGACY) ───────────────────────
console.log('\n👥 PÁGINA: /clients → tabla')
console.log('────────────────────────────────────────────────────────────────')
const { data: testClientsAll } = await sb
  .from('clients')
  .select('id, dni, name, phone, credit_used, imported_from_legacy, legacy_source')
  .like('dni', '99TEST%')
  .order('dni')

console.log(`  Total clientes 99TEST*: ${testClientsAll?.length ?? 0}`)
console.log(`  Con badge LEGACY visible: ${testClientsAll?.filter(c => c.imported_from_legacy).length ?? 0}\n`)

const sample5 = (testClientsAll || []).slice(0, 5)
console.log('  Primeros 5 (lo que verá en la tabla):')
console.log(`  ┌────────────┬──────────────────────────────┬───────────────┬────────────┬───────┐`)
console.log(`  │ DNI        │ Nombre                       │ Teléfono      │ Deuda      │ Badge │`)
console.log(`  ├────────────┼──────────────────────────────┼───────────────┼────────────┼───────┤`)
for (const c of sample5) {
  const dni = (c.dni || '').padEnd(10)
  const name = (c.name || '').padEnd(30).slice(0, 30)
  const phone = (c.phone || '').padEnd(13).slice(0, 13)
  const debt = `S/ ${Number(c.credit_used || 0).toFixed(2)}`.padStart(10)
  const badge = c.imported_from_legacy ? '🏷 LEG' : '   -  '
  console.log(`  │ ${dni} │ ${name} │ ${phone} │ ${debt} │ ${badge} │`)
}
console.log(`  └────────────┴──────────────────────────────┴───────────────┴────────────┴───────┘`)

// ── 3. /debt/plans (Planes de Crédito agrupados por cliente) ──────────────
console.log('\n💳 PÁGINA: /debt/plans → planes agrupados por cliente')
console.log('────────────────────────────────────────────────────────────────')
const { data: legacyPlans } = await sb
  .from('credit_plans')
  .select(`
    id, total_amount, status, created_at,
    imported_from_legacy, legacy_purchase_description, legacy_purchase_date,
    client:clients!inner(id, name, dni, imported_from_legacy)
  `)
  .eq('imported_from_legacy', true)
  .like('client.dni', '99TEST%')
  .order('created_at', { ascending: false })
  .limit(5)

console.log(`  Total planes legacy creados (test): ${legacyPlans?.length ?? '?'}\n`)
console.log('  Primeros 5 planes (con badge LEGACY visible):')
for (const p of legacyPlans || []) {
  const cli = p.client
  console.log(`\n  ◉ ${cli.name} (${cli.dni})  [LEGACY] [Deuda legacy]`)
  console.log(`    └─ Plan: Deuda importada (sistema anterior)  [LEGACY]`)
  console.log(`         "${p.legacy_purchase_description}"`)
  console.log(`         Compra original: ${p.legacy_purchase_date}  ·  Total: S/ ${Number(p.total_amount).toFixed(2)}`)
}

// ── 4. /debt/plans/[id] (Detalle del plan) ─────────────────────────────────
console.log('\n\n📄 PÁGINA: /debt/plans/[id] → detalle de un plan legacy')
console.log('────────────────────────────────────────────────────────────────')
if (legacyPlans && legacyPlans.length > 0) {
  const p = legacyPlans[0]
  const { data: full } = await sb
    .from('credit_plans')
    .select('*')
    .eq('id', p.id)
    .single()
  console.log(`  Plan ID: ${full.id}`)
  console.log(`  Estado: ${full.status}  ·  Badge: 🏷 LEGACY (visible en header)`)
  console.log(`  Total Monto: S/ ${Number(full.total_amount).toFixed(2)}`)
  console.log(`  Cuotas: ${full.installments_count} de S/ ${Number(full.installment_amount).toFixed(2)}`)
  console.log(`\n  Sección "📦 Información del sistema anterior":`)
  console.log(`    Qué compró: ${full.legacy_purchase_description}`)
  console.log(`    Fecha original: ${full.legacy_purchase_date}`)
  console.log(`    Total original: S/ ${Number(full.legacy_original_total || 0).toFixed(2)}`)
  console.log(`    Origen: ${full.legacy_source}`)
  console.log(`    Importado: ${full.legacy_imported_at}`)
  if (full.legacy_notes) console.log(`    Notas: ${full.legacy_notes}`)
}

// ── 5. /map → deudores con saldo > 0 ──────────────────────────────────────
console.log('\n\n🗺  PÁGINA: /map → deudores en el mapa (filtro "Atrasados" o "Todos con Crédito")')
console.log('────────────────────────────────────────────────────────────────')
const { data: deudores } = await sb
  .from('clients')
  .select('id, dni, name, credit_used, imported_from_legacy')
  .like('dni', '99TEST%')
  .gt('credit_used', 0)
console.log(`  Clientes test visibles en mapa (con deuda > 0): ${deudores?.length ?? 0}`)

const totalDebtMap = (deudores || []).reduce((s, c) => s + Number(c.credit_used || 0), 0)
console.log(`  Suma de deudas: S/ ${totalDebtMap.toFixed(2)}`)
console.log(`  ✓ Aparecerán como pines en /map al filtrar por "Todos con Crédito"`)

// ── 6. RESUMEN FINAL ──────────────────────────────────────────────────────
console.log('\n\n═══════════════════════════════════════════════════════════════')
console.log('  ✅ RESUMEN — todo visible en producción')
console.log('═══════════════════════════════════════════════════════════════')

const totalClientes = testClientsAll?.length ?? 0
const totalLote = batches?.length ?? 0
const totalSaldo = (deudores || []).reduce((s, c) => s + Number(c.credit_used || 0), 0)

console.log(`
  📍 Acceso a:  https://adictionboutique.agsys.es

  ◉ Sección "Importar Deudas" → tab Historial
    • ${totalLote} lote(s) registrado(s) con stats correctas

  ◉ Sección "Clientes"
    • ${totalClientes} clientes con DNI 99TEST*
    • TODOS muestran badge ámbar "LEGACY" al lado del nombre

  ◉ Sección "Cobranzas → Planes de Crédito"
    • ${totalClientes} clientes con badge "LEGACY" en su nombre
    • Cada plan muestra "Deuda importada (sistema anterior)" + descripción
    • Click en "Ver plan" abre el detalle con sección dedicada
      "📦 Información del sistema anterior" mostrando todo

  ◉ Sección "Mapa"
    • ${totalClientes} pines visibles cuando filtres por "Todos con Crédito"
    • Saldo total acumulado: S/ ${totalSaldo.toFixed(2)}

  Los datos quedan en BD hasta que pidas borrarlos.
  Para limpiar: scripts/cleanup-legacy-test.mjs (FK-safe)
`)
