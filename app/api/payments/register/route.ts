/**
 * Register Payment API Route
 * 
 * POST /api/payments/register
 * Registers a payment for an installment (partial or complete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPaymentNotificationEmail, estimateNextPaymentDate } from '@/lib/email/payment-notification'
import { generatePaymentStatementPDF } from '@/lib/pdf/generate-payment-statement'

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
        payment_date: paymentDate,
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

      // Fetch client info
      const { data: clientFull } = await supabase
        .from('clients')
        .select('email, credit_used, name, dni, phone')
        .eq('id', clientId)
        .single()

      const clientEmail = clientFull?.email
      if (clientEmail) {
        // Plan details
        let purchaseDescription: string | undefined
        let originalTotal = 0
        let allInstallments: Array<{ number: number; dueDate: string; amount: number; paidAmount: number; status: string }> = []

        if (planId) {
          const { data: planData } = await supabase
            .from('credit_plans')
            .select('total_amount, legacy_purchase_description, legacy_original_total')
            .eq('id', planId)
            .single()
          if (planData) {
            originalTotal = Number(planData.legacy_original_total ?? planData.total_amount)
            purchaseDescription = planData.legacy_purchase_description || undefined
          }

          // All installments for this plan
          const { data: allInsts } = await supabase
            .from('installments')
            .select('installment_number, due_date, amount, paid_amount, status')
            .eq('plan_id', planId)
            .order('installment_number', { ascending: true })

          if (allInsts) {
            allInstallments = allInsts.map((i: any) => ({
              number: i.installment_number ?? 1,
              dueDate: i.due_date,
              amount: Number(i.amount),
              paidAmount: Number(i.paid_amount ?? 0),
              status: i.status,
            }))
          }
        }

        const remainingBalance = Math.max(0, Number(clientFull?.credit_used ?? 0))
        const totalPaid = Math.max(0, originalTotal - remainingBalance)

        // Next due date: first PENDING or PARTIAL installment after payment
        let nextDueDate: string | undefined
        const nextInst = allInstallments.find(i => i.status === 'PENDING' || i.status === 'PARTIAL')
        if (nextInst) {
          nextDueDate = nextInst.dueDate
        } else {
          // Fallback: 1 mes desde la fecha del pago
          const base = new Date(paymentDate)
          const next = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate())
          nextDueDate = next.toISOString().split('T')[0]
        }

        // Generate PDF
        let pdfBuffer: Buffer | undefined
        try {
          pdfBuffer = await generatePaymentStatementPDF({
            clientName: clientFull?.name ?? 'Cliente',
            clientDni: clientFull?.dni || undefined,
            clientPhone: clientFull?.phone || undefined,
            clientEmail,
            amountPaid: amount,
            paymentMethod,
            paymentDate,
            originalTotal: originalTotal || amount,
            totalPaid: totalPaid || amount,
            remainingBalance,
            purchaseDescription,
            installments: allInstallments,
            nextDueDate,
            notes: notes || undefined,
          })
        } catch (pdfErr) {
          console.warn('[payments/register] PDF generation failed:', pdfErr)
        }

        sendPaymentNotificationEmail({
          clientName: clientFull?.name ?? 'Cliente',
          clientEmail,
          amountPaid: amount,
          paymentMethod,
          paymentDate,
          purchaseDescription,
          originalTotal: originalTotal || undefined,
          totalPaid: totalPaid || undefined,
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
