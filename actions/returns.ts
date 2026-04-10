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
      clients ( id, name, dni )
    `)
    .order('created_at', { ascending: false })

  // Determine which store to filter by
  const storeFilter = selectedStore && selectedStore !== 'ALL'
    ? selectedStore.toUpperCase()
    : (userStores && userStores.length === 1 ? userStores[0].toUpperCase() : null)

  if (storeFilter) {
    const storeText = STORE_DISPLAY[storeFilter]
    if (storeText) {
      query = query.eq('store_id', storeText) as typeof query
    }
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
  reason: string
  reasonType: string
  returnType: 'REEMBOLSO' | 'CAMBIO'
  totalAmount: number
  returnedItems: any[]
  exchangeItems?: any[]
  notes?: string
}) {
  const supabase = await createServerClient()

  // Generar número de devolución
  const { data: returnNumber } = await supabase.rpc('generate_return_number')

  const { data, error } = await supabase
    .from('returns')
    .insert({
      sale_id: formData.saleId,
      sale_number: formData.saleNumber,
      client_id: formData.clientId,
      client_name: formData.clientName,
      store_id: formData.storeId,
      return_number: returnNumber,
      reason: formData.reason,
      reason_type: formData.reasonType,
      return_type: formData.returnType,
      total_amount: formData.totalAmount,
      returned_items: formData.returnedItems,
      exchange_items: formData.exchangeItems || [],
      notes: formData.notes,
      status: 'PENDIENTE'
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

  // Auth check
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }

  // ── 1. Fetch the full return record ──────────────────────────────────────
  const { data: ret, error: fetchErr } = await service
    .from('returns')
    .select('id, return_type, total_amount, client_id, store_id, sale_id, sale_number, return_number')
    .eq('id', returnId)
    .single()

  if (fetchErr || !ret) {
    return { success: false, error: fetchErr?.message || 'Devolución no encontrada' }
  }

  const returnAmount = Number(ret.total_amount)

  // ── 2. Mark approved ─────────────────────────────────────────────────────
  const { data, error } = await service
    .from('returns')
    .update({ status: 'APROBADA', approved_at: new Date().toISOString() })
    .eq('id', returnId)
    .select()
    .single()

  if (error) {
    console.error('Error approving return:', error)
    return { success: false, error: error.message }
  }

  // ── 3. Cash effect (REEMBOLSO → egreso en caja) ──────────────────────────
  if (ret.return_type === 'REEMBOLSO' && returnAmount > 0) {
    try {
      // Find the open cash shift for the store
      const { data: shift } = await service
        .from('cash_shifts')
        .select('id')
        .eq('store_id', ret.store_id)
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      await service.from('cash_expenses').insert({
        shift_id:    shift?.id ?? null,
        amount:      returnAmount,
        category:    'DEVOLUCION',
        description: `Reembolso devolución ${ret.return_number} — venta ${ret.sale_number}`,
        user_id:     user.id,
      })
    } catch (cashErr) {
      // Non-blocking: log but don't fail the approval
      console.warn('[approveReturn] Could not register cash expense:', cashErr)
    }
  }

  // ── 4. Credit restoration (if sale was on credit) ────────────────────────
  if (ret.client_id && ret.sale_id && returnAmount > 0) {
    try {
      // Check if the original sale had a credit plan
      const { data: creditPlan } = await service
        .from('credit_plans')
        .select('id, total_amount')
        .eq('sale_id', ret.sale_id)
        .maybeSingle()

      if (creditPlan) {
        // Reduce credit_used by return amount (floor at 0)
        const { data: client } = await service
          .from('clients')
          .select('credit_used')
          .eq('id', ret.client_id)
          .single()

        if (client) {
          const newCreditUsed = Math.max(0, Number(client.credit_used) - returnAmount)
          await service
            .from('clients')
            .update({ credit_used: newCreditUsed })
            .eq('id', ret.client_id)
        }
      }
    } catch (creditErr) {
      // Non-blocking: log but don't fail the approval
      console.warn('[approveReturn] Could not restore credit:', creditErr)
    }
  }

  revalidatePath('/returns')
  revalidatePath('/cash')
  revalidatePath('/clients')
  return { success: true, data }
}

export async function rejectReturnAction(returnId: string, adminNotes: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('returns')
    .update({
      status: 'RECHAZADA',
      admin_notes: adminNotes
    })
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
  const supabase = await createServerClient()
  const service  = createServiceClient()

  // Fetch the return to get returned_items for stock restoration
  const { data: returnRecord, error: fetchError } = await service
    .from('returns')
    .select('returned_items, store_id, return_type, total_amount, client_id, sale_id, return_number, sale_number, status')
    .eq('id', returnId)
    .single()

  if (fetchError) {
    console.error('Error fetching return for completion:', fetchError)
    return { success: false, error: fetchError.message }
  }

  const { data, error } = await service
    .from('returns')
    .update({
      status: 'COMPLETADA',
      refund_amount: refundAmount || 0
    })
    .eq('id', returnId)
    .select()
    .single()

  if (error) {
    console.error('Error completing return:', error)
    return { success: false, error: error.message }
  }

  // ── Restore stock for each returned item ─────────────────────────────────
  const returnedItems: Array<{ product_id?: string; quantity?: number }> =
    Array.isArray(returnRecord?.returned_items) ? returnRecord.returned_items : []

  for (const item of returnedItems) {
    if (!item.product_id || !item.quantity || item.quantity <= 0) continue
    const { error: stockError } = await service.rpc('increment_stock', {
      p_product_id: item.product_id,
      p_quantity: item.quantity,
    })
    if (stockError) {
      console.warn('[returns] increment_stock RPC failed, trying direct update:', stockError.message)
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

  // ── Cash effect if not already processed at approval ─────────────────────
  // (only if status was PENDIENTE → directly completed without APROBADA step)
  if (
    returnRecord?.status === 'PENDIENTE' &&
    returnRecord?.return_type === 'REEMBOLSO'
  ) {
    const amt = Number(refundAmount || returnRecord?.total_amount || 0)
    if (amt > 0) {
      try {
        const { data: shift } = await service
          .from('cash_shifts')
          .select('id')
          .eq('store_id', returnRecord.store_id)
          .eq('status', 'OPEN')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        await service.from('cash_expenses').insert({
          shift_id:    shift?.id ?? null,
          amount:      amt,
          category:    'DEVOLUCION',
          description: `Reembolso devolución ${returnRecord.return_number} — venta ${returnRecord.sale_number}`,
          user_id:     null,
        })
      } catch (e) {
        console.warn('[completeReturn] Could not register cash expense:', e)
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
    .update({
      extension_requested: true,
      extension_reason: extensionReason
    })
    .eq('id', returnId)
    .select()
    .single()

  if (error) {
    console.error('Error requesting extension:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/returns')
  return { success: true, data }
}

export async function grantExtensionAction(returnId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('returns')
    .update({
      extension_granted: true,
      extension_date: new Date().toISOString()
    })
    .eq('id', returnId)
    .select()
    .single()

  if (error) {
    console.error('Error granting extension:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/returns')
  return { success: true, data }
}

export async function checkReturnEligibilityAction(saleId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase.rpc('check_return_eligibility', {
    p_sale_id: saleId
  })

  if (error) {
    console.error('Error checking eligibility:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}
