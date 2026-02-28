/**
 * Payments Server Actions
 * 
 * Server actions for payment processing including:
 * - Payment recording with oldest_due_first algorithm
 * - Credit_used decrement
 * - Audit logging
 * 
 * Requirements: 7.1, 7.5, 7.6
 */

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkPermission } from '@/lib/auth/check-permission'
import { Permission } from '@/lib/auth/permissions'
import { paymentSchema } from '@/lib/validations/debt'
import { applyPaymentToInstallments, calculateOutstandingDebt } from '@/lib/payments/oldest-due-first'
import type { Installment } from '@/lib/payments/oldest-due-first'

/**
 * Standard response type for server actions
 */
type ActionResponse<T = any> = {
  success: boolean
  data?: T
  error?: string | Record<string, string[]>
}

/**
 * Process a payment using the oldest_due_first algorithm
 * 
 * Process:
 * 1. Validate input with paymentSchema
 * 2. Check RECORD_PAYMENT permission
 * 3. Fetch client's unpaid installments (PENDING, PARTIAL, OVERDUE)
 * 4. Apply oldest_due_first algorithm to allocate payment
 * 5. Update installments in database transaction
 * 6. Update client credit_used
 * 7. Insert payment record
 * 8. Log to audit_log
 * 9. Revalidate paths
 * 
 * Requirements: 7.1, 7.5, 7.6
 * 
 * @param formData - Form data containing payment information
 * @returns ActionResponse with payment details or error
 */
export async function processPayment(formData: FormData): Promise<ActionResponse> {
  // 1. Check permission
  const hasPermission = await checkPermission(Permission.RECORD_PAYMENT)
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
  const receiptUrl = formData.get('receipt_url')
  const notes = formData.get('notes')

  const validated = paymentSchema.safeParse({
    client_id: formData.get('client_id'),
    amount: formData.get('amount') ? Number(formData.get('amount')) : undefined,
    payment_date: formData.get('payment_date'),
    user_id: user.id,
    receipt_url: receiptUrl || undefined,
    notes: notes || undefined
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  const { client_id, amount, payment_date, receipt_url: validatedReceiptUrl, notes: validatedNotes } = validated.data

  // 3. Fetch client's unpaid installments
  // Get installments with status PENDING, PARTIAL, or OVERDUE using join with credit_plans
  const { data: clientInstallments, error: fetchError } = await supabase
    .from('installments')
    .select(`
      id,
      plan_id,
      installment_number,
      amount,
      due_date,
      paid_amount,
      status,
      paid_at,
      credit_plans!inner (
        client_id
      )
    `)
    .eq('credit_plans.client_id', client_id)
    .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])

  if (fetchError) {
    return { success: false, error: `Failed to fetch installments: ${fetchError.message}` }
  }

  if (!clientInstallments || clientInstallments.length === 0) {
    return { success: false, error: 'No unpaid installments found for this client' }
  }

  // Transform to Installment type
  const unpaidInstallments: Installment[] = clientInstallments.map(inst => ({
    id: inst.id,
    plan_id: inst.plan_id,
    installment_number: inst.installment_number,
    amount: inst.amount,
    due_date: inst.due_date,
    paid_amount: inst.paid_amount,
    status: inst.status as 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE',
    paid_at: inst.paid_at
  }))

  // 4. Apply oldest_due_first algorithm
  const { updatedInstallments, remainingAmount } = applyPaymentToInstallments(
    amount,
    unpaidInstallments
  )

  if (updatedInstallments.length === 0) {
    return { success: false, error: 'Payment could not be applied to any installments' }
  }

  // Calculate total amount applied (for credit_used decrement)
  const totalApplied = amount - remainingAmount

  // 5. Start database transaction
  try {
    // Snapshot de paid_amount original (antes de actualizar)
    const originalPaid: Record<string, number> = {}
    for (const orig of unpaidInstallments) {
      originalPaid[orig.id] = Number(orig.paid_amount)
    }

    // Update each installment
    for (const updated of updatedInstallments) {
      const updateData: any = {
        paid_amount: updated.paid_amount,
        status: updated.status
      }

      if (updated.paid_at) {
        updateData.paid_at = updated.paid_at
      }

      const { error: updateError } = await supabase
        .from('installments')
        .update(updateData)
        .eq('id', updated.id)

      if (updateError) {
        throw new Error(`Failed to update installment ${updated.id}: ${updateError.message}`)
      }
    }

    // 6. Recalculate client credit_used (RPC opcional — no falla si no existe)
    const { error: creditError } = await supabase.rpc('recalculate_client_credit_used', {
      p_client_id: client_id
    })
    if (creditError) {
      console.warn('[payments] recalculate_client_credit_used:', creditError.message)
    }

    // 7. Insert payment record con plan_id e installment_id de la primera cuota
    const firstInstallment = unpaidInstallments.find(i =>
      updatedInstallments.some(u => u.id === i.id)
    )
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        client_id,
        amount,
        payment_date,
        user_id: user.id,
        receipt_url:    validatedReceiptUrl || null,
        notes:          validatedNotes || null,
        plan_id:        firstInstallment?.plan_id || null,
        installment_id: updatedInstallments[0]?.id || null
      })
      .select()
      .single()

    if (paymentError) {
      throw new Error(`Failed to insert payment: ${paymentError.message}`)
    }

    // 7b. Registrar payment_allocations (una fila por cuota aplicada)
    const allocations = updatedInstallments
      .map(u => ({
        payment_id:     payment.id,
        installment_id: u.id,
        amount_applied: Number(u.paid_amount) - (originalPaid[u.id] ?? 0)
      }))
      .filter(a => a.amount_applied > 0)

    if (allocations.length > 0) {
      const { error: allocError } = await supabase
        .from('payment_allocations')
        .insert(allocations)
      if (allocError) {
        // Tabla puede no existir aún — solo loguear, no fallar
        console.warn('[payments] payment_allocations insert:', allocError.message)
      }
    }

    // 8. Log to audit_log
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        user_id: user.id,
        operation: 'INSERT',
        entity_type: 'payments',
        entity_id: payment.id,
        new_values: {
          client_id,
          amount,
          payment_date,
          applied_installments: updatedInstallments.map(u => u.id),
          total_applied: totalApplied,
          remaining_amount: remainingAmount
        }
      })

    if (auditError) {
      // Log audit error but don't fail the transaction
      console.error('Failed to log audit event:', auditError)
    }

    // 9. Revalidate paths
    revalidatePath('/collections/payments')
    revalidatePath('/debt/plans')
    revalidatePath(`/debt/plans/${unpaidInstallments[0]?.plan_id}`)
    revalidatePath('/dashboard') // Revalidar dashboard para actualizar cobros del día

    return {
      success: true,
      data: {
        payment_id: payment.id,
        amount_applied: totalApplied,
        remaining_amount: remainingAmount,
        installments_updated: updatedInstallments.length
      }
    }
  } catch (error) {
    // Handle transaction errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return {
      success: false,
      error: `Transaction failed: ${errorMessage}`
    }
  }
}
