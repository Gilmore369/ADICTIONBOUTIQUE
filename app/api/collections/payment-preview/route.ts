/**
 * Payment Preview API
 *
 * GET /api/collections/payment-preview?client_id=X&amount=Y
 *
 * Returns a preview of which installments will be affected when a payment of
 * `amount` is applied to a client, using the oldest-due-first algorithm.
 * Does NOT write anything to the database.
 *
 * Response:
 * {
 *   data: {
 *     installments: Installment[],   // only installments that will be touched
 *     remaining_amount: number        // leftover if payment > total debt
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  applyPaymentToInstallments,
  type Installment,
} from '@/lib/payments/oldest-due-first'

export async function GET(request: NextRequest) {
  try {
    const params    = request.nextUrl.searchParams
    const clientId  = params.get('client_id')
    const amountRaw = params.get('amount')

    if (!clientId) {
      return NextResponse.json({ error: 'client_id requerido' }, { status: 400 })
    }

    const amount = parseFloat(amountRaw ?? '0')
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'amount debe ser mayor a 0' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Fetch all unpaid / partially-paid installments for this client
    const { data: rows, error } = await supabase
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
        credit_plans!inner ( client_id )
      `)
      .eq('credit_plans.client_id', clientId)
      .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
      .order('due_date', { ascending: true })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        data: { installments: [], remaining_amount: 0 },
      })
    }

    // Shape into the Installment interface expected by the algorithm
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const installments: Installment[] = rows.map((r: Record<string, any>) => ({
      id:                 r.id,
      plan_id:            r.plan_id,
      installment_number: r.installment_number,
      amount:             r.amount,
      due_date:           r.due_date,
      paid_amount:        r.paid_amount ?? 0,
      status:             r.status,
      paid_at:            r.paid_at ?? null,
    }))

    // Run the dry-run allocation
    const { updatedInstallments, remainingAmount } =
      applyPaymentToInstallments(amount, installments)

    // Build a map of id → amount_to_apply for quick lookup
    const applyMap = new Map(
      updatedInstallments.map(u => [
        u.id,
        u.paid_amount - (installments.find(i => i.id === u.id)?.paid_amount ?? 0),
      ])
    )

    // Return only the installments that will actually be touched, with amount_to_apply
    const previewInstallments = installments
      .filter(inst => applyMap.has(inst.id))
      .map(inst => ({
        id:                 inst.id,
        installment_number: inst.installment_number,
        amount:             inst.amount,
        due_date:           inst.due_date,
        paid_amount:        inst.paid_amount,
        status:             inst.status,
        amount_to_apply:    applyMap.get(inst.id) ?? 0,
      }))

    return NextResponse.json({
      data: {
        installments:     previewInstallments,
        remaining_amount: remainingAmount,
      },
    })
  } catch (err) {
    console.error('payment-preview error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
