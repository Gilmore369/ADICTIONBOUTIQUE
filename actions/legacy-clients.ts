'use server'

/**
 * Legacy Clients — Duplicados entre tiendas + edición de datos migrados
 *
 * Contexto: la migración trajo dos sistemas independientes:
 *   - DBAdiction 2008  → Tienda MUJERES
 *   - BoutiqueV 2008   → Tienda HOMBRES
 * Cada sistema tenía su propia lista de clientes con su propio DNI, así que
 * una misma persona puede existir como DOS clientes separados (uno por tienda).
 * Los DNIs no coinciden (uno real, otro placeholder tipo 00001399 / LEGxxxx),
 * por eso nunca se fusionaron. Además los sufijos (H)/(M) del nombre vienen del
 * sistema antiguo y NO indican la tienda de forma confiable.
 *
 * Este módulo:
 *   1. Detecta duplicados cruzados (mismo nombre normalizado en ambas fuentes).
 *   2. Permite editar los datos legacy (nombre, DNI, límite, deuda) para
 *      corroborar contra el sistema original.
 *   3. Permite desactivar el registro duplicado sobrante (reversible: restaurar).
 *
 * Acceso: admin. Toda operación queda auditada en action_logs.
 */

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createActionLog } from '@/lib/services/action-service'
import { ActionType } from '@/lib/types/crm'
import { getTodayPeru } from '@/lib/utils/timezone'

// ── Auth: admin-only ─────────────────────────────────────────────────────────
async function requireAdmin(): Promise<{ userId: string }> {
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
    throw new Error('Se requieren permisos de administrador')
  }
  return { userId: user.id }
}

// ── Helpers de normalización ──────────────────────────────────────────────────
/** Normaliza un nombre para comparar duplicados: quita sufijos (H)/(M), "+N", acentos. */
function normalizeName(raw: string | null | undefined): string {
  if (!raw) return ''
  let s = raw.toUpperCase()
  s = s.replace(/\+\s*\d+/g, ' ')            // "+ 15", "+100"
  s = s.replace(/\([^)]*\)/g, ' ')           // "(H)", "(M)", "(cta facebook...)"
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '') // acentos
  s = s.replace(/[^A-Z ]/g, ' ')             // solo letras y espacios
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

export type LegacyStore = 'HOMBRES' | 'MUJERES' | 'OTRO'

function storeFromSource(src: string | null | undefined): LegacyStore {
  if (!src) return 'OTRO'
  if (/boutiquev|hombres/i.test(src)) return 'HOMBRES'
  if (/dbadiction|mujeres/i.test(src)) return 'MUJERES'
  return 'OTRO'
}

/** Un DNI placeholder no es un documento real (secuencial 0000.. o LEGxxxx). */
function isPlaceholderDni(dni: string | null | undefined): boolean {
  if (!dni) return true
  const d = dni.trim()
  if (/^0+\d*$/.test(d)) return true          // 00001399, 0000221
  if (/^leg/i.test(d)) return true            // LEG5353
  if (d.length < 8) return true
  return false
}

// ── Tipos de salida ───────────────────────────────────────────────────────────
export interface LegacyClientRecord {
  id: string
  dni: string
  name: string
  store: LegacyStore
  legacy_source: string | null
  credit_used: number
  credit_limit: number
  active: boolean
  phone: string | null
  email: string | null
  placeholder_dni: boolean
}

export interface DuplicateGroup {
  key: string
  display_name: string
  total_debt: number
  has_debt: boolean
  records: LegacyClientRecord[]
}

// ── Descarga paginada de todos los clientes (service = sin RLS) ────────────────
async function fetchAllClients(service: ReturnType<typeof createServiceClient>) {
  const rows: any[] = []
  let from = 0
  const page = 1000
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await service
      .from('clients')
      .select('id,dni,name,credit_used,credit_limit,active,legacy_source,phone,email')
      .order('id', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < page) break
    from += page
  }
  return rows
}

// ── 1) Detectar duplicados cruzados ────────────────────────────────────────────
export async function findCrossStoreDuplicates(): Promise<{
  success: boolean
  groups: DuplicateGroup[]
  stats: { total_groups: number; records_involved: number; with_debt: number; total_debt: number }
  error?: string
}> {
  try {
    await requireAdmin()
  } catch (e) {
    return {
      success: false, groups: [],
      stats: { total_groups: 0, records_involved: 0, with_debt: 0, total_debt: 0 },
      error: e instanceof Error ? e.message : 'Unauthorized',
    }
  }

  try {
    const service = createServiceClient()
    const all = await fetchAllClients(service)

    // Agrupar por nombre normalizado
    const byName = new Map<string, any[]>()
    for (const c of all) {
      const key = normalizeName(c.name)
      if (key.length < 4) continue
      if (!byName.has(key)) byName.set(key, [])
      byName.get(key)!.push(c)
    }

    const groups: DuplicateGroup[] = []
    for (const [key, recs] of byName) {
      if (recs.length < 2) continue
      const stores = new Set(recs.map(r => storeFromSource(r.legacy_source)))
      // Solo nos interesan los que tienen registro en AMBAS tiendas
      if (!(stores.has('HOMBRES') && stores.has('MUJERES'))) continue

      const records: LegacyClientRecord[] = recs.map(r => ({
        id: r.id,
        dni: r.dni,
        name: r.name,
        store: storeFromSource(r.legacy_source),
        legacy_source: r.legacy_source,
        credit_used: Number(r.credit_used) || 0,
        credit_limit: Number(r.credit_limit) || 0,
        active: !!r.active,
        phone: r.phone ?? null,
        email: r.email ?? null,
        placeholder_dni: isPlaceholderDni(r.dni),
      })).sort((a, b) => b.credit_used - a.credit_used)

      const totalDebt = records.reduce((s, r) => s + r.credit_used, 0)
      groups.push({
        key,
        display_name: records[0]?.name ?? key,
        total_debt: totalDebt,
        has_debt: records.some(r => r.credit_used > 1),
        records,
      })
    }

    // Ordenar: primero los que tienen deuda, por monto desc
    groups.sort((a, b) => {
      if (a.has_debt !== b.has_debt) return a.has_debt ? -1 : 1
      return b.total_debt - a.total_debt
    })

    const recordsInvolved = groups.reduce((s, g) => s + g.records.length, 0)
    const withDebt = groups.filter(g => g.has_debt).length
    const totalDebt = groups.reduce((s, g) => s + g.total_debt, 0)

    return {
      success: true,
      groups,
      stats: {
        total_groups: groups.length,
        records_involved: recordsInvolved,
        with_debt: withDebt,
        total_debt: totalDebt,
      },
    }
  } catch (e) {
    return {
      success: false, groups: [],
      stats: { total_groups: 0, records_involved: 0, with_debt: 0, total_debt: 0 },
      error: e instanceof Error ? e.message : 'Error al detectar duplicados',
    }
  }
}

// ── 2) Detalle legacy de un cliente (para el dialog de edición) ─────────────────
export interface LegacyClientDetail {
  id: string
  dni: string
  name: string
  credit_limit: number
  credit_used: number
  active: boolean
  legacy_source: string | null
  legacy_notes: string | null
  imported_from_legacy: boolean
  store: LegacyStore
  // Estructura de deuda
  outstanding: number          // saldo pendiente real (suma de cuotas abiertas)
  active_plan_count: number
  open_installment_count: number
  has_sale_linked_plans: boolean   // true => editar el total consolidará
}

export async function getLegacyClientDetail(clientId: string): Promise<{
  success: boolean
  data?: LegacyClientDetail
  error?: string
}> {
  try {
    await requireAdmin()
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unauthorized' }
  }

  try {
    const service = createServiceClient()
    const { data: client, error: cErr } = await service
      .from('clients')
      .select('id,dni,name,credit_limit,credit_used,active,legacy_source,legacy_notes,imported_from_legacy')
      .eq('id', clientId)
      .single()
    if (cErr || !client) throw new Error(cErr?.message || 'Cliente no encontrado')

    const { data: plans } = await service
      .from('credit_plans')
      .select('id,sale_id,status,installments(id,amount,paid_amount,status)')
      .eq('client_id', clientId)
      .eq('status', 'ACTIVE')

    let outstanding = 0
    let openInstallments = 0
    let hasSaleLinked = false
    const activePlans = plans ?? []
    for (const p of activePlans as any[]) {
      if (p.sale_id) hasSaleLinked = true
      for (const inst of (p.installments ?? [])) {
        if (['PENDING', 'PARTIAL', 'OVERDUE'].includes(inst.status)) {
          outstanding += (Number(inst.amount) || 0) - (Number(inst.paid_amount) || 0)
          openInstallments++
        }
      }
    }

    return {
      success: true,
      data: {
        id: client.id,
        dni: client.dni,
        name: client.name,
        credit_limit: Number(client.credit_limit) || 0,
        credit_used: Number(client.credit_used) || 0,
        active: !!client.active,
        legacy_source: client.legacy_source ?? null,
        legacy_notes: client.legacy_notes ?? null,
        imported_from_legacy: !!client.imported_from_legacy,
        store: storeFromSource(client.legacy_source),
        outstanding: Math.round(outstanding * 100) / 100,
        active_plan_count: activePlans.length,
        open_installment_count: openInstallments,
        has_sale_linked_plans: hasSaleLinked,
      },
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al cargar el cliente' }
  }
}

// ── 3) Editar identidad / datos de contacto legacy ──────────────────────────────
export async function updateLegacyClientIdentity(input: {
  clientId: string
  name?: string
  dni?: string
  credit_limit?: number
  phone?: string | null
  email?: string | null
  legacy_notes?: string | null
}): Promise<{ success: boolean; error?: string }> {
  let userId: string
  try {
    ({ userId } = await requireAdmin())
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unauthorized' }
  }

  try {
    const service = createServiceClient()
    const { data: before } = await service
      .from('clients')
      .select('name,dni,credit_limit')
      .eq('id', input.clientId)
      .single()
    if (!before) throw new Error('Cliente no encontrado')

    const updates: Record<string, any> = {}
    if (typeof input.name === 'string' && input.name.trim().length >= 2) updates.name = input.name.trim()
    if (typeof input.dni === 'string' && input.dni.trim().length >= 3) updates.dni = input.dni.trim()
    if (typeof input.credit_limit === 'number' && !isNaN(input.credit_limit) && input.credit_limit >= 0) {
      updates.credit_limit = input.credit_limit
    }
    if (input.phone !== undefined) updates.phone = input.phone || null
    if (input.email !== undefined) updates.email = input.email || null
    if (input.legacy_notes !== undefined) updates.legacy_notes = input.legacy_notes || null

    if (Object.keys(updates).length === 0) {
      return { success: false, error: 'No hay cambios para guardar' }
    }

    // DNI único: si cambia, verificar que no choque con otro cliente
    if (updates.dni && updates.dni !== (before as any).dni) {
      const { data: clash } = await service
        .from('clients')
        .select('id')
        .eq('dni', updates.dni)
        .neq('id', input.clientId)
        .maybeSingle()
      if (clash) {
        return { success: false, error: `El DNI ${updates.dni} ya pertenece a otro cliente` }
      }
    }

    const { error: upErr } = await service
      .from('clients')
      .update(updates)
      .eq('id', input.clientId)
    if (upErr) throw new Error(upErr.message)

    // Auditoría
    const changes: string[] = []
    if (updates.name && updates.name !== (before as any).name) changes.push(`nombre: "${(before as any).name}" → "${updates.name}"`)
    if (updates.dni && updates.dni !== (before as any).dni) changes.push(`DNI: ${(before as any).dni} → ${updates.dni}`)
    if (updates.credit_limit != null && updates.credit_limit !== Number((before as any).credit_limit)) {
      changes.push(`límite: S/${(before as any).credit_limit} → S/${updates.credit_limit}`)
    }
    await safeAudit(input.clientId, `[EDIT LEGACY] ${changes.join(' · ') || 'datos de contacto actualizados'}`, userId)

    revalidatePaths(input.clientId)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al guardar' }
  }
}

// ── 4) Ajustar la deuda pendiente (saldo) de un cliente legacy ──────────────────
/**
 * Establece el saldo pendiente del cliente a `newOutstanding`.
 *  - Si == 0: anula (VOIDED) todas las cuotas abiertas y marca sus planes COMPLETED.
 *  - Si hay exactamente 1 cuota abierta: edita su monto (no destructivo, reversible).
 *  - Si hay varias cuotas/planes: consolida (anula las abiertas, completa sus planes,
 *    y crea UN plan legacy huérfano con 1 cuota por el nuevo saldo). Las ventas se
 *    conservan en el historial. Se audita con el detalle previo.
 * Luego recalcula credit_used.
 */
export async function setLegacyClientOutstanding(input: {
  clientId: string
  newOutstanding: number
  reason: string
}): Promise<{ success: boolean; error?: string; consolidated?: boolean }> {
  let userId: string
  try {
    ({ userId } = await requireAdmin())
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unauthorized' }
  }

  const newOut = Math.round((Number(input.newOutstanding) || 0) * 100) / 100
  if (newOut < 0) return { success: false, error: 'El saldo no puede ser negativo' }
  if (!input.reason || input.reason.trim().length < 3) {
    return { success: false, error: 'Indica un motivo (mínimo 3 caracteres)' }
  }

  try {
    const service = createServiceClient()

    const { data: client } = await service
      .from('clients')
      .select('id,name,legacy_source')
      .eq('id', input.clientId)
      .single()
    if (!client) throw new Error('Cliente no encontrado')

    const { data: plans } = await service
      .from('credit_plans')
      .select('id,sale_id,status,installments(id,amount,paid_amount,status,due_date,installment_number)')
      .eq('client_id', input.clientId)
      .eq('status', 'ACTIVE')

    const activePlans = (plans ?? []) as any[]
    type OpenInst = { id: string; amount: number; paid_amount: number; status: string; plan_id: string }
    const openInstallments: OpenInst[] = []
    for (const p of activePlans) {
      for (const inst of (p.installments ?? [])) {
        if (['PENDING', 'PARTIAL', 'OVERDUE'].includes(inst.status)) {
          openInstallments.push({
            id: inst.id,
            amount: Number(inst.amount) || 0,
            paid_amount: Number(inst.paid_amount) || 0,
            status: inst.status,
            plan_id: p.id,
          })
        }
      }
    }

    const current = Math.round(
      openInstallments.reduce((s, i) => s + (i.amount - i.paid_amount), 0) * 100,
    ) / 100

    if (Math.abs(current - newOut) < 0.01) {
      return { success: true, consolidated: false }
    }

    let consolidated = false

    // Caso simple: 1 sola cuota abierta → editar su monto (reversible, no destructivo)
    if (newOut > 0 && openInstallments.length === 1) {
      const inst = openInstallments[0]
      const newAmount = Math.round((newOut + inst.paid_amount) * 100) / 100
      const { error: e1 } = await service
        .from('installments')
        .update({
          amount: newAmount,
          status: inst.paid_amount > 0 ? 'PARTIAL' : (inst.status === 'PAID' ? 'OVERDUE' : inst.status),
        })
        .eq('id', inst.id)
      if (e1) throw new Error(e1.message)
      // Si el plan tiene 1 cuota, sincronizar total/installment_amount
      const plan = activePlans.find(p => p.id === inst.plan_id)
      if (plan && (plan.installments ?? []).length === 1) {
        await service.from('credit_plans')
          .update({ total_amount: newAmount, installment_amount: newAmount })
          .eq('id', plan.id)
      }
    } else {
      // Consolidación: anular cuotas abiertas + completar sus planes, y crear 1 plan nuevo
      consolidated = activePlans.some(p => (p.installments ?? []).length > 1) || openInstallments.length > 1 || activePlans.some(p => p.sale_id)

      if (openInstallments.length > 0) {
        const instIds = openInstallments.map(i => i.id)
        const { error: eVoid } = await service
          .from('installments')
          .update({ status: 'VOIDED' })
          .in('id', instIds)
        if (eVoid) throw new Error(eVoid.message)

        const planIds = Array.from(new Set(openInstallments.map(i => i.plan_id)))
        await service.from('credit_plans').update({ status: 'COMPLETED' }).in('id', planIds)
      }

      if (newOut > 0) {
        const today = getTodayPeru()
        const { data: newPlan, error: ePlan } = await service
          .from('credit_plans')
          .insert({
            client_id: input.clientId,
            sale_id: null,
            total_amount: newOut,
            installments_count: 1,
            installment_amount: newOut,
            status: 'ACTIVE',
            imported_from_legacy: true,
            legacy_source: (client as any).legacy_source || 'Ajuste legacy',
            legacy_purchase_description: `[AJUSTE MANUAL] Saldo corregido (antes S/${current.toFixed(2)}) — ${input.reason.trim()}`,
            legacy_purchase_date: today,
            legacy_original_total: newOut,
            legacy_imported_by: userId,
            legacy_notes: input.reason.trim(),
          })
          .select('id')
          .single()
        if (ePlan || !newPlan) throw new Error(ePlan?.message || 'No se pudo crear el plan de ajuste')

        const { error: eInst } = await service
          .from('installments')
          .insert({
            plan_id: newPlan.id,
            installment_number: 1,
            amount: newOut,
            due_date: today,
            paid_amount: 0,
            status: 'OVERDUE',
          })
        if (eInst) throw new Error(eInst.message)
      }
    }

    // Recalcular credit_used
    const { error: recalcErr } = await service.rpc('recalculate_client_credit_used', { p_client_id: input.clientId })
    if (recalcErr) {
      // Fallback manual
      await service.from('clients').update({ credit_used: newOut }).eq('id', input.clientId)
    }

    await safeAudit(
      input.clientId,
      `[AJUSTE DEUDA] saldo S/${current.toFixed(2)} → S/${newOut.toFixed(2)}${consolidated ? ' (consolidado)' : ''}. Motivo: ${input.reason.trim()}`,
      userId,
    )

    revalidatePaths(input.clientId)
    return { success: true, consolidated }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al ajustar la deuda' }
  }
}

// ── 5) Desactivar / reactivar un registro duplicado ─────────────────────────────
export async function deactivateDuplicateClient(input: {
  clientId: string
  reason: string
}): Promise<{ success: boolean; error?: string }> {
  let userId: string
  try {
    ({ userId } = await requireAdmin())
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unauthorized' }
  }

  try {
    const service = createServiceClient()
    const { error } = await service
      .from('clients')
      .update({
        active: false,
        deactivation_reason: 'OTRO',
        deactivated_at: new Date().toISOString(),
        deactivated_by: userId,
      })
      .eq('id', input.clientId)
    if (error) throw new Error(error.message)

    await safeAudit(input.clientId, `[DUPLICADO] Registro desactivado: ${input.reason?.trim() || 'duplicado entre tiendas'}`, userId)
    revalidatePaths(input.clientId)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al desactivar' }
  }
}

export async function reactivateDuplicateClient(input: {
  clientId: string
}): Promise<{ success: boolean; error?: string }> {
  let userId: string
  try {
    ({ userId } = await requireAdmin())
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unauthorized' }
  }

  try {
    const service = createServiceClient()
    const { error } = await service
      .from('clients')
      .update({ active: true, deactivation_reason: null, deactivated_at: null, deactivated_by: null })
      .eq('id', input.clientId)
    if (error) throw new Error(error.message)
    await safeAudit(input.clientId, `[DUPLICADO] Registro reactivado`, userId)
    revalidatePaths(input.clientId)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al reactivar' }
  }
}

// ── 6) Fusionar duplicados en un solo cliente ───────────────────────────────────
/**
 * Une uno o más registros duplicados (secondaryIds) dentro de un registro
 * principal (primaryId). NO modifica planes ni ventas: solo re-apunta el dueño
 * (client_id) de todas las tablas relacionadas, de modo que el cliente único
 * conserva las compras y deudas de AMBAS tiendas. La deuda sigue separada por
 * tienda porque cada plan/venta mantiene su legacy_source / store_id.
 *
 * Los registros secundarios quedan desactivados y marcados como fusionados
 * (no se borran físicamente → reversible re-apuntando de vuelta si hiciera falta).
 */
export async function mergeDuplicateClients(input: {
  primaryId: string
  secondaryIds: string[]
}): Promise<{ success: boolean; error?: string; moved?: Record<string, number> }> {
  let userId: string
  try {
    ({ userId } = await requireAdmin())
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unauthorized' }
  }

  const primaryId = input.primaryId
  const secondaryIds = (input.secondaryIds || []).filter(id => id && id !== primaryId)
  if (!primaryId) return { success: false, error: 'Falta el cliente principal' }
  if (secondaryIds.length === 0) return { success: false, error: 'No hay registros para unir' }

  try {
    const service = createServiceClient()

    // Verificar que todos existen
    const { data: involved } = await service
      .from('clients')
      .select('id,name,dni,credit_limit')
      .in('id', [primaryId, ...secondaryIds])
    if (!involved || involved.length !== secondaryIds.length + 1) {
      return { success: false, error: 'Alguno de los registros ya no existe' }
    }
    const primary = involved.find(c => c.id === primaryId)!
    const secondaries = involved.filter(c => c.id !== primaryId)

    // Tablas que referencian clients(id) por columna client_id → re-apuntar al principal
    const REPOINT_TABLES = [
      'credit_plans', 'sales', 'payments', 'returns',
      'collection_actions', 'client_action_logs', 'client_visits',
    ]

    const moved: Record<string, number> = {}
    for (const table of REPOINT_TABLES) {
      // contar lo que se moverá (para el reporte/auditoría)
      const { count } = await service
        .from(table)
        .select('*', { count: 'exact', head: true })
        .in('client_id', secondaryIds)

      const { error } = await service
        .from(table)
        .update({ client_id: primaryId })
        .in('client_id', secondaryIds)
      if (error) {
        return { success: false, error: `Error moviendo ${table}: ${error.message}`, moved }
      }
      moved[table] = count ?? 0
    }

    // client_ratings tiene 1 fila por cliente (único) → borrar las de los duplicados
    // (el rating es recalculable; el principal conserva el suyo)
    await service.from('client_ratings').delete().in('client_id', secondaryIds)

    // Unificar límite de crédito: tomar el mayor
    const maxLimit = Math.max(
      Number(primary.credit_limit) || 0,
      ...secondaries.map(s => Number(s.credit_limit) || 0),
    )
    if (maxLimit > (Number(primary.credit_limit) || 0)) {
      await service.from('clients').update({ credit_limit: maxLimit }).eq('id', primaryId)
    }

    // Desactivar y marcar los secundarios como fusionados (último paso → reintentable)
    for (const sec of secondaries) {
      await service
        .from('clients')
        .update({
          active: false,
          deactivation_reason: 'OTRO',
          deactivated_at: new Date().toISOString(),
          deactivated_by: userId,
          legacy_notes: `[FUSIONADO en ${primary.name} · DNI ${primary.dni} · id ${primaryId}]`,
        })
        .eq('id', sec.id)
      // recalcular su crédito (debería quedar en 0 al haber movido sus planes)
      await service.rpc('recalculate_client_credit_used', { p_client_id: sec.id }).then(
        () => {}, () => {},
      )
    }

    // Recalcular crédito del principal (ahora suma ambas tiendas)
    const { error: recalcErr } = await service.rpc('recalculate_client_credit_used', { p_client_id: primaryId })
    if (recalcErr) {
      console.warn('[merge] recalc principal falló:', recalcErr.message)
    }

    const totalPlans = moved['credit_plans'] || 0
    const totalSales = moved['sales'] || 0
    const dupNames = secondaries.map(s => `${s.name} (DNI ${s.dni})`).join(', ')
    await safeAudit(
      primaryId,
      `[FUSIÓN] Absorbió ${secondaries.length} duplicado(s): ${dupNames}. Movidos: ${totalPlans} plan(es), ${totalSales} venta(s).`,
      userId,
    )

    revalidatePaths(primaryId)
    secondaries.forEach(s => revalidatePath(`/clients/${s.id}`))
    return { success: true, moved }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al unir los registros' }
  }
}

// ── Utilidades internas ─────────────────────────────────────────────────────────
async function safeAudit(clientId: string, description: string, userId: string) {
  try {
    await createActionLog(clientId, ActionType.NOTA, description, userId)
  } catch (e) {
    console.warn('[legacy-clients] no se pudo auditar:', e instanceof Error ? e.message : e)
  }
}

function revalidatePaths(clientId: string) {
  revalidatePath('/admin/legacy-clients')
  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/clients')
  revalidatePath('/debt')
  revalidatePath('/debt/plans')
  revalidatePath('/dashboard')
  revalidatePath('/map')
}
