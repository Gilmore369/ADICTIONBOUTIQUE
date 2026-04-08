/**
 * API Route: Look up a sale by sale number
 *
 * GET /api/sales/[saleNumber]
 * Returns sale data needed for creating returns.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ saleNumber: string }> }
) {
  try {
    const supabase = await createServerClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { saleNumber } = await context.params

    if (!saleNumber) {
      return NextResponse.json({ error: 'Sale number is required' }, { status: 400 })
    }

    const { data: sale, error } = await supabase
      .from('sales')
      .select(`
        id,
        sale_number,
        client_id,
        clients(name),
        store_id,
        total,
        sale_type,
        created_at,
        voided,
        sale_items (
          id,
          product_id,
          quantity,
          unit_price,
          subtotal,
          products (
            id,
            name,
            barcode,
            size,
            color,
            base_name,
            base_code
          )
        )
      `)
      .eq('sale_number', saleNumber.toUpperCase())
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    }

    if (sale.voided) {
      return NextResponse.json({ error: 'La venta está anulada y no puede generar devolución' }, { status: 400 })
    }

    // Flatten client name from join
    const saleData = {
      ...sale,
      client_name: (sale.clients as any)?.name ?? null,
      clients: undefined,
    }

    return NextResponse.json({ success: true, data: saleData })
  } catch (error) {
    console.error('[sales/[saleNumber]] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
