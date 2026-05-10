/**
 * Client Visits API
 *
 * GET  /api/visits?client_id=X           — history for one client
 * GET  /api/visits?visit_type=Cobranza   — filter by type
 * GET  /api/visits?date=2026-02-25       — filter by date (YYYY-MM-DD)
 * POST /api/visits                       — create a new visit record
 *                                          If payment_amount > 0 and result
 *                                          requires payment, also processes
 *                                          the payment (oldest-due-first) and
 *                                          updates installments + caja.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { peruMidnightUTC, peruEndOfDayUTC } from '@/lib/utils/timezone'
import { applyPaymentToInstallments } from '@/lib/payments/oldest-due-first'
import type { Installment } from '@/lib/payments/oldest-due-first'
import { revalidatePath } from 'next/cache'
import { sendPaymentNotificationEmail, estimateNextPaymentDate } from '@/lib/email/payment-notification'
import { generatePaymentStatementPDF } from '@/lib/pdf/generate-payment-statement'
import { getStoreLogo } from '@/lib/utils/get-store-logo'

/** Results from the visit dialog that imply a payment was collected */
const PAYMENT_REQUIRED_RESULTS = ['Pagó', 'Abono parcial']

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const params   = request.nextUrl.searchParams

    const clientId  = params.get('client_id')
    const visitType = params.get('visit_type')
    const date      = params.get('date') // YYYY-MM-DD

    let query = supabase
      .from('client_visits')
      .select(`
        id,
        client_id,
        visit_date,
        visit_type,
        result,
        comment,
        image_url,
        payment_amount,
        payment_method,
        payment_proof_url,
        promise_date,
        promise_amount,
        notes,
        created_at,
        clients ( id, name, phone, address )
      `)
      .order('visit_date', { ascending: false })
      .limit(200)

    if (clientId)  query = query.eq('client_id', clientId)
    if (visitType) query = query.eq('visit_type', visitType)
    if (date) {
      // Filter visits on a specific calendar day in Peru timezone
      query = query
        .gte('visit_date', peruMidnightUTC(date))
        .lte('visit_date', peruEndOfDayUTC(date))
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    
    const body = await request.json()

    const { 
      client_id, 
      visit_type, 
      result, 
      comment, 
      image_url,
      payment_amount,
      payment_method,
      payment_proof_url,
      promise_date,
      promise_amount
    } = body

    if (!client_id) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 })
    if (!result)    return NextResponse.json({ error: 'result requerido'    }, { status: 400 })

    // Get client info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name')
      .eq('id', client_id)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Create visit record
    const { data: visit, error: visitError } = await supabase
      .from('client_visits')
      .insert({
        client_id,
        user_id: user.id,
        visit_type: visit_type || 'Cobranza',
        result,
        comment: comment || null,
        image_url: image_url || null,
        payment_amount: payment_amount || null,
        payment_method: payment_method || null,
        payment_proof_url: payment_proof_url || null,
        promise_date: promise_date || null,
        promise_amount: promise_amount || null,
        visit_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (visitError) {
      console.error('Error creating visit:', visitError)
      return NextResponse.json({ error: visitError.message }, { status: 500 })
    }

    // Create corresponding collection action for tracking
    let collectionActionId: string | null = null
    
    // Map visit result to collection action result
    const actionResultMap: Record<string, string> = {
      'Pagó': 'PAGO_REALIZADO',
      'Abono parcial': 'PAGO_PARCIAL',
      'Prometió pagar': 'PROMETE_PAGAR_FECHA',
      'No estaba': 'CLIENTE_NO_UBICADO',
      'Rechazó': 'SE_NIEGA_PAGAR',
      'Interesado': 'CLIENTE_COLABORADOR',
      'Dejé recado': 'OTRO',
      'Sin respuesta': 'NO_CONTESTA',
    }

    const collectionResult = actionResultMap[result] || 'OTRO'
    
    const { data: collectionAction, error: actionError } = await supabase
      .from('collection_actions')
      .insert({
        client_id,
        client_name: client.name,
        action_type: 'VISITA',
        result: collectionResult,
        payment_promise_date: promise_date || null,
        notes: comment || `Visita de ${visit_type}: ${result}`,
        user_id: user.id,
      })
      .select('id')
      .single()

    if (!actionError && collectionAction) {
      collectionActionId = collectionAction.id
      
      // Link visit to collection action
      await supabase
        .from('client_visits')
        .update({ collection_action_id: collectionActionId })
        .eq('id', visit.id)
    }

    // ── Payment processing ──────────────────────────────────────────────────
    // When the cobrador registers a real payment ("Pagó" / "Abono parcial"):
    //   1. ALWAYS insert a row in `payments` (visible in caja) — regardless of
    //      whether the client has credit plans or pending installments.
    //   2. IF the client has unpaid installments, apply oldest-due-first and
    //      update installment statuses + credit_used.
    let paymentProcessed = false
    if (PAYMENT_REQUIRED_RESULTS.includes(result) && payment_amount && Number(payment_amount) > 0) {
      try {
        const serviceClient = createServiceClient()
        const amount = Number(payment_amount)
        const method = payment_method || 'EFECTIVO'
        const paymentNote = `Cobro via visita - ${result} - Método: ${method}`

        // ── Step 1: Try to apply to installments (optional) ────────────────
        let linkedPlanId: string | null = null
        let linkedInstallmentId: string | null = null

        const { data: clientPlans } = await serviceClient
          .from('credit_plans')
          .select('id')
          .eq('client_id', client_id)
          .eq('status', 'ACTIVE')

        if (clientPlans && clientPlans.length > 0) {
          const planIds = clientPlans.map((p: any) => p.id)

          const { data: rawInstallments } = await serviceClient
            .from('installments')
            .select('id, plan_id, installment_number, amount, due_date, paid_amount, status, paid_at')
            .in('plan_id', planIds)
            .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])

          if (rawInstallments && rawInstallments.length > 0) {
            const unpaidInstallments: Installment[] = rawInstallments.map((inst: any) => ({
              id: inst.id,
              plan_id: inst.plan_id,
              installment_number: inst.installment_number,
              amount: inst.amount,
              due_date: inst.due_date,
              paid_amount: inst.paid_amount,
              status: inst.status as 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE',
              paid_at: inst.paid_at,
            }))

            const originalPaid: Record<string, number> = {}
            for (const orig of unpaidInstallments) {
              originalPaid[orig.id] = Number(orig.paid_amount)
            }

            const { updatedInstallments } = applyPaymentToInstallments(amount, unpaidInstallments)

            for (const updated of updatedInstallments) {
              const updateData: any = { paid_amount: updated.paid_amount, status: updated.status }
              if (updated.paid_at) updateData.paid_at = updated.paid_at
              await serviceClient.from('installments').update(updateData).eq('id', updated.id)
            }

            const { error: recalcError } = await serviceClient.rpc('recalculate_client_credit_used', { p_client_id: client_id })
            if (recalcError) {
              console.warn('[visits] recalculate_client_credit_used:', recalcError.message)
            }

            linkedPlanId = updatedInstallments[0]?.plan_id || null
            linkedInstallmentId = updatedInstallments[0]?.id || null

            // payment_allocations (best-effort)
            const allocations = updatedInstallments
              .map(u => ({
                installment_id: u.id,
                amount_applied: Number(u.paid_amount) - (originalPaid[u.id] ?? 0),
              }))
              .filter(a => a.amount_applied > 0)

            // Will attach payment_id after insert below
            if (allocations.length > 0) {
              // stored for later
              (serviceClient as any).__pendingAllocations = allocations
            }
          }
        }

        // ── Step 2: ALWAYS insert payment record ───────────────────────────
        let insertResult = await serviceClient
          .from('payments')
          .insert({
            client_id,
            amount,
            payment_date: new Date().toISOString(),
            user_id: user.id,
            receipt_url: payment_proof_url || null,
            notes: paymentNote,
            plan_id: linkedPlanId,
            installment_id: linkedInstallmentId,
          })
          .select('id')
          .single()

        // Fallback: column not yet migrated
        if (insertResult.error && insertResult.error.code === '42703') {
          insertResult = await serviceClient
            .from('payments')
            .insert({
              client_id,
              amount,
              payment_date: new Date().toISOString(),
              user_id: user.id,
              receipt_url: payment_proof_url || null,
              notes: paymentNote,
            })
            .select('id')
            .single()
        }

        if (!insertResult.error && insertResult.data) {
          paymentProcessed = true
          console.log(`[visits] Payment inserted: S/ ${amount} for client ${client_id} via ${method}`)

          // Attach allocations if any
          const pendingAllocs = (serviceClient as any).__pendingAllocations as any[] | undefined
          if (pendingAllocs && pendingAllocs.length > 0) {
            await serviceClient.from('payment_allocations').insert(
              pendingAllocs.map(a => ({ ...a, payment_id: insertResult.data!.id }))
            ).catch(() => {})
          }

          // ── Send payment notification email with PDF (fire-and-forget) ───
          try {
            const { data: clientFull } = await serviceClient
              .from('clients')
              .select('email, credit_used, name, dni, phone')
              .eq('id', client_id)
              .single()

            const clientEmail = clientFull?.email
            if (clientEmail) {
              let purchaseDescription: string | undefined
              let originalTotal = 0
              let allInstallments: Array<{ number: number; dueDate: string; amount: number; paidAmount: number; status: string }> = []

              if (linkedPlanId) {
                const { data: planData } = await serviceClient
                  .from('credit_plans')
                  .select('total_amount, legacy_purchase_description, legacy_original_total')
                  .eq('id', linkedPlanId)
                  .single()
                if (planData) {
                  originalTotal = Number(planData.legacy_original_total ?? planData.total_amount)
                  purchaseDescription = planData.legacy_purchase_description || undefined
                }

                const { data: allInsts } = await serviceClient
                  .from('installments')
                  .select('installment_number, due_date, amount, paid_amount, status')
                  .eq('plan_id', linkedPlanId)
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

              // Próxima cuota pendiente
              const nextInst = allInstallments.find(i => i.status === 'PENDING' || i.status === 'PARTIAL')
              let nextDueDate: string
              if (nextInst) {
                nextDueDate = nextInst.dueDate
              } else {
                // 1 mes desde hoy
                const base = new Date()
                const next = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate())
                nextDueDate = next.toISOString().split('T')[0]
              }

              const paymentDateISO = new Date().toISOString()

              // Generar PDF
              let pdfBuffer: Buffer | undefined
              try {
                const logoBase64 = await getStoreLogo()
                pdfBuffer = await generatePaymentStatementPDF({
                  clientName: clientFull?.name ?? client.name,
                  clientDni: clientFull?.dni || undefined,
                  clientPhone: clientFull?.phone || undefined,
                  clientEmail,
                  amountPaid: amount,
                  paymentMethod: method,
                  paymentDate: paymentDateISO,
                  originalTotal: originalTotal || amount,
                  totalPaid: totalPaid || amount,
                  remainingBalance,
                  purchaseDescription,
                  installments: allInstallments,
                  nextDueDate,
                  notes: body.comment ? `Nota del cobrador: ${body.comment}` : undefined,
                  logoBase64: logoBase64 || undefined,
                })
              } catch (pdfErr) {
                console.warn('[visits] PDF generation failed:', pdfErr)
              }

              sendPaymentNotificationEmail({
                clientName: clientFull?.name ?? client.name,
                clientEmail,
                amountPaid: amount,
                paymentMethod: method,
                paymentDate: paymentDateISO,
                purchaseDescription,
                originalTotal: originalTotal || undefined,
                totalPaid: totalPaid || undefined,
                remainingBalance,
                nextDueDate,
                notes: body.comment ? `Nota del cobrador: ${body.comment}` : undefined,
                pdfBuffer,
              }).catch(err => console.warn('[visits] Email notification failed:', err))
            }
          } catch (emailErr) {
            console.warn('[visits] Could not send payment email:', emailErr)
          }
        } else if (insertResult.error) {
          console.error('[visits] Payment insert error:', insertResult.error.message)
        }

        // Invalidate caches
        revalidatePath('/cash')
        revalidatePath('/dashboard')
        revalidatePath('/collections/payments')
        revalidatePath('/debt/plans')
        revalidatePath('/map')
      } catch (paymentError) {
        console.error('[visits] Payment processing error:', paymentError)
      }
    }

    return NextResponse.json({
      data: { ...visit, collection_action_id: collectionActionId, payment_processed: paymentProcessed }
    }, { status: 201 })
  } catch (error) {
    console.error('Error in visits API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
