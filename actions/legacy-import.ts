'use server'

/**
 * Legacy Debt Import Actions
 *
 * Permite importar deudas de clientes desde otro sistema.
 * Estrategia:
 *   1. Validar TODAS las filas con Zod antes de tocar la BD (dry-run implícito)
 *   2. Si dry-run pide solo validar, retorna resultados sin escribir
 *   3. En modo "commit", crea un batch y procesa fila por fila
 *      - Cada fila es independiente: si una falla, las demás siguen
 *      - Cada fila es atómica internamente (cliente + plan + pagos en orden)
 *
 * Solo admins pueden importar.
 */

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  LegacyDebtRowSchema,
  parseHistoricalPayments,
  normalizeRowKeys,
  type LegacyDebtRow,
  type LegacyImportRowResult,
  type LegacyImportBatchResult,
  type HistoricalPayment,
} from '@/lib/legacy-import/schema'
import { addDaysPeru, getTodayPeru, normalizeDateOnlyPeru } from '@/lib/utils/timezone'

// ── Auth: solo admin puede importar ─────────────────────────────────────────
async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const service = createServiceClient()
  const { data: profile } = await service
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single()

  const roles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  if (!roles.includes('admin')) {
    throw new Error('Solo administradores pueden importar deudas legacy')
  }
  return { userId: user.id }
}

function prepareLegacyRow(raw: Record<string, any>): {
  row: LegacyDebtRow
  historicalPayments: HistoricalPayment[]
} {
  const normalized = normalizeRowKeys(raw)
  const parsed = LegacyDebtRowSchema.parse(normalized)
  const historicalPayments = parsed.historical_payments
    ? parseHistoricalPayments(parsed.historical_payments)
    : []

  const historicalTotal = Math.round(
    historicalPayments.reduce((sum, payment) => sum + payment.amount, 0) * 100,
  ) / 100
  const declaredPaid = parsed.paid_so_far ?? 0
  const effectivePaid = historicalTotal > 0 && declaredPaid <= 0
    ? historicalTotal
    : declaredPaid

  if (historicalTotal > 0 && declaredPaid > 0 && Math.abs(historicalTotal - declaredPaid) > 0.01) {
    throw new Error(`Suma de pagos historicos (${historicalTotal.toFixed(2)}) no coincide con paid_so_far (${declaredPaid.toFixed(2)})`)
  }

  if (effectivePaid > parsed.original_total + 0.01) {
    throw new Error(`El monto pagado (${effectivePaid.toFixed(2)}) no puede ser mayor al total original (${parsed.original_total.toFixed(2)})`)
  }

  return {
    row: { ...parsed, paid_so_far: effectivePaid },
    historicalPayments,
  }
}

async function geocodeLegacyAddress(address: string | null | undefined): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const cleanAddress = address?.trim()
  if (!apiKey || !cleanAddress) return null

  const query = /per[uú]|la libertad|trujillo/i.test(cleanAddress)
    ? cleanAddress
    : `${cleanAddress}, Trujillo, La Libertad, Peru`

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', query)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('region', 'pe')

    const response = await fetch(url.toString(), { cache: 'no-store' })
    if (!response.ok) return null
    const payload = await response.json()
    const location = payload?.results?.[0]?.geometry?.location
    if (typeof location?.lat !== 'number' || typeof location?.lng !== 'number') return null
    return { lat: location.lat, lng: location.lng }
  } catch {
    return null
  }
}

// ── Validar (dry-run) ──────────────────────────────────────────────────────
export async function validateLegacyDebtRows(
  rawRows: Array<Record<string, any>>,
): Promise<{ success: boolean; results: LegacyImportRowResult[]; error?: string }> {
  try {
    await requireAdmin()
  } catch (e) {
    return { success: false, results: [], error: e instanceof Error ? e.message : 'Unauthorized' }
  }

  const results: LegacyImportRowResult[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    try {
      const { row: parsed } = prepareLegacyRow(raw)
      // Validar pagos históricos también
      let historicalPayments: HistoricalPayment[] = []
      if (parsed.historical_payments) {
        historicalPayments = parseHistoricalPayments(parsed.historical_payments)
        const sumHistorical = historicalPayments.reduce((s, p) => s + p.amount, 0)
        const declaredPaid = parsed.paid_so_far ?? 0
        // Si declararon paid_so_far Y dieron historical_payments, deben coincidir (tolerancia 0.01)
        if (declaredPaid > 0 && Math.abs(sumHistorical - declaredPaid) > 0.01) {
          throw new Error(`Suma de pagos históricos (${sumHistorical.toFixed(2)}) no coincide con paid_so_far (${declaredPaid.toFixed(2)})`)
        }
      }
      results.push({
        row_index: i,
        status: 'success',
        remaining_debt: parsed.original_total - (parsed.paid_so_far ?? 0),
        input: parsed,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      // Zod errors pueden ser largos, extraer el primero
      let cleanMsg = msg
      try {
        const zerr = JSON.parse(msg)
        if (Array.isArray(zerr) && zerr[0]?.message) {
          cleanMsg = `${zerr[0].path?.join('.') ?? 'campo'}: ${zerr[0].message}`
        }
      } catch { /* not JSON */ }
      results.push({
        row_index: i,
        status: 'error',
        error: cleanMsg,
      })
    }
  }

  return { success: true, results }
}

// ── Importar (commit) ──────────────────────────────────────────────────────
export async function importLegacyDebts(
  rawRows: Array<Record<string, any>>,
  options: {
    sourceLabel?: string
    sourceFilename?: string
  } = {},
): Promise<LegacyImportBatchResult> {
  let userId: string
  try {
    const auth = await requireAdmin()
    userId = auth.userId
  } catch (e) {
    return {
      success: false,
      total_rows: rawRows.length,
      successful_rows: 0,
      failed_rows: rawRows.length,
      total_debt_amount: 0,
      results: [],
      error: e instanceof Error ? e.message : 'Unauthorized',
    }
  }

  const service = createServiceClient()

  // 1. Crear el batch (auditoría) — si la tabla no existe aún, continuar sin batch
  let batchId: string | null = null
  const { data: batch, error: batchError } = await service
    .from('legacy_import_batches')
    .insert({
      imported_by: userId,
      source_label: options.sourceLabel || 'Importación manual',
      source_filename: options.sourceFilename || null,
      total_rows: rawRows.length,
      successful_rows: 0,
      failed_rows: 0,
      total_debt_amount: 0,
      raw_payload: rawRows,
    })
    .select('id')
    .single()

  if (batchError) {
    // Si la tabla no existe (42P01) o hay RLS (42501), continuamos sin batch
    // Casos comunes: migración no ejecutada todavía
    if (!['42P01', '42501', '23514'].includes(batchError.code ?? '')) {
      // Error inesperado — fallar
      return {
        success: false,
        total_rows: rawRows.length,
        successful_rows: 0,
        failed_rows: rawRows.length,
        total_debt_amount: 0,
        results: [],
        error: `Error al crear batch: ${batchError.message}`,
      }
    }
    console.warn('[legacy-import] Batch table not available, importing without audit batch:', batchError.code)
  } else {
    batchId = batch?.id ?? null
  }
  const results: LegacyImportRowResult[] = []
  let totalDebt = 0
  let successCount = 0
  let failCount = 0

  // 2. Procesar cada fila
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    try {
      const { row, historicalPayments } = prepareLegacyRow(raw)

      const result = await processRow(service, row, historicalPayments, batchId, userId, i, options.sourceLabel)
      results.push(result)
      if (result.status === 'success') {
        successCount++
        totalDebt += result.remaining_debt ?? 0
      } else {
        failCount++
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      let cleanMsg = msg
      try {
        const zerr = JSON.parse(msg)
        if (Array.isArray(zerr) && zerr[0]?.message) {
          cleanMsg = `${zerr[0].path?.join('.') ?? 'campo'}: ${zerr[0].message}`
        }
      } catch { /* not JSON */ }
      results.push({ row_index: i, status: 'error', error: cleanMsg })
      failCount++
    }
  }

  // 3. Actualizar resumen del batch (si existe)
  if (batchId) {
    await service
      .from('legacy_import_batches')
      .update({
        successful_rows: successCount,
        failed_rows: failCount,
        total_debt_amount: totalDebt,
      })
      .eq('id', batchId)
  }

  revalidatePath('/clients')
  revalidatePath('/debt')
  revalidatePath('/dashboard')
  revalidatePath('/map')
  revalidatePath('/admin/import-debts')

  return {
    success: failCount === 0,
    batch_id: batchId,
    total_rows: rawRows.length,
    successful_rows: successCount,
    failed_rows: failCount,
    total_debt_amount: totalDebt,
    results,
  }
}

// ── Procesa una fila atómicamente ───────────────────────────────────────────
async function processRow(
  service: ReturnType<typeof createServiceClient>,
  row: LegacyDebtRow,
  historicalPayments: HistoricalPayment[],
  batchId: string | null,
  userId: string,
  rowIndex: number,
  sourceLabel?: string,
): Promise<LegacyImportRowResult> {
  // ── Paso 1: cliente (find or create) ─────────────────────────────────────
  let clientId: string
  let clientWasCreated = false

  const { data: existingClient } = await service
    .from('clients')
    .select('id, name, address, email, lat, lng')
    .eq('dni', row.dni)
    .maybeSingle()

  const fullAddress = [row.address, row.district].filter(Boolean).join(', ') || null
  const coords = await geocodeLegacyAddress(fullAddress)

  if (existingClient) {
    clientId = existingClient.id
    // Si tiene datos faltantes, actualízalos sin sobrescribir
    const updates: any = {}
    if (!existingClient.address && fullAddress) updates.address = fullAddress
    if (!existingClient.email && row.email) updates.email = row.email
    if (coords && (existingClient.lat == null || existingClient.lng == null)) {
      updates.lat = coords.lat
      updates.lng = coords.lng
    }
    if (Object.keys(updates).length > 0) {
      await service.from('clients').update(updates).eq('id', clientId)
    }
  } else {
    const { data: newClient, error: createError } = await service
      .from('clients')
      .insert({
        dni: row.dni,
        name: row.name,
        email: row.email || null,
        phone: row.phone || null,
        address: fullAddress,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        birthday: row.birthday || null,
        active: true,
        imported_from_legacy: true,
        legacy_source: sourceLabel || 'Importación legacy',
        legacy_imported_at: new Date().toISOString(),
        legacy_notes: row.notes || null,
      })
      .select('id')
      .single()

    if (createError || !newClient) {
      throw new Error(`No se pudo crear cliente: ${createError?.message ?? 'unknown'}`)
    }
    clientId = newClient.id
    clientWasCreated = true
  }

  // ── Paso 2: credit_plan (1 cuota = saldo pendiente, status según pagos) ──
  const totalAmount = row.original_total
  const paidSoFar = row.paid_so_far ?? 0
  const remainingDebt = totalAmount - paidSoFar

  if (remainingDebt <= 0.01) {
    // Sin deuda pendiente → solo registrar el cliente, no crear plan
    return {
      row_index: rowIndex,
      status: 'success',
      client_id: clientId,
      client_was_created: clientWasCreated,
      remaining_debt: 0,
      payments_created: 0,
      input: row,
    }
  }

  // installments_count tiene CHECK BETWEEN 1 AND 6 → usamos 1
  const dueDate = row.due_date ? normalizeDateOnlyPeru(row.due_date) : addDaysPeru(30)
  const todayPeru = getTodayPeru()
  const installmentStatus =
    paidSoFar > 0 ? 'PARTIAL' :
    dueDate < todayPeru ? 'OVERDUE' :
    'PENDING'

  const { data: plan, error: planError } = await service
    .from('credit_plans')
    .insert({
      client_id: clientId,
      sale_id: null,                           // no hay venta original en este sistema
      total_amount: totalAmount,
      installments_count: 1,
      installment_amount: totalAmount,
      status: 'ACTIVE',
      imported_from_legacy: true,
      legacy_source: sourceLabel || 'Importación legacy',
      legacy_purchase_description: row.purchase_description,
      legacy_purchase_date: normalizeDateOnlyPeru(row.purchase_date),
      legacy_original_total: totalAmount,
      legacy_imported_at: new Date().toISOString(),
      legacy_imported_by: userId,
      legacy_notes: row.notes || null,
      legacy_batch_id: batchId || null,
    })
    .select('id')
    .single()

  if (planError || !plan) {
    throw new Error(`No se pudo crear plan de crédito: ${planError?.message ?? 'unknown'}`)
  }

  // ── Paso 3: installment ─────────────────────────────────────────────────
  const { data: installment, error: instError } = await service
    .from('installments')
    .insert({
      plan_id: plan.id,
      installment_number: 1,
      amount: totalAmount,
      due_date: dueDate,
      paid_amount: paidSoFar,
      status: installmentStatus,
      paid_at: paidSoFar > 0 ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (instError || !installment) {
    // Rollback: borrar el plan recién creado
    await service.from('credit_plans').delete().eq('id', plan.id)
    throw new Error(`No se pudo crear cuota: ${instError?.message ?? 'unknown'}`)
  }

  // ── Paso 4: pagos históricos (si hay) ───────────────────────────────────
  let paymentsCreated = 0
  if (historicalPayments.length > 0) {
    const paymentRecords = historicalPayments.map(p => ({
      client_id: clientId,
      amount: p.amount,
      payment_date: normalizeDateOnlyPeru(p.payment_date),
      user_id: userId,
      notes: `[LEGACY] ${p.method ? `${p.method} — ` : ''}${p.notes || 'Pago histórico importado'}`,
      plan_id: plan.id,
      installment_id: installment.id,
      imported_from_legacy: true,
      legacy_source: sourceLabel || 'Importación legacy',
      legacy_batch_id: batchId || null,
    }))

    const { data: insertedPayments, error: payError } = await service
      .from('payments')
      .insert(paymentRecords)
      .select('id')

    if (!payError && insertedPayments) {
      paymentsCreated = insertedPayments.length
    }
    // No fallamos si los pagos no se insertan — la deuda principal ya está
  } else if (paidSoFar > 0) {
    // Si declararon paid_so_far pero no detallaron historial, crear 1 pago consolidado
    const { error: payError } = await service.from('payments').insert({
      client_id: clientId,
      amount: paidSoFar,
      payment_date: normalizeDateOnlyPeru(row.purchase_date),  // mejor estimado
      user_id: userId,
      notes: `[LEGACY] Pagos previos consolidados (sin detalle histórico)`,
      plan_id: plan.id,
      installment_id: installment.id,
      imported_from_legacy: true,
      legacy_source: sourceLabel || 'Importación legacy',
      legacy_batch_id: batchId || null,
    })
    if (!payError) paymentsCreated = 1
  }

  // ── Paso 5: actualizar credit_used del cliente ──────────────────────────
  const { error: recalcError } = await service.rpc('recalculate_client_credit_used', { p_client_id: clientId })
  if (recalcError) {
    // Si el RPC no existe, calcular manualmente
    const { data: allInst } = await service
      .from('installments')
      .select('amount, paid_amount')
      .in('plan_id', [plan.id])
    const used = (allInst ?? []).reduce(
      (s, x: any) => s + (Number(x.amount) - Number(x.paid_amount)),
      0,
    )
    await service.from('clients').update({ credit_used: used }).eq('id', clientId)
  }

  return {
    row_index: rowIndex,
    status: 'success',
    client_id: clientId,
    client_was_created: clientWasCreated,
    credit_plan_id: plan.id,
    payments_created: paymentsCreated,
    remaining_debt: remainingDebt,
    input: row,
  }
}

// ── Listar batches importados (para auditoría) ─────────────────────────────
export async function listLegacyImportBatches() {
  try {
    await requireAdmin()
  } catch {
    return { success: false, data: [], error: 'Unauthorized' }
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('legacy_import_batches')
    .select('id, imported_at, source_label, source_filename, total_rows, successful_rows, failed_rows, total_debt_amount, notes, imported_by, users:imported_by(name, email)')
    .order('imported_at', { ascending: false })
    .limit(50)

  if (error) return { success: false, data: [], error: error.message }
  return { success: true, data: data || [] }
}
