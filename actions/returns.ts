'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { checkAnyPermission } from '@/lib/auth/check-permission'
import { Permission } from '@/lib/auth/permissions'

const STORE_DISPLAY: Record<string, string> = {
  MUJERES: 'Tienda Mujeres',
  HOMBRES: 'Tienda Hombres',
}

async function enrichReturnedItems(service: ReturnType<typeof createServiceClient>, returns: any[]) {
  const productIds = Array.from(new Set(
    returns.flatMap(ret => Array.isArray(ret.returned_items)
      ? ret.returned_items.map((item: any) => item?.product_id).filter(Boolean)
      : []
    )
  ))

  if (productIds.length === 0) return returns

  const { data: products, error } = await service
    .from('products')
    .select('id, name, barcode, base_name, base_code, size, color, purchase_price, price')
    .in('id', productIds)

  if (error) {
    console.error('Error enriching returned products:', error)
    return returns
  }

  const productsById = new Map((products || []).map((product: any) => [product.id, product]))

  return returns.map((ret: any) => ({
    ...ret,
    returned_items: Array.isArray(ret.returned_items)
      ? ret.returned_items.map((item: any) => {
        const product = item?.product_id ? productsById.get(item.product_id) : null
        const returnedAt = item?.returned_at || ret.return_date || ret.created_at || null

        if (!product) {
          return { ...item, returned_at: returnedAt }
        }

        return {
          ...item,
          product_name: item.product_name || product.base_name || product.name || null,
          product_barcode: item.product_barcode || product.barcode || null,
          base_name: item.base_name || product.base_name || null,
          base_code: item.base_code || product.base_code || null,
          size: item.size || product.size || null,
          color: item.color || product.color || null,
          purchase_price: item.purchase_price ?? product.purchase_price ?? null,
          catalog_price: item.catalog_price ?? product.price ?? null,
          returned_at: returnedAt,
        }
      })
      : ret.returned_items,
  }))
}

function summarizeReturnedItemsForAudit(items: any[]) {
  const safeItems = Array.isArray(items) ? items : []
  const parts = safeItems
    .filter((item) => item?.product_id && Number(item?.quantity) > 0)
    .map((item) => {
      const label =
        item.product_name ||
        item.base_name ||
        item.product_barcode ||
        (item.product_id ? `ID ${String(item.product_id).slice(0, 8)}` : 'Producto')
      return `${Number(item.quantity)} x ${label}`
    })

  return parts.length > 0 ? parts.join(', ') : 'sin productos'
}

async function getReturnSaleType(
  service: ReturnType<typeof createServiceClient>,
  saleId: string | null | undefined
): Promise<'CONTADO' | 'CREDITO'> {
  if (!saleId) return 'CONTADO'

  const { data: sale } = await service
    .from('sales')
    .select('sale_type')
    .eq('id', saleId)
    .maybeSingle()

  return sale?.sale_type === 'CREDITO' ? 'CREDITO' : 'CONTADO'
}

function normalizeQty(value: unknown) {
  const qty = Number(value)
  return Number.isFinite(qty) ? qty : 0
}

async function validateAndNormalizeReturnItems(
  service: ReturnType<typeof createServiceClient>,
  formData: {
    saleId: string
    totalAmount: number
    returnedItems: any[]
  }
): Promise<{ success: true; returnedItems: any[]; totalAmount: number } | { success: false; error: string }> {
  const requestedItems = Array.isArray(formData.returnedItems) ? formData.returnedItems : []
  if (requestedItems.length === 0) {
    return { success: false, error: 'Selecciona al menos un producto para la devolución' }
  }

  const { data: saleItems, error: saleItemsError } = await service
    .from('sale_items')
    .select('id, sale_id, product_id, quantity, unit_price, subtotal, products(id, name, barcode, base_name, base_code, size, color, purchase_price, price)')
    .eq('sale_id', formData.saleId)

  if (saleItemsError) {
    return { success: false, error: `No se pudo validar la venta: ${saleItemsError.message}` }
  }

  const saleItemById = new Map((saleItems || []).map((item: any) => [item.id, item]))
  const saleItemIds = requestedItems
    .map((item: any) => item?.sale_item_id)
    .filter(Boolean)

  if (saleItemIds.length !== requestedItems.length) {
    return { success: false, error: 'Cada producto devuelto debe estar asociado a una línea de venta' }
  }

  const { data: existingReturns, error: existingError } = await service
    .from('returns')
    .select('id, return_number, status, returned_items')
    .eq('sale_id', formData.saleId)
    .in('status', ['PENDIENTE', 'APROBADA', 'COMPLETADA'])

  if (existingError) {
    return { success: false, error: `No se pudo validar devoluciones existentes: ${existingError.message}` }
  }

  const alreadyReturned = new Map<string, number>()
  for (const ret of existingReturns || []) {
    const items = Array.isArray(ret.returned_items) ? ret.returned_items : []
    for (const item of items) {
      const saleItemId = item?.sale_item_id
      if (!saleItemId) continue
      alreadyReturned.set(saleItemId, (alreadyReturned.get(saleItemId) || 0) + normalizeQty(item.quantity))
    }
  }

  const requestedBySaleItem = new Map<string, number>()
  for (const item of requestedItems) {
    const saleItemId = item.sale_item_id
    const qty = normalizeQty(item.quantity)
    if (!saleItemById.has(saleItemId)) {
      return { success: false, error: 'Uno de los productos no pertenece a la venta seleccionada' }
    }
    if (qty <= 0) {
      return { success: false, error: 'La cantidad a devolver debe ser mayor que cero' }
    }
    requestedBySaleItem.set(saleItemId, (requestedBySaleItem.get(saleItemId) || 0) + qty)
  }

  for (const [saleItemId, requestedQty] of requestedBySaleItem.entries()) {
    const saleItem = saleItemById.get(saleItemId)
    const soldQty = normalizeQty(saleItem.quantity)
    const previousQty = alreadyReturned.get(saleItemId) || 0
    if (previousQty + requestedQty > soldQty + 0.0001) {
      const productName = saleItem.products?.base_name || saleItem.products?.name || 'Producto'
      return {
        success: false,
        error: `${productName}: vendido ${soldQty}, ya devuelto ${previousQty}, nuevo ${requestedQty}. No se puede devolver más de lo vendido.`,
      }
    }
  }

  const normalizedItems = requestedItems.map((item: any) => {
    const saleItem = saleItemById.get(item.sale_item_id)
    const product = saleItem.products
    const qty = normalizeQty(item.quantity)
    const unitPrice = Number(saleItem.unit_price)
    const requestedSubtotal = Number(item.subtotal ?? item.refund_subtotal ?? unitPrice * qty)
    return {
      ...item,
      sale_item_id: saleItem.id,
      product_id: saleItem.product_id,
      product_name: product?.base_name || product?.name || item.product_name || 'Producto',
      product_barcode: product?.barcode || item.product_barcode || null,
      base_name: product?.base_name || item.base_name || null,
      base_code: product?.base_code || item.base_code || null,
      size: product?.size || item.size || null,
      color: product?.color || item.color || null,
      purchase_price: product?.purchase_price ?? item.purchase_price ?? null,
      catalog_price: product?.price ?? item.catalog_price ?? null,
      quantity: qty,
      unit_price: unitPrice,
      original_subtotal: Math.round(unitPrice * qty * 100) / 100,
      subtotal: Math.round(requestedSubtotal * 100) / 100,
      refund_subtotal: Math.round(requestedSubtotal * 100) / 100,
    }
  })

  const normalizedTotal = Math.round(normalizedItems.reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0) * 100) / 100
  const clientTotal = Math.round(Number(formData.totalAmount || 0) * 100) / 100

  if (!Number.isFinite(clientTotal) || clientTotal <= 0) {
    return { success: false, error: 'El monto de devolución debe ser mayor que cero' }
  }

  if (Math.abs(clientTotal - normalizedTotal) > 0.05) {
    return {
      success: false,
      error: `El monto enviado no coincide con el detalle de productos. Detalle: S/ ${normalizedTotal.toFixed(2)}, recibido: S/ ${clientTotal.toFixed(2)}.`,
    }
  }

  return { success: true, returnedItems: normalizedItems, totalAmount: normalizedTotal }
}

async function ensureCashRefundExpenseForReturn(
  service: ReturnType<typeof createServiceClient>,
  params: {
    returnNumber: string
    saleNumber: string | null
    storeId: string
    amount: number
    userId: string
  }
): Promise<{ success: true; cashExpenseId: string; reused: boolean } | { success: false; error: string }> {
  const { data: existingExpenses, error: existingError } = await service
    .from('cash_expenses')
    .select('id, shift_id')
    .eq('category', 'DEVOLUCION')
    .ilike('description', `%${params.returnNumber}%`)
    .order('created_at', { ascending: false })

  if (existingError) {
    return { success: false, error: `No se pudo validar el egreso de caja: ${existingError.message}` }
  }

  const linkedExpense = (existingExpenses || []).find((expense: any) => expense.shift_id)
  if (linkedExpense) {
    return { success: true, cashExpenseId: linkedExpense.id, reused: true }
  }

  const { data: shift, error: shiftError } = await service
    .from('cash_shifts')
    .select('id')
    .eq('store_id', params.storeId)
    .eq('status', 'OPEN')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (shiftError) {
    return { success: false, error: `No se pudo validar la caja abierta: ${shiftError.message}` }
  }
  if (!shift) {
    return {
      success: false,
      error: `No hay caja abierta en ${params.storeId}. Abre la caja antes de completar este reembolso en efectivo.`,
    }
  }

  const description = `Reembolso devolucion ${params.returnNumber}${params.saleNumber ? ` - venta ${params.saleNumber}` : ''}`
  const unlinkedExpense = (existingExpenses || [])[0]

  if (unlinkedExpense) {
    const { error: updateError } = await service
      .from('cash_expenses')
      .update({
        shift_id: shift.id,
        user_id: params.userId,
        amount: params.amount,
        description,
        created_at: new Date().toISOString(),
      })
      .eq('id', unlinkedExpense.id)

    if (updateError) {
      return { success: false, error: `No se pudo enlazar el egreso a la caja: ${updateError.message}` }
    }

    return { success: true, cashExpenseId: unlinkedExpense.id, reused: false }
  }

  const { data: insertedExpense, error: insertError } = await service
    .from('cash_expenses')
    .insert({
      shift_id: shift.id,
      amount: params.amount,
      category: 'DEVOLUCION',
      description,
      user_id: params.userId,
    })
    .select('id')
    .single()

  if (insertError) {
    return { success: false, error: `No se pudo registrar el egreso en caja: ${insertError.message}` }
  }

  return { success: true, cashExpenseId: insertedExpense.id, reused: false }
}

async function adjustCreditForCompletedReturnFallback(
  service: ReturnType<typeof createServiceClient>,
  saleId: string,
  returnAmount: number
) {
  const { data: creditPlan } = await service
    .from('credit_plans')
    .select('id, client_id, total_amount')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!creditPlan || returnAmount <= 0) return { refundDue: 0, planId: null }

  const { data: payments } = await service
    .from('payments')
    .select('amount')
    .eq('plan_id', creditPlan.id)

  const paidTotal = (payments || []).reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0)
  let remainingReturn = returnAmount

  const { data: installments } = await service
    .from('installments')
    .select('id, amount, paid_amount, status, installment_number')
    .eq('plan_id', creditPlan.id)
    .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
    .order('installment_number', { ascending: false })

  for (const installment of installments || []) {
    if (remainingReturn <= 0.005) break
    const amount = Number(installment.amount || 0)
    const paid = Number(installment.paid_amount || 0)
    const outstanding = Math.max(0, amount - paid)

    if (remainingReturn >= outstanding - 0.005) {
      remainingReturn -= outstanding
      if (paid > 0) {
        await service
          .from('installments')
          .update({ amount: paid, status: 'PAID', paid_at: new Date().toISOString() })
          .eq('id', installment.id)
      } else {
        await service
          .from('installments')
          .update({ amount: 0, paid_amount: 0, status: 'VOIDED', paid_at: null })
          .eq('id', installment.id)
      }
    } else {
      const newAmount = Math.round((amount - remainingReturn) * 100) / 100
      await service
        .from('installments')
        .update({
          amount: newAmount,
          status: paid >= newAmount - 0.005 ? 'PAID' : paid > 0 ? 'PARTIAL' : installment.status,
          ...(paid >= newAmount - 0.005 ? { paid_at: new Date().toISOString() } : {}),
        })
        .eq('id', installment.id)
      remainingReturn = 0
    }
  }

  const { data: allInstallments } = await service
    .from('installments')
    .select('amount, status')
    .eq('plan_id', creditPlan.id)

  const newPlanTotal = Math.round((allInstallments || [])
    .filter((installment: any) => installment.status !== 'VOIDED')
    .reduce((sum: number, installment: any) => sum + Number(installment.amount || 0), 0) * 100) / 100
  const hasOpenInstallments = (allInstallments || []).some((installment: any) =>
    ['PENDING', 'PARTIAL', 'OVERDUE'].includes(installment.status)
  )

  await service
    .from('credit_plans')
    .update({
      total_amount: newPlanTotal,
      status: newPlanTotal <= 0.005 ? 'CANCELLED' : hasOpenInstallments ? 'ACTIVE' : 'COMPLETED',
    })
    .eq('id', creditPlan.id)

  await service.rpc('recalculate_client_credit_used', { p_client_id: creditPlan.client_id })
    .then(({ error }: any) => {
      if (error) console.warn('[returns] recalculate_client_credit_used:', error.message)
    })

  return {
    planId: creditPlan.id,
    newPlanTotal,
    paidTotal,
    refundDue: Math.max(0, Math.round((paidTotal - newPlanTotal) * 100) / 100),
  }
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
  const enriched = await enrichReturnedItems(service, data || [])
  return { success: true, data: enriched }
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
  const service = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }

  const canCreateReturn = await checkAnyPermission([Permission.CREATE_SALE, Permission.MANAGE_CASH, Permission.MANAGE_USERS])
  if (!canCreateReturn) return { success: false, error: 'No tienes permisos para registrar devoluciones' }

  const validatedReturn = await validateAndNormalizeReturnItems(service, formData)
  if (!validatedReturn.success) return validatedReturn

  const { data: returnNumber } = await supabase.rpc('generate_return_number')

  const { data, error } = await service
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
      total_amount:   validatedReturn.totalAmount,
      returned_items: validatedReturn.returnedItems,
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

  await logAudit({
    userId: user.id,
    action: 'CREATE',
    entityType: 'return',
    entityId: data.id,
    entityName: data.return_number,
      detail: `Devolucion creada para venta ${formData.saleNumber}. Productos: ${summarizeReturnedItemsForAudit(validatedReturn.returnedItems)}.`,
    store: formData.storeId,
    oldValues: null,
    newValues: {
      status: 'PENDIENTE',
      sale_number: formData.saleNumber,
      total_amount: validatedReturn.totalAmount,
      returned_items: validatedReturn.returnedItems,
    },
  })

  revalidatePath('/returns')
  revalidatePath('/admin/logs')
  return { success: true, data }
}

export async function approveReturnAction(returnId: string) {
  const authClient = await createServerClient()
  const service    = createServiceClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }
  const canApproveReturn = await checkAnyPermission([Permission.MANAGE_CASH, Permission.MANAGE_USERS])
  if (!canApproveReturn) return { success: false, error: 'No tienes permisos para aprobar devoluciones' }

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
  const saleType = await getReturnSaleType(service, ret.sale_id)

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

  // El egreso de caja para CONTADO se registra al completar la devolucion,
  // junto con el ingreso de stock.

  // ── 5b. CREDITO → Ajustar plan, cuotas y restaurar crédito ──────────────
  // Legacy path disabled by default: credit/cash/stock adjustments now belong to completion.
  if (process.env.NEXT_PUBLIC_ENABLE_LEGACY_APPROVE_RETURN_CREDIT === 'true' && saleType === 'CREDITO' && ret.client_id && ret.sale_id) {
    try {
      const { data: creditPlan } = await service
        .from('credit_plans')
        .select('id, total_amount, status')
        .eq('sale_id', ret.sale_id)
        .maybeSingle()

      if (creditPlan) {
        // Obtener cuotas PENDIENTES / VENCIDAS
        const { data: pendingInstallments } = await service
          .from('installments')
          .select('id, amount, installment_number, due_date')
          .eq('plan_id', creditPlan.id)
          .in('status', ['PENDING', 'OVERDUE'])
          .order('installment_number', { ascending: true })

        const pendingList  = pendingInstallments ?? []
        const totalPending = pendingList.reduce((s, i) => s + Number(i.amount), 0)

        // ¿Devolución cubre todo lo pendiente? → cancelar plan
        const isFullReturn = returnAmount >= totalPending - 0.01

        if (isFullReturn || totalPending === 0) {
          // Cancelar plan completo
          await service
            .from('credit_plans')
            .update({ status: 'CANCELLED' })
            .eq('id', creditPlan.id)

          if (pendingList.length > 0) {
            await service
              .from('installments')
              .delete()
              .eq('plan_id', creditPlan.id)
              .in('status', ['PENDING', 'OVERDUE'])
          }

          // Restaurar el monto total pendiente (no planAmount completo)
          const { data: client } = await service
            .from('clients').select('credit_used').eq('id', ret.client_id).single()

          if (client) {
            const toRestore    = isFullReturn ? totalPending : returnAmount
            const newCreditUsed = Math.max(0, Number(client.credit_used) - toRestore)
            await service
              .from('clients')
              .update({ credit_used: newCreditUsed })
              .eq('id', ret.client_id)
          }
        } else {
          // ── Devolución parcial ─────────────────────────────────────────────
          // 1. Reducir cuotas desde la última hacia atrás
          let toReturn = returnAmount
          const toDelete: string[] = []
          let toUpdateId: string | null = null
          let toUpdateAmount = 0

          for (let i = pendingList.length - 1; i >= 0 && toReturn > 0.005; i--) {
            const inst     = pendingList[i]
            const instAmt  = Number(inst.amount)
            if (toReturn >= instAmt - 0.005) {
              toDelete.push(inst.id)
              toReturn -= instAmt
            } else {
              toUpdateId     = inst.id
              toUpdateAmount = Math.round((instAmt - toReturn) * 100) / 100
              toReturn = 0
            }
          }

          if (toDelete.length > 0) {
            await service.from('installments').delete().in('id', toDelete)
          }
          if (toUpdateId) {
            await service
              .from('installments')
              .update({ amount: toUpdateAmount })
              .eq('id', toUpdateId)
          }

          // 2. Actualizar total del plan
          const newPlanTotal = Math.round(Math.max(0, Number(creditPlan.total_amount) - returnAmount) * 100) / 100
          await service
            .from('credit_plans')
            .update({ status: 'ACTIVE', total_amount: newPlanTotal })
            .eq('id', creditPlan.id)

          // 3. Restaurar credit_used solo por el monto devuelto
          const { data: client } = await service
            .from('clients').select('credit_used').eq('id', ret.client_id).single()

          if (client) {
            const newCreditUsed = Math.max(0, Number(client.credit_used) - returnAmount)
            await service
              .from('clients')
              .update({ credit_used: newCreditUsed })
              .eq('id', ret.client_id)
          }
        }
      }
    } catch (creditErr) {
      console.error('[approveReturn] Credit plan update failed:', creditErr)
    }
  }

  await logAudit({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'return',
    entityId: returnId,
    entityName: ret.return_number,
    detail: `Devolucion aprobada para venta ${ret.sale_number}. Tipo ${saleType}. Monto S/ ${returnAmount.toFixed(2)}.`,
    store: ret.store_id,
    oldValues: { status: ret.status },
    newValues: { status: 'APROBADA', sale_type: saleType, total_amount: returnAmount },
  })

  revalidatePath('/returns')
  revalidatePath('/cash')
  revalidatePath('/clients')
  revalidatePath('/debt')
  revalidatePath('/collections')
  revalidatePath('/admin/logs')
  return { success: true, data, saleType }
}

export async function rejectReturnAction(returnId: string, adminNotes: string) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }

  const { data: previous } = await supabase
    .from('returns')
    .select('id, return_number, sale_number, status, store_id')
    .eq('id', returnId)
    .maybeSingle()

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

  await logAudit({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'return',
    entityId: returnId,
    entityName: previous?.return_number || data.return_number,
    detail: `Devolucion rechazada${previous?.sale_number ? ` para venta ${previous.sale_number}` : ''}. ${adminNotes || 'Sin notas adicionales.'}`,
    store: previous?.store_id || data.store_id,
    oldValues: { status: previous?.status || null },
    newValues: { status: 'RECHAZADA', admin_notes: adminNotes },
  })

  revalidatePath('/returns')
  revalidatePath('/admin/logs')
  return { success: true, data }
}

export async function completeReturnAction(returnId: string, refundAmount?: number) {
  const authClient = await createServerClient()
  const service = createServiceClient()

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { success: false, error: 'No autorizado' }
  const canCompleteReturn = await checkAnyPermission([Permission.MANAGE_CASH, Permission.MANAGE_USERS])
  if (!canCompleteReturn) return { success: false, error: 'No tienes permisos para completar devoluciones' }

  const atomicResult = await service.rpc('complete_return_atomic', {
    p_return_id: returnId,
    p_user_id: user.id,
    p_refund_amount: refundAmount ?? null,
  })

  if (!atomicResult.error) {
    revalidatePath('/returns')
    revalidatePath('/inventory/stock')
    revalidatePath('/inventory/movements')
    revalidatePath('/admin/logs')
    revalidatePath('/reports')
    revalidatePath('/cash')
    revalidatePath('/clients')
    revalidatePath('/debt')
    return {
      success: true,
      data: atomicResult.data,
      saleType: (atomicResult.data as any)?.sale_type,
      cashRefundExpenseId: (atomicResult.data as any)?.cash_expense_id ?? null,
      cashRefundReused: false,
    }
  }

  const missingAtomicRpc = ['42883', 'PGRST202'].includes(String((atomicResult.error as any).code))
    || String(atomicResult.error.message || '').includes('complete_return_atomic')
  if (!missingAtomicRpc) {
    return { success: false, error: atomicResult.error.message }
  }

  const { data: returnRecord, error: fetchError } = await service
    .from('returns')
    .select('id, returned_items, store_id, return_type, total_amount, client_id, sale_id, return_number, sale_number, status')
    .eq('id', returnId)
    .single()

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }
  if (returnRecord.status !== 'APROBADA') {
    return { success: false, error: `Solo se pueden completar devoluciones en estado APROBADA (actual: ${returnRecord.status})` }
  }

  const saleType = await getReturnSaleType(service, returnRecord.sale_id)
  const finalRefundAmount = refundAmount ?? Number(returnRecord.total_amount)
  let cashRefundExpenseId: string | null = null
  let cashRefundReused = false

  if (saleType === 'CONTADO' && finalRefundAmount > 0) {
    const cashRefund = await ensureCashRefundExpenseForReturn(service, {
      returnNumber: returnRecord.return_number,
      saleNumber: returnRecord.sale_number,
      storeId: returnRecord.store_id,
      amount: finalRefundAmount,
      userId: user.id,
    })

    if (!cashRefund.success) {
      return { success: false, error: cashRefund.error }
    }

    cashRefundExpenseId = cashRefund.cashExpenseId
    cashRefundReused = cashRefund.reused
  }

  const [enrichedReturnRecord] = await enrichReturnedItems(service, [returnRecord])

  // ── Restaurar stock ───────────────────────────────────────────────────────
  const returnedItems: Array<{ product_id?: string; quantity?: number; product_name?: string; base_name?: string; product_barcode?: string }> =
    Array.isArray(enrichedReturnRecord?.returned_items) ? enrichedReturnRecord.returned_items : []
  const warehouseId = returnRecord.store_id
  const restoredItems: typeof returnedItems = []

  for (const item of returnedItems) {
    const quantity = Number(item.quantity)
    if (!item.product_id || !quantity || quantity <= 0) continue
    const movementReference = `DevoluciÃ³n ${returnRecord.return_number}`
    const canonicalMovementReference = `Devolucion ${returnRecord.return_number}`
    const legacyMovementReference = `Devoluci\u00f3n ${returnRecord.return_number}`
    const { data: existingMovement, error: existingMovementError } = await service
      .from('movements')
      .select('id')
      .eq('warehouse_id', warehouseId)
      .eq('product_id', item.product_id)
      .eq('type', 'ENTRADA')
      .in('reference', [movementReference, canonicalMovementReference, legacyMovementReference])
      .maybeSingle()

    if (existingMovementError) {
      return { success: false, error: `No se pudo validar movimiento existente: ${existingMovementError.message}` }
    }

    if (existingMovement) {
      restoredItems.push({ ...item, quantity })
      continue
    }

    const { error: stockError } = await service.rpc('increment_stock', {
      p_warehouse_id: warehouseId,
      p_product_id: item.product_id,
      p_quantity: quantity,
    })
    if (stockError) {
      // Fallback: direct UPDATE
      const { data: existing } = await service
        .from('stock')
        .select('quantity')
        .eq('warehouse_id', warehouseId)
        .eq('product_id', item.product_id)
        .maybeSingle()
      if (existing) {
        const { error: updateStockError } = await service
          .from('stock')
          .update({ quantity: (existing.quantity ?? 0) + quantity })
          .eq('warehouse_id', warehouseId)
          .eq('product_id', item.product_id)
        if (updateStockError) {
          return { success: false, error: `No se pudo restaurar stock: ${updateStockError.message}` }
        }
      } else {
        const { error: insertStockError } = await service
          .from('stock')
          .insert({
            warehouse_id: warehouseId,
            product_id: item.product_id,
            quantity,
          })
        if (insertStockError) {
          return { success: false, error: `No se pudo crear stock restaurado: ${insertStockError.message}` }
        }
      }
    }

    const { error: movementError } = await service.from('movements').insert({
      warehouse_id: warehouseId,
      product_id: item.product_id,
      type: 'ENTRADA',
      quantity,
      reference: canonicalMovementReference,
      notes: `Ingreso por devolucion completada de venta ${returnRecord.sale_number}`,
      user_id: user.id,
    })

    if (movementError) {
      return { success: false, error: `Stock restaurado, pero falló el movimiento: ${movementError.message}` }
    }

    restoredItems.push({ ...item, quantity })
  }

  if (saleType === 'CREDITO' && returnRecord.sale_id) {
    const creditAdjustment = await adjustCreditForCompletedReturnFallback(service, returnRecord.sale_id, finalRefundAmount)
    if (!creditAdjustment.success) {
      return { success: false, error: creditAdjustment.error }
    }

    const refundDue = Math.min(finalRefundAmount, Number(creditAdjustment.refundDue || 0))
    if (refundDue > 0.005) {
      const cashRefund = await ensureCashRefundExpenseForReturn(service, {
        returnNumber: returnRecord.return_number,
        saleNumber: returnRecord.sale_number,
        storeId: returnRecord.store_id,
        amount: Math.round(refundDue * 100) / 100,
        userId: user.id,
      })

      if (!cashRefund.success) {
        return { success: false, error: cashRefund.error }
      }

      cashRefundExpenseId = cashRefund.cashExpenseId
      cashRefundReused = cashRefund.reused
    }
  }

  const { data, error } = await service
    .from('returns')
    .update({ status: 'COMPLETADA', refund_amount: finalRefundAmount })
    .eq('id', returnId)
    .eq('status', 'APROBADA')
    .select()
    .single()

  if (error) {
    console.error('Error completing return:', error)
    return { success: false, error: error.message }
  }

  await logAudit({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'return',
    entityId: returnId,
    entityName: returnRecord.return_number,
    detail: saleType === 'CONTADO'
      ? `Devolucion completada. Egreso de caja e ingreso de stock registrados: ${summarizeReturnedItemsForAudit(restoredItems)}.`
      : `Devolucion completada. Ingreso de stock registrado: ${summarizeReturnedItemsForAudit(restoredItems)}.`,
    store: warehouseId,
    oldValues: { status: returnRecord.status },
    newValues: {
      status: 'COMPLETADA',
      sale_type: saleType,
      refund_amount: finalRefundAmount,
      cash_expense_id: cashRefundExpenseId,
      stock_restored: restoredItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        product_name: item.product_name || item.base_name || null,
      })),
    },
  })

  revalidatePath('/returns')
  revalidatePath('/inventory/stock')
  revalidatePath('/inventory/movements')
  revalidatePath('/admin/logs')
  revalidatePath('/reports')
  revalidatePath('/cash')
  revalidatePath('/clients')
  revalidatePath('/debt')
  return { success: true, data, saleType, cashRefundExpenseId, cashRefundReused }
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
