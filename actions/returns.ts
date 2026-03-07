'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getReturnsAction() {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('returns')
    .select(`
      *,
      clients (
        id,
        name,
        dni
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching returns:', error)
    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: data || [] }
}

export async function createReturnAction(formData: {
  saleId: string
  saleNumber: string
  clientId: string | null
  clientName: string
  storeId: string
  reason: string
  reasonType: string
  returnType: 'REEMBOLSO' | 'CAMBIO'
  totalAmount: number
  returnedItems: any[]
  exchangeItems?: any[]
  notes?: string
}) {
  const supabase = await createServerClient()

  // Generar número de devolución
  const { data: returnNumber } = await supabase.rpc('generate_return_number')

  const { data, error } = await supabase
    .from('returns')
    .insert({
      sale_id: formData.saleId,
      sale_number: formData.saleNumber,
      client_id: formData.clientId,
      client_name: formData.clientName,
      store_id: formData.storeId,
      return_number: returnNumber,
      reason: formData.reason,
      reason_type: formData.reasonType,
      return_type: formData.returnType,
      total_amount: formData.totalAmount,
      returned_items: formData.returnedItems,
      exchange_items: formData.exchangeItems || [],
      notes: formData.notes,
      status: 'PENDIENTE'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating return:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/returns')
  return { success: true, data }
}

export async function approveReturnAction(returnId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('returns')
    .update({
      status: 'APROBADA',
      approved_at: new Date().toISOString()
    })
    .eq('id', returnId)
    .select()
    .single()

  if (error) {
    console.error('Error approving return:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/returns')
  return { success: true, data }
}

export async function rejectReturnAction(returnId: string, adminNotes: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('returns')
    .update({
      status: 'RECHAZADA',
      admin_notes: adminNotes
    })
    .eq('id', returnId)
    .select()
    .single()

  if (error) {
    console.error('Error rejecting return:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/returns')
  return { success: true, data }
}

export async function completeReturnAction(returnId: string, refundAmount?: number) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('returns')
    .update({
      status: 'COMPLETADA',
      refund_amount: refundAmount || 0
    })
    .eq('id', returnId)
    .select()
    .single()

  if (error) {
    console.error('Error completing return:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/returns')
  return { success: true, data }
}

export async function requestExtensionAction(returnId: string, extensionReason: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('returns')
    .update({
      extension_requested: true,
      extension_reason: extensionReason
    })
    .eq('id', returnId)
    .select()
    .single()

  if (error) {
    console.error('Error requesting extension:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/returns')
  return { success: true, data }
}

export async function grantExtensionAction(returnId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('returns')
    .update({
      extension_granted: true,
      extension_date: new Date().toISOString()
    })
    .eq('id', returnId)
    .select()
    .single()

  if (error) {
    console.error('Error granting extension:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/returns')
  return { success: true, data }
}

export async function checkReturnEligibilityAction(saleId: string) {
  const supabase = await createServerClient()

  const { data, error } = await supabase.rpc('check_return_eligibility', {
    p_sale_id: saleId
  })

  if (error) {
    console.error('Error checking eligibility:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}
