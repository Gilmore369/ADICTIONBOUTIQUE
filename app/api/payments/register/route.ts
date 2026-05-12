/**
 * Register Payment API Route
 * 
 * POST /api/payments/register
 * Registers a payment for an installment (partial or complete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPaymentNotificationEmail } from '@/lib/email/payment-notification'
import { generatePaymentStatementPDF } from '@/lib/pdf/generate-payment-statement'
import { buildPlanSections } from '@/lib/pdf/build-plan-sections'
import { getStoreLogo } from '@/lib/utils/get-store-logo'
import { addDaysPeru, normalizeDateOnlyPeru } from '@/lib/utils/timezone'

export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Use service client for all data operations (bypasses RLS)
    const supabase = createServiceClient()

    const body = await request.json()
    const { installmentId, amount, paymentMethod, paymentDate, notes } = body
    const normalizedPaymentDate = normalizeDateOnlyPeru(paymentDate)

    // Validate required fields
    if (!installmentId || !amount || !paymentMethod || !paymentDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get installment details
    const { data: installment, error: installmentError } = await supabase
      .from('installments')
      .select('*, credit_plans!inner(client_id, total_amount)')
      .eq('id', installmentId)
      .single()

    if (installmentError || !installment) {
      return NextResponse.json(
        { error: 'Installment not found' },
        { status: 404 }
      )
    }

    const pendingAmount = installment.amount - (installment.paid_amount || 0)

    // Validate payment amount
    if (amount <= 0 || amount > pendingAmount) {
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      )
    }

    // Insert payment record — columns: client_id, amount, payment_date, user_id, notes, installment_id, plan_id
    const clientId = (installment as any).credit_plans?.client_id
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        client_id: clientId || null,
        installment_id: installmentId,
        plan_id: (installment as any).plan_id || null,
        amount: amount,
        payment_date: normalizedPaymentDate,
        user_id: user.id,
        notes: notes || null,
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Error creating payment:', paymentError)
      return NextResponse.json(
        { error: 'Failed to register payment' },
        { status: 500 }
      )
    }

    // Update installment paid_amount
    const newPaidAmount = (installment.paid_amount || 0) + amount
    const newStatus = newPaidAmount >= installment.amount ? 'PAID' : 'PARTIAL'

    const { error: updateError } = await supabase
      .from('installments')
      .update({
        paid_amount: newPaidAmount,
        status: newStatus,
        ...(newStatus === 'PAID' ? { paid_at: new Date().toISOString() } : {}),
      })
      .eq('id', installmentId)

    if (updateError) {
      console.error('Error updating installment:', updateError)
      // Rollback payment if update fails
      await supabase.from('payments').delete().eq('id', payment.id)
      return NextResponse.json(
        { error: 'Failed to update installment' },
        { status: 500 }
      )
    }

    // Update client's credit_used (reduce by payment amount)
    const { error: clientError } = await supabase.rpc('update_client_credit_used', {
      p_client_id: clientId,
      p_amount_change: -amount,
    })

    if (clientError) {
      console.error('Error updating client credit:', clientError)
      // Don't rollback - payment is recorded, just log the error
    }

    // Auto-remove from blacklist if client no longer has overdue debt > 10 days
    let removedFromBlacklist = false
    try {
      const { data: blacklistRemoved } = await supabase.rpc('remove_blacklist_if_cleared', {
        p_client_id: clientId,
      })
      removedFromBlacklist = blacklistRemoved === true
    } catch {
      // Non-critical: don't fail the payment if blacklist check fails
    }

    // ── Send payment notification email with PDF (fire-and-forget) ────────
    try {
      const planId = (installment as any).plan_id
      const planIds = planId ? [planId] : []

      const { data: clientFull } = await supabase
        .from('clients')
        .select('email, credit_used, name, dni, phone')
        .eq('id', clientId)
        .single()

      const clientEmail = clientFull?.email
      if (clientEmail && planIds.length > 0) {
        const { plans, originalTotal, allInstallments } = await buildPlanSections(planIds, supabase)
        const remainingBalance = Math.max(0, Number(clientFull?.credit_used ?? 0))
        const totalPaid = Math.max(0, originalTotal - remainingBalance)

        const nextInst = allInstallments.find(i => i.status === 'PENDING' || i.status === 'PARTIAL')
        const nextDueDate = nextInst?.dueDate || (() => {
          return addDaysPeru(30, normalizedPaymentDate)
        })()

        let pdfBuffer: Buffer | undefined
        try {
          const logoBase64 = await getStoreLogo()
          pdfBuffer = await generatePaymentStatementPDF({
            clientName: clientFull?.name ?? 'Cliente',
            clientDni: clientFull?.dni || undefined,
            clientPhone: clientFull?.phone || undefined,
            clientEmail,
            amountPaid: amount,
            paymentMethod,
            paymentDate: normalizedPaymentDate,
            originalTotal: originalTotal || amount,
            totalPaid: totalPaid || amount,
            remainingBalance,
            nextDueDate,
            notes: notes || undefined,
            logoBase64: logoBase64 || undefined,
            plans,
          })
        } catch (pdfErr) {
          console.warn('[payments/register] PDF generation failed:', pdfErr)
        }

        sendPaymentNotificationEmail({
          clientName: clientFull?.name ?? 'Cliente',
          clientEmail,
          amountPaid: amount,
          paymentMethod,
          paymentDate: normalizedPaymentDate,
          remainingBalance,
          nextDueDate,
          notes: notes ? `Nota: ${notes}` : undefined,
          pdfBuffer,
        }).catch(err => console.warn('[payments/register] Email notification failed:', err))
      }
    } catch (emailErr) {
      console.warn('[payments/register] Could not send payment email:', emailErr)
    }

    return NextResponse.json({
      success: true,
      payment,
      message: 'Pago registrado exitosamente',
      removed_from_blacklist: removedFromBlacklist,
    })
  } catch (error) {
    console.error('Error in register payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
