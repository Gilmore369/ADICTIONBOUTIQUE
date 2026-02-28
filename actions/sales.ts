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

  const validated = saleSchema.safeParse({
    store_id: formData.get('store_id'),
    client_id: formData.get('client_id') || undefined,
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

    // 8. Audit log (fire-and-forget)
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
