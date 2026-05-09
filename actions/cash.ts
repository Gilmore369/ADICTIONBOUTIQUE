'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { logCashShiftOpened, logCashShiftClosed } from '@/lib/utils/audit'

/**
 * Retorna el inicio del día (Lima UTC-5) en UTC, dado el timestamp de apertura del turno.
 * Si el turno abre a las 20:15 UTC (15:15 Lima), el día Lima empieza a las 05:00 UTC.
 */
function shiftDayStartUTC(openedAt: string): string {
  // Convertir openedAt a hora Lima (UTC-5)
  const opened = new Date(openedAt)
  const limaOffsetMs = -5 * 60 * 60 * 1000
  const limaTime = new Date(opened.getTime() + limaOffsetMs)
  // Inicio del día Lima (medianoche Lima) → volver a UTC
  const limaStartOfDay = new Date(
    Date.UTC(limaTime.getUTCFullYear(), limaTime.getUTCMonth(), limaTime.getUTCDate())
  )
  const startUTC = new Date(limaStartOfDay.getTime() - limaOffsetMs)
  return startUTC.toISOString()
}

/**
 * Get live breakdown of an open shift (ventas, cobros, gastos)
 *
 * IMPORTANTE: Las ventas se cuentan desde la apertura del turno.
 * Los cobros se cuentan desde el inicio del día Lima (para capturar
 * cobros hechos antes de que el turno fuera abierto en caja).
 */
export async function getCashShiftBreakdown(shiftId: string, storeId: string, openedAt: string) {
  try {
    const supabase = await createServerClient()
    const now = new Date().toISOString()
    // Día completo Lima — para cobros del día aunque sean previos a apertura del turno
    const dayStart = shiftDayStartUTC(openedAt)

    // Ventas CONTADO durante el turno (desde apertura)
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

    // Cobros (pagos de crédito) del DÍA completo Lima
    // (no solo desde apertura del turno — el cobrador puede traer dinero
    //  antes de que la cajera abra el turno)
    const { data: collectionPayments } = await supabase
      .from('payments')
      .select('id, amount, notes, created_at, clients(name)')
      .gte('created_at', dayStart)
      .lte('created_at', now)
      .order('created_at', { ascending: false })

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

    // Cobros del día completo Lima (mismo criterio que getCashShiftBreakdown)
    const dayStartClosed = shiftDayStartUTC(openedAt)
    const { data: collectionPayments } = await supabase
      .from('payments')
      .select('amount')
      .gte('created_at', dayStartClosed)
      .lte('created_at', closedAt)

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

    // Cobros del día completo Lima (no solo desde apertura del turno).
    // El cobrador puede traer dinero cobrado antes de que la cajera abra el turno.
    const shiftDayStart = shiftDayStartUTC(shift.opened_at)
    const { data: collectionPayments } = await supabase
      .from('payments')
      .select('amount')
      .gte('created_at', shiftDayStart)
      .lte('created_at', now)

    const totalCollections = collectionPayments?.reduce(
      (sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0
    ) || 0

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
