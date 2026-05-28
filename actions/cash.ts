'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { logCashShiftOpened, logCashShiftClosed } from '@/lib/utils/audit'

async function getPaymentPlanIdsForStore(supabase: Awaited<ReturnType<typeof createServerClient>>, storeId: string) {
  const { data: storeSales } = await supabase
    .from('sales')
    .select('id')
    .eq('store_id', storeId)

  const saleIds = (storeSales || []).map((sale: { id: string }) => sale.id)
  const { data: salePlans } = saleIds.length > 0
    ? await supabase
      .from('credit_plans')
      .select('id')
      .in('sale_id', saleIds)
    : { data: [] }

  const { data: legacyPlans } = await supabase
    .from('credit_plans')
    .select('id')
    .eq('imported_from_legacy', true)
    .eq('status', 'ACTIVE')

  return [...new Set([
    ...(salePlans || []).map((plan: { id: string }) => plan.id),
    ...(legacyPlans || []).map((plan: { id: string }) => plan.id),
  ])]
}

async function getCollectionPaymentsForStoreWindow(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  storeId: string,
  startAt: string,
  endAt: string,
  includeClient = false,
) {
  const planIds = await getPaymentPlanIdsForStore(supabase, storeId)
  if (planIds.length === 0) return []

  const selectFields = includeClient
    ? 'id, amount, notes, created_at, clients(name)'
    : 'id, amount'

  // IMPORTANTE: excluir pagos importados del sistema anterior (imported_from_legacy=true).
  // Esos son pagos históricos que el cliente YA hizo en el otro sistema antes de
  // la migración. NO son ingresos reales del turno actual aunque se hayan creado
  // (su `created_at`) dentro de la ventana del turno (cuando se ejecutó el import).
  // El cobrador que registre un NUEVO pago a una deuda legacy (después de migrarla)
  // sí entra a caja porque ese pago no tiene imported_from_legacy=true.
  const { data } = await supabase
    .from('payments')
    .select(selectFields)
    .in('plan_id', planIds)
    .or('imported_from_legacy.is.null,imported_from_legacy.eq.false')
    .gte('created_at', startAt)
    .lte('created_at', endAt)
    .order('created_at', { ascending: false })

  return data || []
}

/**
 * Get live breakdown of an open shift (ventas, cobros, gastos)
 */
export async function getCashShiftBreakdown(shiftId: string, storeId: string, openedAt: string) {
  try {
    const supabase = await createServerClient()
    const now = new Date().toISOString()

    // Ventas CONTADO durante el turno
    const { data: sales } = await supabase
      .from('sales')
      .select('total, sale_type')
      .eq('store_id', storeId)
      .eq('voided', false)
      .gte('created_at', openedAt)
      .lte('created_at', now)

    const cashSales = (sales || []).filter(s => s.sale_type === 'CONTADO')
    const totalCashSales = cashSales.reduce((sum, s) => sum + parseFloat(s.total?.toString() || '0'), 0)
    const creditSales = (sales || []).filter(s => s.sale_type === 'CREDITO')
    const totalCreditSales = creditSales.reduce((sum, s) => sum + parseFloat(s.total?.toString() || '0'), 0)

    // Cobros (pagos de crédito) desde apertura del turno
    const collectionPayments = await getCollectionPaymentsForStoreWindow(supabase, storeId, openedAt, now, true)

    const totalCollections = (collectionPayments || []).reduce(
      (sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0
    )

    // Gastos del turno
    const { data: expenses } = await supabase
      .from('cash_expenses')
      .select('id, amount, category, description, created_at')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: false })

    const allExpenses = expenses || []
    const refundsList      = allExpenses.filter(e => e.category === 'DEVOLUCION')
    const otherExpensesList = allExpenses.filter(e => e.category !== 'DEVOLUCION')

    const totalRefunds  = refundsList.reduce(
      (sum, e) => sum + parseFloat(e.amount?.toString() || '0'), 0
    )
    const totalOtherExpenses = otherExpensesList.reduce(
      (sum, e) => sum + parseFloat(e.amount?.toString() || '0'), 0
    )
    const totalExpenses = totalRefunds + totalOtherExpenses

    // Build paymentsList with client names for display
    const paymentsList = (collectionPayments || []).map((p: any) => ({
      id: p.id,
      amount: parseFloat(p.amount?.toString() || '0'),
      clientName: p.clients?.name || 'Cliente',
      notes: p.notes || '',
      created_at: p.created_at,
    }))

    return {
      success: true,
      data: {
        cashSales: totalCashSales,
        creditSales: totalCreditSales,
        collections: totalCollections,
        expenses: totalExpenses,
        refunds: totalRefunds,
        otherExpenses: totalOtherExpenses,
        expensesList: allExpenses,
        refundsList,
        otherExpensesList,
        paymentsList,
      }
    }
  } catch (error) {
    return { success: false, error: 'Error al cargar cuadre' }
  }
}

/**
 * Reconstruye el desglose de un turno ya CERRADO
 * Igual que getCashShiftBreakdown pero usa closed_at como límite superior
 */
export async function getClosedShiftBreakdown(
  shiftId: string,
  storeId: string,
  openedAt: string,
  closedAt: string,
) {
  try {
    const supabase = await createServerClient()

    const { data: sales } = await supabase
      .from('sales')
      .select('total, sale_type')
      .eq('store_id', storeId)
      .eq('voided', false)
      .gte('created_at', openedAt)
      .lte('created_at', closedAt)

    const cashSales        = (sales || []).filter(s => s.sale_type === 'CONTADO')
    const totalCashSales   = cashSales.reduce((s, x) => s + parseFloat(x.total?.toString() || '0'), 0)
    const creditSales      = (sales || []).filter(s => s.sale_type === 'CREDITO')
    const totalCreditSales = creditSales.reduce((s, x) => s + parseFloat(x.total?.toString() || '0'), 0)

    const collectionPayments = await getCollectionPaymentsForStoreWindow(supabase, storeId, openedAt, closedAt)

    const totalCollections = (collectionPayments || []).reduce(
      (s, p) => s + parseFloat(p.amount?.toString() || '0'), 0
    )

    const { data: expenses } = await supabase
      .from('cash_expenses')
      .select('id, amount, category, description, created_at')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: false })

    const allExpenses       = expenses || []
    const refundsList       = allExpenses.filter(e => e.category === 'DEVOLUCION')
    const otherExpensesList = allExpenses.filter(e => e.category !== 'DEVOLUCION')
    const totalRefunds      = refundsList.reduce((s, e) => s + parseFloat(e.amount?.toString() || '0'), 0)
    const totalOther        = otherExpensesList.reduce((s, e) => s + parseFloat(e.amount?.toString() || '0'), 0)
    const totalExpenses     = totalRefunds + totalOther

    return {
      success: true,
      data: {
        cashSales:        totalCashSales,
        creditSales:      totalCreditSales,
        collections:      totalCollections,
        expenses:         totalExpenses,
        refunds:          totalRefunds,
        otherExpenses:    totalOther,
        expensesList:     allExpenses,
        refundsList,
        otherExpensesList,
        salesCount:       (sales || []).length,
        paymentsCount:    (collectionPayments || []).length,
      }
    }
  } catch {
    return { success: false, error: 'Error al cargar desglose' }
  }
}

/**
 * Get the currently OPEN cash shift for a store (or null).
 * Used to gate payment registration: no se puede cobrar sin caja abierta.
 */
export async function getOpenCashShift(storeId: string): Promise<{
  id: string
  store_id: string
  user_id: string
  opened_at: string
  opening_amount: number
  opener_name?: string | null
} | null> {
  if (!storeId) return null
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from('cash_shifts')
      .select('id, store_id, user_id, opened_at, opening_amount, users(name)')
      .eq('store_id', storeId)
      .eq('status', 'OPEN')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data) return null
    return {
      id: (data as any).id,
      store_id: (data as any).store_id,
      user_id: (data as any).user_id,
      opened_at: (data as any).opened_at,
      opening_amount: Number((data as any).opening_amount) || 0,
      opener_name: Array.isArray((data as any).users)
        ? (data as any).users[0]?.name
        : (data as any).users?.name ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Open a new cash shift
 */
export async function openCashShift(storeId: string, openingAmount: number) {
  try {
    const supabase = await createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'No autenticado' }
    }

    // Prevent duplicate open shifts for the same store
    const { data: existingOpen } = await supabase
      .from('cash_shifts')
      .select('id')
      .eq('store_id', storeId)
      .eq('status', 'OPEN')
      .limit(1)
      .maybeSingle()

    if (existingOpen) {
      return {
        success: false,
        error: `Ya existe un turno abierto para la tienda ${storeId}. Ciérrelo antes de abrir uno nuevo.`
      }
    }

    // Create new shift
    const { data: shift, error } = await supabase
      .from('cash_shifts')
      .insert({
        store_id: storeId,
        user_id: user.id,
        opening_amount: openingAmount,
        status: 'OPEN'
      })
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    // Audit log (fire-and-forget — never block the response)
    logCashShiftOpened(shift.id, user.id, { store_id: storeId, opening_amount: openingAmount }).catch(() => {})

    revalidatePath('/cash')
    return { success: true, shift }
  } catch (error) {
    console.error('Error opening cash shift:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al abrir turno'
    }
  }
}

/**
 * Close an existing cash shift
 */
export async function closeCashShift(shiftId: string, closingAmount: number) {
  try {
    const supabase = await createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'No autenticado' }
    }

    // Get shift details (admin can close any open shift, not just their own)
    const { data: shift, error: shiftError } = await supabase
      .from('cash_shifts')
      .select('*')
      .eq('id', shiftId)
      .eq('status', 'OPEN')
      .single()

    if (shiftError || !shift) {
      return { success: false, error: 'Turno no encontrado o ya cerrado' }
    }

    const now = new Date().toISOString()

    // Calculate expected amount (opening + CONTADO sales + collection payments - expenses)
    // NOTE: Column names are `total` and `sale_type` (not total_amount/payment_type)
    const { data: sales } = await supabase
      .from('sales')
      .select('total, sale_type')
      .eq('store_id', shift.store_id)
      .eq('voided', false)
      .gte('created_at', shift.opened_at)
      .lte('created_at', now)

    // Only count CONTADO sales (CREDITO sales don't enter the cash register)
    const cashSales = sales?.filter(s => s.sale_type === 'CONTADO') || []
    const totalCashSales = cashSales.reduce((sum, sale) => sum + parseFloat(sale.total?.toString() || '0'), 0)

    const collectionPayments = await getCollectionPaymentsForStoreWindow(supabase, shift.store_id, shift.opened_at, now)

    const totalCollections = collectionPayments.reduce(
      (sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0
    )

    // Get total expenses for this shift (split refunds vs other)
    const { data: expenses } = await supabase
      .from('cash_expenses')
      .select('amount, category')
      .eq('shift_id', shiftId)

    const totalRefunds = (expenses || [])
      .filter(e => e.category === 'DEVOLUCION')
      .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0)
    const totalOtherExpenses = (expenses || [])
      .filter(e => e.category !== 'DEVOLUCION')
      .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0)
    const totalExpenses = totalRefunds + totalOtherExpenses

    const expectedAmount = shift.opening_amount + totalCashSales + totalCollections - totalExpenses
    const difference = closingAmount - expectedAmount

    // Update shift
    const { error: updateError } = await supabase
      .from('cash_shifts')
      .update({
        closing_amount: closingAmount,
        expected_amount: expectedAmount,
        difference: difference,
        closed_at: new Date().toISOString(),
        status: 'CLOSED'
      })
      .eq('id', shiftId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    // Audit log (fire-and-forget)
    logCashShiftClosed(shiftId, user.id, {
      closing_amount: closingAmount,
      expected_amount: expectedAmount,
      difference,
      total_cash_sales: totalCashSales,
      total_collections: totalCollections,
      total_expenses: totalExpenses,
    }).catch(() => {})

    revalidatePath('/cash')
    return {
      success: true,
      difference,
      breakdown: {
        opening: shift.opening_amount,
        cashSales: totalCashSales,
        collections: totalCollections,
        expenses: totalExpenses,
        refunds: totalRefunds,
        otherExpenses: totalOtherExpenses,
        expected: expectedAmount,
        closing: closingAmount,
        difference,
      }
    }
  } catch (error) {
    console.error('Error closing cash shift:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al cerrar turno'
    }
  }
}

/**
 * Add a cash expense to the current shift
 */
export async function addCashExpense(
  shiftId: string,
  amount: number,
  category: string,
  description?: string
) {
  try {
    const supabase = await createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'No autenticado' }
    }

    // Verify shift exists and is open
    const { data: shift } = await supabase
      .from('cash_shifts')
      .select('id')
      .eq('id', shiftId)
      .eq('status', 'OPEN')
      .single()

    if (!shift) {
      return { success: false, error: 'Turno no encontrado o cerrado' }
    }

    // Create expense
    const { error } = await supabase
      .from('cash_expenses')
      .insert({
        shift_id: shiftId,
        user_id: user.id,
        amount,
        category,
        description
      })

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath('/cash')
    return { success: true }
  } catch (error) {
    console.error('Error adding cash expense:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al registrar gasto'
    }
  }
}
