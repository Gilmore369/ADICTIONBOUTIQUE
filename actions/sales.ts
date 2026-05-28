/**
 * Sales Server Actions
 * 
 * Server actions for POS sale operations including:
 * - Sale creation with stock validation
 * - Credit limit verification
 * - Atomic transaction handling
 * 
 * Requirements: 5.2, 5.3, 5.4, 5.8
 */

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { checkPermission } from '@/lib/auth/check-permission'
import { Permission } from '@/lib/auth/permissions'
import { saleSchema, saleItemSchema } from '@/lib/validations/sales'
import type { SaleItem } from '@/lib/validations/sales'
import { logSaleCreated } from '@/lib/utils/audit'

/**
 * Standard response type for server actions
 */
type ActionResponse<T = any> = {
  success: boolean
  data?: T
  error?: string | Record<string, string[]>
}

/**
 * Creates a new sale with atomic transaction handling
 * 
 * Process:
 * 1. Validate input with saleSchema
 * 2. Check CREATE_SALE permission
 * 3. For CREDITO sales: verify credit limit not exceeded
 * 4. Check stock availability for all items
 * 5. Call create_sale_transaction database function (atomic)
 * 6. Handle errors and rollback
 * 7. Revalidate paths
 * 
 * Requirements: 5.2, 5.3, 5.4, 5.8
 * 
 * @param formData - Form data containing sale information
 * @returns ActionResponse with created sale ID or error
 */
export async function createSale(formData: FormData): Promise<ActionResponse> {
  // 1. Check permission
  const hasPermission = await checkPermission(Permission.CREATE_SALE)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Get authenticated user
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized: User not authenticated' }
  }

  // 2. Parse and validate input
  const itemsRaw = formData.get('items')
  let items: SaleItem[]
  
  try {
    items = JSON.parse(itemsRaw as string)
  } catch (error) {
    return { success: false, error: 'Invalid items format' }
  }

  const discount = formData.get('discount')
  const installments = formData.get('installments')
  
  // Debug: Check if client_id has multiple values
  const clientIdAll = formData.getAll('client_id')
  console.log('[createSale] client_id debug:', {
    get: formData.get('client_id'),
    getAll: clientIdAll,
    length: clientIdAll.length
  })
  
  // Use first value if multiple exist (shouldn't happen, but defensive)
  const clientId = clientIdAll.length > 0 ? clientIdAll[0] : null

  // Debug log
  console.log('[createSale] FormData values:', {
    store_id: formData.get('store_id'),
    client_id: clientId,
    client_id_type: typeof clientId,
    sale_type: formData.get('sale_type'),
    discount,
    installments
  })

  const validated = saleSchema.safeParse({
    store_id: formData.get('store_id'),
    client_id: clientId || undefined,
    sale_type: formData.get('sale_type'),
    items,
    discount: discount ? Number(discount) : 0,
    installments: installments ? Number(installments) : undefined
  })

  if (!validated.success) {
    console.error('[createSale] Validation error:', JSON.stringify(validated.error.flatten()))
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  const { store_id, client_id, sale_type, items: saleItems, discount: saleDiscount, installments: saleInstallments } = validated.data

  // 3. Calculate totals
  const subtotal = saleItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  const total = subtotal - saleDiscount

  // 3b. CAJA ABIERTA — TODA venta (CONTADO y CRÉDITO) requiere un turno de caja
  // ABIERTO en esta tienda. Antes solo CONTADO; ahora también CRÉDITO para que
  // toda operación quede dentro de un turno con trazabilidad (decisión usuario
  // 2026-05-28: "que no permita hacer el proceso si no hay caja abierta").
  // El frontend POS ya deshabilita el botón; esto cierra el hueco vía API directa.
  {
    const { data: openShift, error: shiftError } = await supabase
      .from('cash_shifts')
      .select('id')
      .eq('store_id', store_id)
      .eq('status', 'OPEN')
      .limit(1)
      .maybeSingle()

    if (shiftError) {
      return { success: false, error: `Error verificando turno de caja: ${shiftError.message}` }
    }
    if (!openShift) {
      // Código especial que el frontend detecta para ofrecer abrir caja inline.
      return { success: false, error: `CAJA_CERRADA::${store_id}` }
    }
  }

  // 4. For CREDITO sales: verify credit limit not exceeded
  if (sale_type === 'CREDITO' && client_id) {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('credit_limit, credit_used')
      .eq('id', client_id)
      .single()

    if (clientError) {
      return { success: false, error: 'Client not found' }
    }

    if (!client) {
      return { success: false, error: 'Client not found' }
    }

    // Check credit limit (Requirement 5.4)
    if (client.credit_used + total > client.credit_limit) {
      return { 
        success: false, 
        error: `Credit limit exceeded. Available: ${(client.credit_limit - client.credit_used).toFixed(2)}, Required: ${total.toFixed(2)}` 
      }
    }
  }

  // 5. Check stock availability for all items — STRICT store isolation
  // Batch query: fetch stock for ALL products in ONE query (eliminates N+1)
  const productIds = saleItems.map(item => item.product_id)
  const { data: allStockRows, error: stockError } = await supabase
    .from('stock')
    .select('product_id, quantity, warehouse_id')
    .in('product_id', productIds)
    .ilike('warehouse_id', store_id)
    .gt('quantity', 0)

  if (stockError) {
    return { success: false, error: `Error verificando stock: ${stockError.message}` }
  }

  // Build map: product_id → available quantity in THIS store only
  const stockMap = new Map<string, number>()
  for (const row of allStockRows || []) {
    stockMap.set(row.product_id, (stockMap.get(row.product_id) || 0) + (row.quantity || 0))
  }

  // Validate each item has sufficient stock — NO cross-store fallback
  for (const item of saleItems) {
    const availableQty = stockMap.get(item.product_id) || 0
    if (availableQty < item.quantity) {
      return {
        success: false,
        error: `Stock insuficiente para producto ${item.product_id} en tienda ${store_id}. Disponible: ${availableQty}, Requerido: ${item.quantity}`
      }
    }
  }

  // 6. Generate correlative sale number using database function (V-0001, V-0002, etc.)
  const { data: saleNumber, error: saleNumberError } = await supabase
    .rpc('generate_sale_number')
  
  if (saleNumberError || !saleNumber) {
    console.error('Error generating sale number:', saleNumberError)
    return { success: false, error: 'Failed to generate sale number' }
  }

  // 7. Call create_sale_transaction database function (atomic operation)
  // This function handles:
  // - Sale creation
  // - Sale items insertion
  // - Stock decrement (atomic with FOR UPDATE lock)
  // - Credit plan creation (for CREDITO sales)
  // - Installments generation
  // - Credit_used increment
  // - Automatic rollback on any error (Requirement 5.8)
  try {
    const { data: saleId, error: saleError } = await supabase.rpc('create_sale_transaction', {
      p_sale_number: saleNumber,
      p_store_id: store_id,
      p_client_id: client_id || null,
      p_user_id: user.id,
      p_sale_type: sale_type,
      p_subtotal: subtotal,
      p_discount: saleDiscount,
      p_total: total,
      p_items: saleItems, // Supabase client will convert to JSONB
      p_installments: saleInstallments || null
    })

    if (saleError) {
      // Database function will rollback all changes on error
      return { 
        success: false, 
        error: `Transaction failed: ${saleError.message}` 
      }
    }

    // 8. Actualizar last_purchase_date del cliente (fire-and-forget)
    if (client_id) {
      supabase
        .from('clients')
        .update({ last_purchase_date: new Date().toISOString() })
        .eq('id', client_id)
        .then(() => {})
        .catch(() => {})
    }

    // 8b. Audit log (fire-and-forget)
    logSaleCreated(saleId, user.id, {
      sale_number: saleNumber,
      store_id,
      sale_type,
      total,
    }).catch(() => {})

    // 9. Revalidate paths to update UI
    revalidatePath('/pos')
    revalidatePath('/debt/plans')
    revalidatePath('/api/products/search', 'page')

    return {
      success: true,
      data: {
        sale_id: saleId,
        sale_number: saleNumber,
        total
      }
    }
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return {
      success: false,
      error: `Failed to create sale: ${errorMessage}`
    }
  }
}

/**
 * Anula una venta existente (sales.voided = true) y revierte sus efectos:
 *
 *  - Devuelve el stock al almacén original (sale_items → +quantity en stock).
 *  - Si era CREDITO, cancela el credit_plan, marca sus installments como
 *    VOIDED y recalcula `clients.credit_used` para liberar el cupo.
 *  - Marca void_reason, void_user_id, void_at.
 *  - Bloquea la doble anulación (voided=true → error).
 *
 * No es una transacción atómica nativa — Supabase JS no expone transactions.
 * Si una operación intermedia falla, devolvemos el error pero los efectos
 * parciales pueden quedar (mismo trade-off que approveReturnAction). En la
 * práctica el primer paso (verificar `voided=false`) actúa como gate; si
 * llega aquí, los siguientes pasos casi nunca fallan en producción real.
 *
 * Permisos: requiere VOID_SALE (admin-only por defecto en el RBAC actual).
 */
export async function voidSale(
  saleId: string,
  reason: string
): Promise<ActionResponse> {
  if (!saleId) return { success: false, error: 'sale_id requerido' }
  if (!reason || reason.trim().length < 3) {
    return { success: false, error: 'Debes indicar el motivo de la anulación (mín. 3 caracteres)' }
  }

  const allowed = await checkPermission(Permission.VOID_SALE)
  if (!allowed) {
    return { success: false, error: 'No tienes permisos para anular ventas' }
  }

  const authClient = await createServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Service client to bypass RLS — we need to update sale_items, stock,
  // installments and credit_plans atomically across tables.
  const supabase = createServiceClient()
  if (!supabase) {
    return { success: false, error: 'Servicio no disponible (SERVICE_ROLE_KEY no cargada)' }
  }

  // 1. Fetch sale + items
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select(`
      id, sale_number, store_id, client_id, sale_type, total, voided,
      sale_items(product_id, quantity)
    `)
    .eq('id', saleId)
    .maybeSingle()

  if (saleErr) return { success: false, error: `Error consultando venta: ${saleErr.message}` }
  if (!sale) return { success: false, error: 'Venta no encontrada' }
  if (sale.voided) return { success: false, error: 'La venta ya estaba anulada' }

  const items = (sale.sale_items as Array<{ product_id: string; quantity: number }>) || []

  // 2. Devolver stock — fallback manual si no hay RPC increment_stock
  for (const it of items) {
    // Try the RPC first; many envs don't have it, fall back to UPDATE.
    const { error: rpcErr } = await supabase.rpc('increment_stock', {
      p_warehouse_id: sale.store_id,
      p_product_id: it.product_id,
      p_quantity: it.quantity,
    })
    if (rpcErr && rpcErr.code !== '42883') {
      // Some other RPC error — try manual fallback anyway, but log.
      console.warn('[voidSale] increment_stock RPC failed, falling back to UPDATE:', rpcErr.message)
    }
    if (rpcErr) {
      // Manual fallback: read+update. Not concurrency-safe by itself but the
      // sale is already voided=false at this point so it's a one-shot path.
      const { data: row } = await supabase
        .from('stock')
        .select('quantity')
        .eq('product_id', it.product_id)
        .eq('warehouse_id', sale.store_id)
        .maybeSingle()
      const newQty = Number(row?.quantity || 0) + Number(it.quantity)
      const { error: upErr } = await supabase
        .from('stock')
        .upsert(
          { product_id: it.product_id, warehouse_id: sale.store_id, quantity: newQty },
          { onConflict: 'product_id,warehouse_id' }
        )
      if (upErr) {
        return { success: false, error: `Error devolviendo stock para ${it.product_id}: ${upErr.message}` }
      }
    }
  }

  // 3. Si CREDITO, cancelar plan + cuotas y recalcular credit_used
  if (sale.sale_type === 'CREDITO' && sale.client_id) {
    const { data: plan } = await supabase
      .from('credit_plans')
      .select('id')
      .eq('sale_id', sale.id)
      .maybeSingle()

    if (plan) {
      // Mark installments as VOIDED so reports/cobranzas dejan de mostrarlas
      const { error: instErr } = await supabase
        .from('installments')
        .update({ status: 'VOIDED' })
        .eq('plan_id', plan.id)
        .neq('status', 'PAID')
      if (instErr) console.warn('[voidSale] installments VOIDED update:', instErr.message)

      // Mark plan as CANCELLED (note: schema spells it with double-L)
      const { error: planErr } = await supabase
        .from('credit_plans')
        .update({ status: 'CANCELLED' })
        .eq('id', plan.id)
      if (planErr) console.warn('[voidSale] credit_plans CANCELLED update:', planErr.message)
    }

    // Recalculate credit_used (RPC does the right thing whether plan exists or not)
    const { error: recalcErr } = await supabase.rpc('recalculate_client_credit_used', {
      p_client_id: sale.client_id,
    })
    if (recalcErr) console.warn('[voidSale] recalculate_client_credit_used:', recalcErr.message)
  }

  // 4. Marcar la venta como anulada
  const { error: voidErr } = await supabase
    .from('sales')
    .update({
      voided: true,
      void_reason: reason.trim(),
      void_user_id: user.id,
      void_at: new Date().toISOString(),
    })
    .eq('id', saleId)

  if (voidErr) return { success: false, error: `Error marcando venta como anulada: ${voidErr.message}` }

  // 5. Audit
  await supabase
    .from('audit_log')
    .insert({
      user_id: user.id,
      operation: 'UPDATE',
      entity_type: 'sales',
      entity_id: saleId,
      new_values: {
        voided: true,
        void_reason: reason.trim(),
        items_returned: items.length,
        sale_type: sale.sale_type,
      },
    })
    .then(() => {})

  // 6. Revalidate everything that read this sale
  revalidatePath('/sales')
  revalidatePath('/pos')
  revalidatePath('/dashboard')
  revalidatePath('/reports')
  if (sale.sale_type === 'CREDITO') {
    revalidatePath('/debt/plans')
    revalidatePath('/collections/payments')
  }

  return {
    success: true,
    data: {
      sale_id: saleId,
      sale_number: sale.sale_number,
      items_returned: items.length,
    },
  }
}
