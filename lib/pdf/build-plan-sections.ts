/**
 * buildPlanSections — fetches plan data, products and installments
 * for a list of credit plan IDs and returns the PlanSection[] array
 * used by generatePaymentStatementPDF.
 */

import type { PlanSection } from './generate-payment-statement'

export async function buildPlanSections(
  planIds: string[],
  supabase: any  // service client
): Promise<{
  plans: PlanSection[]
  originalTotal: number
  allInstallments: Array<{ number: number; dueDate: string; amount: number; paidAmount: number; status: string }>
}> {
  const plans: PlanSection[] = []
  let originalTotal = 0
  const allInstallments: Array<{ number: number; dueDate: string; amount: number; paidAmount: number; status: string }> = []

  for (const planId of planIds) {
    // 1. Plan metadata
    const { data: planData } = await supabase
      .from('credit_plans')
      .select('total_amount, legacy_purchase_description, legacy_original_total, sale_id, status')
      .eq('id', planId)
      .single()

    if (!planData) continue

    const planOriginal = Number(planData.legacy_original_total ?? planData.total_amount ?? 0)
    originalTotal += planOriginal

    // 2. Installments for this plan
    const { data: rawInsts } = await supabase
      .from('installments')
      .select('installment_number, due_date, amount, paid_amount, status')
      .eq('plan_id', planId)
      .order('installment_number', { ascending: true })

    const planInstallments = (rawInsts || []).map((i: any, idx: number) => ({
      number: i.installment_number ?? (idx + 1),
      dueDate: i.due_date,
      amount: Number(i.amount),
      paidAmount: Number(i.paid_amount ?? 0),
      status: i.status,
    }))

    allInstallments.push(...planInstallments)

    // 3. Products — from sale_items if sale exists; legacy description otherwise
    let products: PlanSection['products'] = []
    let saleNumber: string | undefined
    let saleDate: string | undefined

    if (planData.sale_id) {
      // Get sale header
      const { data: saleData } = await supabase
        .from('sales')
        .select('sale_number, created_at')
        .eq('id', planData.sale_id)
        .single()

      if (saleData) {
        saleNumber = saleData.sale_number
        saleDate = saleData.created_at
      }

      // Get sale items with product names
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('quantity, unit_price, subtotal, product_id, products(name, barcode)')
        .eq('sale_id', planData.sale_id)

      if (saleItems) {
        products = (saleItems as any[]).map(item => ({
          name: item.products?.name || item.product_id || 'Producto',
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          subtotal: Number(item.subtotal),
        }))
      }
    }

    // 4. Paid so far for this plan
    const paidSoFar = planInstallments.reduce((sum: number, i: any) => sum + i.paidAmount, 0)

    plans.push({
      saleNumber,
      saleDate,
      purchaseDescription: planData.legacy_purchase_description || undefined,
      products,
      originalTotal: planOriginal,
      paidSoFar,
      installments: planInstallments,
    })
  }

  return { plans, originalTotal, allInstallments }
}
