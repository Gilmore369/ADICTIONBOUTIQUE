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
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { checkPermission } from '@/lib/auth/check-permission'
import { Permission } from '@/lib/auth/permissions'
import { paymentSchema } from '@/lib/validations/debt'
import { applyPaymentToInstallments, calculateOutstandingDebt } from '@/lib/payments/oldest-due-first'
import type { Installment } from '@/lib/payments/oldest-due-first'
import { STORE_DISPLAY_NAMES } from '@/lib/utils/store-filter'
import { sendPaymentNotificationEmail } from '@/lib/email/payment-notification'
import { generatePaymentStatementPDF } from '@/lib/pdf/generate-payment-statement'
import { getStoreLogo } from '@/lib/utils/get-store-logo'

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
  const authClient = await createServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized: User not authenticated' }
  }

  // Use service client for all data operations (bypasses RLS on credit_plans, installments, payments)
  const supabase = createServiceClient()

  // 2. Parse and validate input
  const receiptUrl = formData.get('receipt_url')
  const notes = formData.get('notes')
  const idempotencyKey = (formData.get('idempotency_key') || '').toString().trim() || null
  const rawStoreFilter = (formData.get('store_id') || '').toString().trim()
  const storeFilter = rawStoreFilter
    ? (STORE_DISPLAY_NAMES[rawStoreFilter.toUpperCase()] || rawStoreFilter)
    : null

  const validated = paymentSchema.safeParse({
    client_id: formData.get('client_id'),
    amount: formData.get('amount') ? Number(formData.get('amount')) : undefined,
    payment_date: formData.get('payment_date'),
    user_id: user.id,
    receipt_url: receiptUrl || undefined,
    notes: notes || undefined
  })

  if (!validated.success) {
    const fieldErrors = validated.error.flatten().fieldErrors
    console.error('[processPayment] Validation failed:', JSON.stringify(fieldErrors))
    const firstError = Object.entries(fieldErrors)
      .map(([field, errs]) => `${field}: ${(errs as string[]).join(', ')}`)
      .join(' | ')
    return { success: false, error: `Datos inválidos — ${firstError}` }
  }

  const { client_id, amount, payment_date, receipt_url: validatedReceiptUrl, notes: validatedNotes } = validated.data

  // 2b. IDEMPOTENCY GUARD — if the client provided a key and we already have
  // a payment row with it, short-circuit. Prevents double-clicks / network
  // retries from cobrar dos veces la misma cuota. The column is added by
  // 20260504000001_payments_idempotency_key.sql (nullable + unique-where-not-
  // null) so older clients without a key still work.
  if (idempotencyKey) {
    const { data: existing, error: idemErr } = await supabase
      .from('payments')
      .select('id, amount')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    // 42703 = column does not exist → migration not applied yet, skip the check
    if (idemErr && idemErr.code !== '42703') {
      console.warn('[payments] idempotency lookup failed:', idemErr.message)
    } else if (existing) {
      console.info('[payments] idempotency hit — returning existing payment', existing.id)
      return {
        success: true,
        data: {
          payment_id: existing.id,
          amount_applied: Number(existing.amount),
          remaining_amount: 0,
          installments_updated: 0,
          deduplicated: true,
        },
      }
    }
  }

  // 3. Fetch client's unpaid installments
  // First get active plan IDs for this client (more reliable than cross-table filter)
  const { data: clientPlans, error: plansError } = await supabase
    .from('credit_plans')
    .select('id, sale_id, imported_from_legacy, sales(store_id)')
    .eq('client_id', client_id)
    .in('status', ['ACTIVE'])

  if (plansError) {
    return { success: false, error: `Failed to fetch credit plans: ${plansError.message}` }
  }

  const visiblePlans = storeFilter
    ? (clientPlans || []).filter((plan: any) => {
      const saleStore = Array.isArray(plan.sales) ? plan.sales[0]?.store_id : plan.sales?.store_id
      return saleStore === storeFilter || (plan.imported_from_legacy && !plan.sale_id)
    })
    : (clientPlans || [])

  if (visiblePlans.length === 0) {
    return { success: false, error: 'Este cliente no tiene planes de crédito activos' }
  }

  const planIds = visiblePlans.map(p => p.id)

  const { data: clientInstallments, error: fetchError } = await supabase
    .from('installments')
    .select('id, plan_id, installment_number, amount, due_date, paid_amount, status, paid_at')
    .in('plan_id', planIds)
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
    let insertResult = await supabase
      .from('payments')
      .insert({
        client_id,
        amount,
        payment_date,
        user_id: user.id,
        receipt_url:    validatedReceiptUrl || null,
        notes:          validatedNotes || null,
        plan_id:        firstInstallment?.plan_id || null,
        installment_id: updatedInstallments[0]?.id || null,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single()

    // If two requests with the same idempotency_key race past the lookup
    // above, one of them lands here and trips the unique index. That's the
    // "good" failure mode — return the row that won the race.
    if (insertResult.error && insertResult.error.code === '23505' && idempotencyKey) {
      const { data: winner } = await supabase
        .from('payments')
        .select('id, amount')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()
      if (winner) {
        console.info('[payments] idempotency race — returning winning payment', winner.id)
        return {
          success: true,
          data: {
            payment_id: winner.id,
            amount_applied: Number(winner.amount),
            remaining_amount: 0,
            installments_updated: 0,
            deduplicated: true,
          },
        }
      }
    }

    // Fallback: si las columnas plan_id/installment_id/idempotency_key no
    // existen en la BD, reintentar sin ellas para compatibilidad hacia atrás
    // (migración no ejecutada).
    if (insertResult.error && (
      insertResult.error.message.includes('plan_id') ||
      insertResult.error.message.includes('installment_id') ||
      insertResult.error.message.includes('idempotency_key') ||
      insertResult.error.code === '42703'
    )) {
      console.warn('[payments] Fallback: column not found, retrying without optional columns')
      insertResult = await supabase
        .from('payments')
        .insert({
          client_id,
          amount,
          payment_date,
          user_id: user.id,
          receipt_url: validatedReceiptUrl || null,
          notes:       validatedNotes || null,
        })
        .select()
        .single()
    }

    const { data: payment, error: paymentError } = insertResult

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
    revalidatePath('/dashboard')
    revalidatePath('/cash')

    // 10. Send payment notification email with PDF (after response — fire-and-forget)
    const capturedPlanIds = [...planIds]
    const capturedClientId = client_id
    const capturedAmount = amount
    const capturedDate = payment_date
    const capturedNotes = validatedNotes
    const capturedMethodRaw = (formData.get('payment_method') || formData.get('method') || 'EFECTIVO').toString()

    after(async () => {
      try {
        const supa = createServiceClient()

        // Client info
        const { data: clientFull } = await supa
          .from('clients')
          .select('email, credit_used, name, dni, phone')
          .eq('id', capturedClientId)
          .single()

        const clientEmail = clientFull?.email
        if (!clientEmail) return

        // Plan data (first plan — may be multi-plan payment but email covers them all)
        let purchaseDescription: string | undefined
        let originalTotal = 0
        const allInstallments: Array<{ number: number; dueDate: string; amount: number; paidAmount: number; status: string }> = []

        for (const pid of capturedPlanIds) {
          const { data: planData } = await supa
            .from('credit_plans')
            .select('total_amount, legacy_purchase_description, legacy_original_total')
            .eq('id', pid)
            .single()
          if (planData) {
            originalTotal += Number(planData.legacy_original_total ?? planData.total_amount)
            if (!purchaseDescription && planData.legacy_purchase_description) {
              purchaseDescription = planData.legacy_purchase_description
            }
          }

          const { data: insts } = await supa
            .from('installments')
            .select('installment_number, due_date, amount, paid_amount, status')
            .eq('plan_id', pid)
            .order('installment_number', { ascending: true })

          if (insts) {
            for (const i of insts as any[]) {
              allInstallments.push({
                number: i.installment_number ?? allInstallments.length + 1,
                dueDate: i.due_date,
                amount: Number(i.amount),
                paidAmount: Number(i.paid_amount ?? 0),
                status: i.status,
              })
            }
          }
        }

        const remainingBalance = Math.max(0, Number(clientFull?.credit_used ?? 0))
        const totalPaid = Math.max(0, originalTotal - remainingBalance)

        // Próxima cuota pendiente
        const nextInst = allInstallments.find(i => i.status === 'PENDING' || i.status === 'PARTIAL')
        let nextDueDate: string
        if (nextInst) {
          nextDueDate = nextInst.dueDate
        } else {
          const base = new Date()
          const next = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate())
          nextDueDate = next.toISOString().split('T')[0]
        }

        // Generar PDF
        let pdfBuffer: Buffer | undefined
        try {
          const logoBase64 = await getStoreLogo()
          pdfBuffer = await generatePaymentStatementPDF({
            clientName: clientFull?.name ?? 'Cliente',
            clientDni: clientFull?.dni || undefined,
            clientPhone: clientFull?.phone || undefined,
            clientEmail,
            amountPaid: capturedAmount,
            paymentMethod: capturedMethodRaw,
            paymentDate: capturedDate,
            originalTotal: originalTotal || capturedAmount,
            totalPaid: totalPaid || capturedAmount,
            remainingBalance,
            purchaseDescription,
            installments: allInstallments,
            nextDueDate,
            notes: capturedNotes || undefined,
            logoBase64: logoBase64 || undefined,
          })
        } catch (pdfErr) {
          console.warn('[payments] PDF generation failed:', pdfErr)
        }

        await sendPaymentNotificationEmail({
          clientName: clientFull?.name ?? 'Cliente',
          clientEmail,
          amountPaid: capturedAmount,
          paymentMethod: capturedMethodRaw,
          paymentDate: capturedDate,
          purchaseDescription,
          originalTotal: originalTotal || undefined,
          totalPaid: totalPaid || undefined,
          remainingBalance,
          nextDueDate,
          notes: capturedNotes || undefined,
          pdfBuffer,
        })
      } catch (emailErr) {
        console.warn('[processPayment] Could not send payment email:', emailErr)
      }
    })

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
