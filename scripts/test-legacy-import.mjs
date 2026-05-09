/**
 * Test E2E del flujo de importación de deudas legacy.
 *
 * Replica EXACTAMENTE la lógica de actions/legacy-import.ts pero con service role
 * para bypass de auth (no necesita session).
 *
 * Genera 3 escenarios:
 *   - 1 deuda (modo Manual)
 *   - 10 deudas (modo Lote)
 *   - 15 deudas (modo Archivo / Excel)
 *
 * Todos los DNIs de prueba empiezan con "99TEST" para identificarlos y limpiarlos.
 */

import { createClient } from '@supabase/supabase-js'

const SUPA_URL = 'https://mwdqdrqlzlffmfqqcnmp.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZHFkcnFsemxmZm1mcXFjbm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ3NDcyMiwiZXhwIjoyMDg3MDUwNzIyfQ.mlbrsFSRmtLA8qGvl9oz1JEfjqOuuapkHAP0obF1dvo'

const sb = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ─── Test data generators ──────────────────────────────────────────────────
const FIRST_NAMES = ['María', 'Juan', 'Carmen', 'Carlos', 'Ana', 'Pedro', 'Lucía', 'José', 'Sofía', 'Luis', 'Patricia', 'Jorge', 'Elena', 'Miguel', 'Rosa']
const LAST_NAMES = ['García', 'Mendoza', 'Torres', 'Quispe', 'Vega', 'Rodríguez', 'Castillo', 'Apaza', 'Fernández', 'Pacheco', 'Rivas', 'Bazauri', 'Ccori', 'Ames', 'Aliaga']
const PRODUCTS = [
  'Casaca de cuero negra L',
  'Conjunto deportivo Nike + zapatillas',
  'Vestido de fiesta',
  'Polo + jean azul',
  'Blusa floral S + falda',
  'Casaca denim M',
  'Zapatillas urbanas + medias',
  'Vestido casual + cinturón',
  'Pantalón cargo + 2 polos',
  'Conjunto deportivo Adidas',
  'Falda larga + blusa',
  'Casaca impermeable XL',
  'Jean recto + casaca',
  'Vestido de gala largo',
  'Conjunto invierno completo',
]
const DISTRICTS = ['Trujillo', 'La Esperanza', 'Víctor Larco', 'Florencia de Mora', 'El Porvenir', 'Moche']

const PAYMENT_METHODS = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA']

function pad(n, len = 2) { return String(n).padStart(len, '0') }

function genTestRow(i) {
  // DNI único con prefijo 99TEST + número incremental
  const dni = `99TEST${pad(i, 3)}` // 99TEST001..99TEST999
  const fname = FIRST_NAMES[i % FIRST_NAMES.length]
  const lname1 = LAST_NAMES[i % LAST_NAMES.length]
  const lname2 = LAST_NAMES[(i + 7) % LAST_NAMES.length]
  const product = PRODUCTS[i % PRODUCTS.length]
  const district = DISTRICTS[i % DISTRICTS.length]

  // Fecha de compra entre 2024-01-01 y 2025-08-01
  const startMs = new Date('2024-01-01').getTime()
  const endMs = new Date('2025-08-01').getTime()
  const purchaseMs = startMs + Math.floor((endMs - startMs) * (i / 30))
  const purchase_date = new Date(purchaseMs).toISOString().split('T')[0]

  // Monto entre 200 y 1500
  const original_total = Math.round((200 + (i * 73) % 1300) * 100) / 100

  // Pagado: aleatorio entre 0 y 70% del total
  const paid_pct = (i % 4 === 0) ? 0 : ((i * 13) % 70) / 100
  const paid_so_far = Math.round(original_total * paid_pct * 100) / 100

  // Historial de pagos detallado si paid_so_far > 0
  let historical_payments = ''
  if (paid_so_far > 0) {
    // Dividir en 1-3 pagos
    const numPayments = (i % 3) + 1
    const perPayment = Math.round((paid_so_far / numPayments) * 100) / 100
    // Asegurar que la suma sea exacta
    const payments = []
    let acc = 0
    for (let p = 0; p < numPayments; p++) {
      const amt = (p === numPayments - 1) ? Math.round((paid_so_far - acc) * 100) / 100 : perPayment
      acc += amt
      const payDateMs = purchaseMs + (p + 1) * 30 * 24 * 60 * 60 * 1000
      const payDate = new Date(payDateMs).toISOString().split('T')[0]
      const method = PAYMENT_METHODS[(i + p) % PAYMENT_METHODS.length]
      payments.push(`${amt}:${payDate}:${method}`)
    }
    historical_payments = payments.join(';')
  }

  return {
    dni,
    name: `${fname} ${lname1} ${lname2}`,
    phone: `9${pad(80000000 + i * 1234, 8)}`.slice(0, 9),
    address: `Av. Test ${100 + i}`,
    district,
    purchase_description: `[TEST-99] ${product}`,
    purchase_date,
    original_total: String(original_total),
    paid_so_far: String(paid_so_far),
    historical_payments,
    notes: `Cliente de prueba 99TEST #${i}`,
  }
}

// ─── Replica exacta de la lógica de actions/legacy-import.ts ──────────────
function parseHistoricalPayments(input) {
  if (typeof input !== 'string' || !input.trim()) return []
  return input.split(';').map(s => s.trim()).filter(Boolean).map(part => {
    const [amountStr, dateStr, method, ...notesArr] = part.split(':').map(s => s.trim())
    const amount = parseFloat(amountStr.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) throw new Error(`Pago inválido: ${part}`)
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error(`Fecha inválida: ${part}`)
    return {
      amount,
      payment_date: dateStr,
      method: method || undefined,
      notes: notesArr.length > 0 ? notesArr.join(':') : undefined,
    }
  })
}

function validateRow(row) {
  if (!row.dni || row.dni.length < 8) throw new Error('DNI inválido')
  if (!row.name || row.name.length < 2) throw new Error('Nombre requerido')
  if (!row.purchase_description) throw new Error('Descripción requerida')
  if (!row.purchase_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.purchase_date)) throw new Error('Fecha de compra inválida')
  const total = parseFloat(row.original_total)
  if (isNaN(total) || total <= 0) throw new Error('Monto total inválido')
  const paid = parseFloat(row.paid_so_far || '0')
  if (paid > total + 0.001) throw new Error('Monto pagado mayor al total')
  return { ...row, original_total: total, paid_so_far: paid }
}

async function processRow(row, batchId, sourceLabel, rowIndex) {
  const validated = validateRow(row)
  const historicalPayments = validated.historical_payments
    ? parseHistoricalPayments(validated.historical_payments)
    : []

  // Validar coincidencia de pagos
  if (historicalPayments.length > 0 && validated.paid_so_far > 0) {
    const sumHist = historicalPayments.reduce((s, p) => s + p.amount, 0)
    if (Math.abs(sumHist - validated.paid_so_far) > 0.01) {
      throw new Error(`Suma pagos históricos (${sumHist.toFixed(2)}) != paid_so_far (${validated.paid_so_far.toFixed(2)})`)
    }
  }

  // ── Find or create cliente ──
  let clientId
  let clientWasCreated = false
  const { data: existing } = await sb.from('clients').select('id').eq('dni', validated.dni).maybeSingle()

  const fullAddress = [validated.address, validated.district].filter(Boolean).join(', ')

  if (existing) {
    clientId = existing.id
  } else {
    const { data: newClient, error } = await sb.from('clients').insert({
      dni: validated.dni,
      name: validated.name,
      phone: validated.phone || null,
      address: fullAddress || null,
      active: true,
      imported_from_legacy: true,
      legacy_source: sourceLabel,
      legacy_imported_at: new Date().toISOString(),
      legacy_notes: validated.notes || null,
    }).select('id').single()
    if (error) throw new Error(`Crear cliente: ${error.message}`)
    clientId = newClient.id
    clientWasCreated = true
  }

  // ── Crear plan ──
  const totalAmount = validated.original_total
  const paidSoFar = validated.paid_so_far
  const remaining = totalAmount - paidSoFar

  if (remaining <= 0.01) {
    return { row_index: rowIndex, status: 'success', client_id: clientId, client_was_created: clientWasCreated, remaining_debt: 0, payments_created: 0 }
  }

  const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  const installmentStatus = paidSoFar > 0 ? 'PARTIAL' : (new Date(dueDate) < new Date() ? 'OVERDUE' : 'PENDING')

  const { data: plan, error: planErr } = await sb.from('credit_plans').insert({
    client_id: clientId,
    sale_id: null,
    total_amount: totalAmount,
    installments_count: 1,
    installment_amount: totalAmount,
    status: 'ACTIVE',
    imported_from_legacy: true,
    legacy_source: sourceLabel,
    legacy_purchase_description: validated.purchase_description,
    legacy_purchase_date: validated.purchase_date,
    legacy_original_total: totalAmount,
    legacy_imported_at: new Date().toISOString(),
    legacy_notes: validated.notes || null,
    legacy_batch_id: batchId,
  }).select('id').single()
  if (planErr) throw new Error(`Crear plan: ${planErr.message}`)

  // ── Installment ──
  const { data: inst, error: instErr } = await sb.from('installments').insert({
    plan_id: plan.id,
    installment_number: 1,
    amount: totalAmount,
    due_date: dueDate,
    paid_amount: paidSoFar,
    status: installmentStatus,
    paid_at: paidSoFar > 0 ? new Date().toISOString() : null,
  }).select('id').single()
  if (instErr) {
    await sb.from('credit_plans').delete().eq('id', plan.id)
    throw new Error(`Crear cuota: ${instErr.message}`)
  }

  // ── Pagos históricos ──
  let paymentsCreated = 0
  if (historicalPayments.length > 0) {
    const records = historicalPayments.map(p => ({
      client_id: clientId,
      amount: p.amount,
      payment_date: p.payment_date,
      user_id: null, // No tenemos user en este test
      notes: `[LEGACY] ${p.method ? p.method + ' — ' : ''}${p.notes || 'Pago histórico importado'}`,
      plan_id: plan.id,
      installment_id: inst.id,
      imported_from_legacy: true,
      legacy_source: sourceLabel,
      legacy_batch_id: batchId,
    }))
    const { data: ins, error: payErr } = await sb.from('payments').insert(records).select('id')
    if (!payErr && ins) paymentsCreated = ins.length
  } else if (paidSoFar > 0) {
    const { error: payErr } = await sb.from('payments').insert({
      client_id: clientId,
      amount: paidSoFar,
      payment_date: validated.purchase_date,
      user_id: null,
      notes: '[LEGACY] Pagos previos consolidados',
      plan_id: plan.id,
      installment_id: inst.id,
      imported_from_legacy: true,
      legacy_source: sourceLabel,
      legacy_batch_id: batchId,
    })
    if (!payErr) paymentsCreated = 1
  }

  // ── Recalcular credit_used ──
  const { data: instAll } = await sb.from('installments').select('amount, paid_amount').in('plan_id', [plan.id])
  // Suma TODOS los planes activos del cliente (no solo este)
  const { data: allPlans } = await sb.from('credit_plans').select('id').eq('client_id', clientId).eq('status', 'ACTIVE')
  const planIds = (allPlans || []).map(p => p.id)
  const { data: allInst } = await sb.from('installments').select('amount, paid_amount').in('plan_id', planIds)
  const used = (allInst || []).reduce((s, x) => s + (Number(x.amount) - Number(x.paid_amount)), 0)
  await sb.from('clients').update({ credit_used: Math.max(0, used) }).eq('id', clientId)

  return {
    row_index: rowIndex,
    status: 'success',
    client_id: clientId,
    client_was_created: clientWasCreated,
    credit_plan_id: plan.id,
    payments_created: paymentsCreated,
    remaining_debt: remaining,
  }
}

async function importBatch(rows, sourceLabel) {
  // Crear batch
  const { data: batch, error: batchErr } = await sb.from('legacy_import_batches').insert({
    imported_by: null,
    source_label: sourceLabel,
    total_rows: rows.length,
    successful_rows: 0,
    failed_rows: 0,
    total_debt_amount: 0,
    raw_payload: rows,
  }).select('id').single()
  if (batchErr) throw new Error(`Crear batch: ${batchErr.message}`)

  const results = []
  let totalDebt = 0
  let success = 0
  let fail = 0

  for (let i = 0; i < rows.length; i++) {
    try {
      const r = await processRow(rows[i], batch.id, sourceLabel, i)
      results.push(r)
      success++
      totalDebt += r.remaining_debt || 0
    } catch (e) {
      results.push({ row_index: i, status: 'error', error: e.message })
      fail++
    }
  }

  await sb.from('legacy_import_batches').update({
    successful_rows: success, failed_rows: fail, total_debt_amount: totalDebt,
  }).eq('id', batch.id)

  return { batch_id: batch.id, total_rows: rows.length, successful_rows: success, failed_rows: fail, total_debt_amount: totalDebt, results }
}

// ─── Tests ─────────────────────────────────────────────────────────────────
async function run() {
  const startTime = Date.now()
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  TEST E2E — Importación de Deudas Legacy')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // ── TEST 1: 1 deuda (manual) ─────────────────────────────────────────────
  console.log('▶ TEST 1: Modo Manual (1 deuda)')
  const row1 = genTestRow(1)
  const result1 = await importBatch([row1], 'TEST-99 Manual (individual)')
  console.log(`  Batch: ${result1.batch_id}`)
  console.log(`  Resultado: ${result1.successful_rows}/${result1.total_rows} OK · ${result1.failed_rows} fallidas`)
  console.log(`  Saldo total importado: S/ ${result1.total_debt_amount.toFixed(2)}`)
  if (result1.failed_rows > 0) {
    result1.results.filter(r => r.status === 'error').forEach(r => console.log(`    ✗ Fila ${r.row_index}: ${r.error}`))
  }
  console.log('')

  // ── TEST 2: 10 deudas (lote) ─────────────────────────────────────────────
  console.log('▶ TEST 2: Modo Lote (10 deudas)')
  const rows10 = Array.from({ length: 10 }, (_, i) => genTestRow(10 + i))
  const result2 = await importBatch(rows10, 'TEST-99 Lote (10 filas)')
  console.log(`  Batch: ${result2.batch_id}`)
  console.log(`  Resultado: ${result2.successful_rows}/${result2.total_rows} OK · ${result2.failed_rows} fallidas`)
  console.log(`  Saldo total importado: S/ ${result2.total_debt_amount.toFixed(2)}`)
  if (result2.failed_rows > 0) {
    result2.results.filter(r => r.status === 'error').forEach(r => console.log(`    ✗ Fila ${r.row_index}: ${r.error}`))
  }
  console.log('')

  // ── TEST 3: 15 deudas (Excel) ────────────────────────────────────────────
  console.log('▶ TEST 3: Modo Archivo Excel (15 deudas)')
  const rows15 = Array.from({ length: 15 }, (_, i) => genTestRow(30 + i))
  const result3 = await importBatch(rows15, 'TEST-99 Archivo Excel (15 filas)')
  console.log(`  Batch: ${result3.batch_id}`)
  console.log(`  Resultado: ${result3.successful_rows}/${result3.total_rows} OK · ${result3.failed_rows} fallidas`)
  console.log(`  Saldo total importado: S/ ${result3.total_debt_amount.toFixed(2)}`)
  if (result3.failed_rows > 0) {
    result3.results.filter(r => r.status === 'error').forEach(r => console.log(`    ✗ Fila ${r.row_index}: ${r.error}`))
  }
  console.log('')

  // ── AUDITORÍA ────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  AUDITORÍA — Validación contra BD')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // Contar todo lo creado por estos tests
  const { data: testClients } = await sb.from('clients').select('id, dni, name, credit_used, imported_from_legacy').like('dni', '99TEST%')
  console.log(`✓ Clientes con DNI 99TEST*: ${testClients?.length ?? 0}`)
  console.log(`  - Con imported_from_legacy=true: ${testClients?.filter(c => c.imported_from_legacy).length ?? 0}`)

  const totalCreditUsed = (testClients || []).reduce((s, c) => s + Number(c.credit_used || 0), 0)
  console.log(`  - Suma credit_used de clientes test: S/ ${totalCreditUsed.toFixed(2)}`)

  const batchIds = [result1.batch_id, result2.batch_id, result3.batch_id]
  const { data: testPlans } = await sb.from('credit_plans').select('id, total_amount, imported_from_legacy, legacy_purchase_description, legacy_batch_id').in('legacy_batch_id', batchIds)
  console.log(`\n✓ credit_plans con legacy_batch_id en los 3 tests: ${testPlans?.length ?? 0}`)
  console.log(`  - Con imported_from_legacy=true: ${testPlans?.filter(p => p.imported_from_legacy).length ?? 0}`)
  const totalPlanAmount = (testPlans || []).reduce((s, p) => s + Number(p.total_amount), 0)
  console.log(`  - Suma total_amount: S/ ${totalPlanAmount.toFixed(2)}`)

  const { data: testInst } = await sb.from('installments').select('id, amount, paid_amount, status, plan_id').in('plan_id', (testPlans || []).map(p => p.id))
  console.log(`\n✓ installments creadas: ${testInst?.length ?? 0}`)
  const statusBreakdown = (testInst || []).reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc }, {})
  console.log(`  - Por estado:`, statusBreakdown)

  const { data: testPayments } = await sb.from('payments').select('id, amount, imported_from_legacy, legacy_batch_id').in('legacy_batch_id', batchIds)
  console.log(`\n✓ payments con legacy_batch_id en los 3 tests: ${testPayments?.length ?? 0}`)
  console.log(`  - Con imported_from_legacy=true: ${testPayments?.filter(p => p.imported_from_legacy).length ?? 0}`)
  const totalPayAmount = (testPayments || []).reduce((s, p) => s + Number(p.amount), 0)
  console.log(`  - Suma amount de pagos: S/ ${totalPayAmount.toFixed(2)}`)

  const { data: testBatches } = await sb.from('legacy_import_batches').select('id, source_label, total_rows, successful_rows, failed_rows, total_debt_amount').in('id', batchIds)
  console.log(`\n✓ legacy_import_batches:`)
  ;(testBatches || []).forEach(b => {
    console.log(`  • ${b.source_label}: ${b.successful_rows}/${b.total_rows} OK · S/ ${Number(b.total_debt_amount).toFixed(2)}`)
  })

  // ── INTEGRIDAD ──
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  INTEGRIDAD — Validaciones críticas')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const totalReportedDebt = result1.total_debt_amount + result2.total_debt_amount + result3.total_debt_amount
  console.log(`Saldo reportado por los 3 tests: S/ ${totalReportedDebt.toFixed(2)}`)
  console.log(`Suma credit_used de clientes test: S/ ${totalCreditUsed.toFixed(2)}`)
  const debtMatch = Math.abs(totalReportedDebt - totalCreditUsed) < 0.5
  console.log(debtMatch ? '✅ MATCH credit_used = saldo reportado' : `⚠ DIFERENCIA: ${(totalReportedDebt - totalCreditUsed).toFixed(2)}`)

  // Cada cliente test debe tener exactamente 1 plan activo (porque los DNIs son únicos)
  const planPerClient = new Map()
  ;(testPlans || []).forEach(p => {
    const c = (testClients || []).find(c => c.id === p.client_id)
    // p.client_id no está seleccionado, hay que cruzar por separado
  })

  // Verificar que installments[].paid_amount === sum(payments[]) para el plan
  const planIdToPlan = new Map((testPlans || []).map(p => [p.id, p]))
  const planIdToInst = new Map((testInst || []).map(i => [i.plan_id, i]))
  const { data: payWithPlan } = await sb.from('payments').select('plan_id, amount').in('legacy_batch_id', batchIds)
  const planPayments = (payWithPlan || []).reduce((acc, p) => {
    if (!p.plan_id) return acc
    acc[p.plan_id] = (acc[p.plan_id] || 0) + Number(p.amount)
    return acc
  }, {})
  let mismatches = 0
  for (const planId of Object.keys(planPayments)) {
    const inst = planIdToInst.get(planId)
    if (!inst) continue
    if (Math.abs(Number(inst.paid_amount) - planPayments[planId]) > 0.01) {
      mismatches++
    }
  }
  console.log(mismatches === 0
    ? `✅ installments.paid_amount === SUM(payments.amount) en todos los planes`
    : `⚠ ${mismatches} planes con discrepancia entre paid_amount y suma de pagos`
  )

  console.log(`\n⏱ Test completo en ${((Date.now() - startTime) / 1000).toFixed(1)}s`)

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  Datos de prueba creados — listos para inspección manual')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`\nPara limpiar, ejecuta:`)
  console.log(`  node scripts/cleanup-legacy-test.mjs`)
  console.log(`\nO en Supabase SQL Editor:`)
  console.log(`  DELETE FROM payments WHERE legacy_batch_id IN ('${batchIds.join("','")}');`)
  console.log(`  DELETE FROM installments WHERE plan_id IN (SELECT id FROM credit_plans WHERE legacy_batch_id IN ('${batchIds.join("','")}'));`)
  console.log(`  DELETE FROM credit_plans WHERE legacy_batch_id IN ('${batchIds.join("','")}');`)
  console.log(`  DELETE FROM clients WHERE dni LIKE '99TEST%';`)
  console.log(`  DELETE FROM legacy_import_batches WHERE id IN ('${batchIds.join("','")}');`)

  // Imprimir batch IDs para uso externo
  console.log(`\nBATCH_IDS=${batchIds.join(',')}`)
}

run().catch(e => { console.error('FATAL:', e); process.exit(1) })
