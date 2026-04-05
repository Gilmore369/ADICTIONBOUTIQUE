/**
 * Inventory Stock Adjustment API
 * POST /api/inventory/adjust
 *
 * Adjusts stock for a product in a warehouse and records the movement.
 * Types: ENTRADA (add), SALIDA (remove), AJUSTE (set absolute value)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { product_id, warehouse_id, type, quantity, reason, notes } = body

  if (!product_id || !warehouse_id || !type || quantity == null) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }
  if (!['ENTRADA', 'SALIDA', 'AJUSTE'].includes(type)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }
  const qty = Number(quantity)
  if (isNaN(qty) || qty < 0) {
    return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
  }

  // Get current stock
  const { data: stockRow, error: stockErr } = await supabase
    .from('stock')
    .select('quantity')
    .eq('product_id', product_id)
    .eq('warehouse_id', warehouse_id)
    .maybeSingle()

  if (stockErr) return NextResponse.json({ error: stockErr.message }, { status: 500 })

  const currentQty = stockRow ? Number(stockRow.quantity) : 0
  let newQty: number
  let movementQty: number

  if (type === 'ENTRADA') {
    newQty = currentQty + qty
    movementQty = qty
  } else if (type === 'SALIDA') {
    if (qty > currentQty) {
      return NextResponse.json(
        { error: `Stock insuficiente. Disponible: ${currentQty}` },
        { status: 400 }
      )
    }
    newQty = currentQty - qty
    movementQty = qty
  } else {
    // AJUSTE: set absolute value
    newQty = qty
    movementQty = Math.abs(qty - currentQty)
  }

  // Upsert stock
  const { error: upsertErr } = await supabase
    .from('stock')
    .upsert({ product_id, warehouse_id, quantity: newQty }, { onConflict: 'product_id,warehouse_id' })

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  // Insert movement record
  const { error: movErr } = await supabase
    .from('movements')
    .insert({
      product_id,
      warehouse_id,
      type,
      quantity: movementQty,
      reference: reason || null,
      notes: notes || null,
      user_id: user.id,
    })

  if (movErr) {
    console.warn('[adjust] Movement insert failed:', movErr.message)
    // Don't fail — stock was already updated
  }

  return NextResponse.json({ success: true, previous: currentQty, current: newQty })
}
