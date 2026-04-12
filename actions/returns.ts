'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

const STORE_DISPLAY: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

export async function getReturnsAction(userStores?: string[], selectedStore?: string) {
  const service = createServiceClient()

  let query = service
    .from('returns')
    .select(`
      *,
      clients ( id, name, dni ),
      sales ( sale_type )
    `)
    .order('created_at', { ascending: false })

  const storeFilter = selectedStore && selectedStore !== 'ALL'
    ? selectedStore.toUpperCase()
    : (userStores && userStores.length === 1 ? userStores[0].toUpperCase() : null)

  if (storeFilter) {
    const storeText = STORE_DISPLAY[storeFilter]
    if (storeText) query = query.eq('store_id', storeText) as typeof query
  }

  const { data, error } = await query
  if (error) {
    console.error('Error fetching returns:', error)
    return { success: false, error: error.message, data: [] }
  }
  return { success: true, data: data || [] }
}

export async function createReturnAction(formData: {
  saleId: string
  saleNumber: string
  clientId: string | null
  clientName: string
  storeId: string
  saleType: 'CONTADO' | 'CREDITO'
  reason: string
  reasonType: string
  totalAmount: number
  returnedItems: any[]
  notes?: string
}) {
  const supabase = await createServerClient()

  const { data: returnNumber } = await supabase.rpc('generate_return_number')

  const { data, error } = await supabase
    .from('returns')
    .insert({
      sale_id:        formData.saleId,
      sale_number:    formData.saleNumber,
      client_id:      formData.clientId,
      client_name:    formData.clientName,
      store_id:       formData.storeId,
      return_number:  returnNumber,
      reason:         formData.reason,
      reason_type:    formData.reasonType,
      return_type:    'REEMBOLSO',   // Solo reembolso — sin opción de cambio
      total_amount:   formData.totalAmount,
      returned_items: formData.returnedItems,
      exchange_items: [],
      notes:          formData.notes,
      status:         'PENDIENTE',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating return:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/returns')
  return { success: true, data }
}

export async function approveReturnAction(returnId: string) {
  const authClient = await createServerClient()
  const service    = createServiceClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }

  // ── 1. Fetch devolución ───────────────────────────────────────────────────
  const { data: ret, error: fetchErr } = await service
    .from('returns')
    .select('id, return_type, total_amount, client_id, store_id, sale_id, sale_number, return_number, status')
    .eq('id', returnId)
    .single()

  if (fetchErr || !ret) {
    return { success: false, error: fetchErr?.message || 'Devolución no encontrada' }
  }
  if (ret.status !== 'PENDIENTE') {
    return { success: false, error: `La devolución ya está en estado "${ret.status}"` }
  }

  const returnAmount = Number(ret.total_amount)

  // ── 2. Obtener tipo de venta original (CONTADO / CREDITO) ─────────────────
  let saleType: 'CONTADO' | 'CREDITO' = 'CONTADO'
  if (ret.sale_id) {
    const { data: sale } = await service
      .from('sales')
      .select('sale_type')
      .eq('id', ret.sale_id)
      .single()
    if (sale?.sale_type) saleType = sale.sale_type as 'CONTADO' | 'CREDITO'
  }

  // ── 3. Validación de caja abierta (CONTADO → egreso en efectivo) ──────────
  let openShiftId: string | null = null
  if (saleType === 'CONTADO' && returnAmount > 0) {
    const { data: shift } = await service
      .from('cash_shifts')
      .select('id')
      .eq('store_id', ret.store_id)
      .eq('status', 'OPEN')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!shift) {
      return {
        success: false,
        error: `No hay caja abierta en ${ret.store_id}. Abre la caja antes de aprobar este reembolso en efectivo.`,
      }
    }
    openShiftId = shift.id
  }

  // ── 4. Marcar como APROBADA ───────────────────────────────────────────────
  const { data, error } = await service
    .from('returns')
    .update({ status: 'APROBADA', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', returnId)
    .select()
    .single()

  if (error) {
    console.error('Error approving return:', error)
    return { success: false, error: error.message }
  }

  // ── 5a. CONTADO → Registrar egreso en caja ────────────────────────────────
  if (saleType === 'CONTADO' && openShiftId && returnAmount > 0) {
    const { error: expErr } = await service.from('cash_expenses').insert({
      shift_id:    openShiftId,
      amount:      returnAmount,
      category:    'DEVOLUCION',
      description: `Reembolso devolución ${ret.return_number} — venta ${ret.sale_number}`,
      user_id:     user.id,
    })
    if (expErr) {
      // Egreso no registrado: lo advertimos pero la aprobación ya se hizo
      console.error('[approveReturn] cash_expenses insert failed:', expErr)
    }
  }

  // ── 5b. CREDITO → Cancelar plan, cuotas pendientes y restaurar crédito ────
  if (saleType === 'CREDITO' && ret.client_id && ret.sale_id) {
    try {
      const { data: creditPlan } = await service
        .from('credit_plans')
        .select('id, total_amount')
        .eq('sale_id', ret.sale_id)
        .maybeSingle()

      if (creditPlan) {
        // Cancelar el plan de crédito
        await service
          .from('credit_plans')
          .update({ status: 'CANCELLED' })
          .eq('id', creditPlan.id)

        // Eliminar cuotas pendientes / vencidas (las pagadas quedan como registro)
        await service
          .from('installments')
          .delete()
          .eq('plan_id', creditPlan.id)
          .in('status', ['PENDING', 'OVERDUE'])

        // Restaurar credit_used del cliente por el monto del plan completo
        const { data: client } = await service
          .from('clients')
          .select('credit_used')
          .eq('id', ret.client_id)
          .single()

        if (client) {
          const planAmount    = Number(creditPlan.total_amount)
          const newCreditUsed = Math.max(0, Number(client.credit_used) - planAmount)
          await service
            .from('clients')
            .update({ credit_used: newCreditUsed })
            .eq('id', ret.client_id)
        }
      }
    } catch (creditErr) {
      console.error('[approveReturn] Credit plan cancellation failed:', creditErr)
    }
  }

  revalidatePath('/returns')
  revalidatePath('/cash')
  revalidatePath('/clients')
  revalidatePath('/debt')
  revalidatePath('/collections')
  return { success: true, data, saleType }
}

export async function rejectReturnAction(returnId: string, adminNotes: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('returns')
    .update({ status: 'RECHAZADA', admin_notes: adminNotes })
    .eq('id', returnId)
    .select()
    .single()

  if (error) {
    console.error('Error rejecting return:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/returns')
  return { success: true, data }
}

export async function completeReturnAction(returnId: string, refundAmount?: number) {
  const service = createServiceClient()

  const { data: returnRecord, error: fetchError } = await service
    .from('returns')
    .select('returned_items, store_id, return_type, total_amount, client_id, sale_id, return_number, sale_number, status')
    .eq('id', returnId)
    .single()

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }
  if (returnRecord.status !== 'APROBADA') {
    return { success: false, error: `Solo se pueden completar devoluciones en estado APROBADA (actual: ${returnRecord.status})` }
  }

  const { data, error } = await service
    .from('returns')
    .update({ status: 'COMPLETADA', refund_amount: refundAmount ?? Number(returnRecord.total_amount) })
    .eq('id', returnId)
    .select()
    .single()

  if (error) {
    console.error('Error completing return:', error)
    return { success: false, error: error.message }
  }

  // ── Restaurar stock ───────────────────────────────────────────────────────
  const returnedItems: Array<{ product_id?: string; quantity?: number }> =
    Array.isArray(returnRecord?.returned_items) ? returnRecord.returned_items : []

  for (const item of returnedItems) {
    if (!item.product_id || !item.quantity || item.quantity <= 0) continue
    const { error: stockError } = await service.rpc('increment_stock', {
      p_product_id: item.product_id,
      p_quantity:   item.quantity,
    })
    if (stockError) {
      // Fallback: direct UPDATE
      const { data: existing } = await service
        .from('stock')
        .select('quantity')
        .eq('product_id', item.product_id)
        .maybeSingle()
      if (existing) {
        await service
          .from('stock')
          .update({ quantity: (existing.quantity ?? 0) + item.quantity })
          .eq('product_id', item.product_id)
      }
    }
  }

  revalidatePath('/returns')
  revalidatePath('/inventory/stock')
  revalidatePath('/cash')
  return { success: true, data }
}

export async function requestExtensionAction(returnId: string, extensionReason: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('returns')
    .update({ extension_requested: true, extension_reason: extensionReason })
    .eq('id', returnId)
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/returns')
  return { success: true, data }
}

export async function grantExtensionAction(returnId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('returns')
    .update({ extension_granted: true, extension_date: new Date().toISOString() })
    .eq('id', returnId)
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/returns')
  return { success: true, data }
}

export async function checkReturnEligibilityAction(saleId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase.rpc('check_return_eligibility', { p_sale_id: saleId })
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}
