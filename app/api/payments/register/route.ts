/**
 * Register Payment API Route
 * 
 * POST /api/payments/register
 * Registers a payment for an installment (partial or complete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

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

    // Insert payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        installment_id: installmentId,
        amount: amount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        notes: notes || null,
        created_by: user.id,
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
        updated_at: new Date().toISOString(),
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
    const clientId = installment.credit_plans.client_id
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
