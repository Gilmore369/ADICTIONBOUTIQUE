'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { logCashShiftOpened, logCashShiftClosed } from '@/lib/utils/audit'

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

    // Get shift details
    const { data: shift, error: shiftError } = await supabase
      .from('cash_shifts')
      .select('*')
      .eq('id', shiftId)
      .eq('user_id', user.id)
      .eq('status', 'OPEN')
      .single()

    if (shiftError || !shift) {
      return { success: false, error: 'Turno no encontrado' }
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

    // Collection payments (debt repayments) received during this shift
    // These are cash that enters the register from credit clients
    const { data: collectionPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('user_id', shift.user_id)
      .gte('created_at', shift.opened_at)
      .lte('created_at', now)

    const totalCollections = collectionPayments?.reduce(
      (sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0
    ) || 0

    // Get total expenses for this shift
    const { data: expenses } = await supabase
      .from('cash_expenses')
      .select('amount')
      .eq('shift_id', shiftId)

    const totalExpenses = expenses?.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0) || 0

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
        expected: expectedAmount,
        closing: closingAmount,
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
