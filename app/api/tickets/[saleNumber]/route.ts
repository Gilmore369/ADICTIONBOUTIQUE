/**
 * API Route: Get Ticket by Sale Number
 * 
 * Endpoint público para obtener información de un ticket de venta
 * Usado por el código QR para descargar tickets
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ saleNumber: string }> }
) {
  try {
    const params = await context.params
    const { saleNumber } = params

    if (!saleNumber) {
      return NextResponse.json(
        { error: 'Sale number is required' },
        { status: 400 }
      )
    }

    // Intentionally public: used by QR codes on printed receipts
    const supabase = await createServerClient()

    // Obtener información de la venta
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        id,
        sale_number,
        created_at,
        total,
        discount,
        sale_type,
        installments,
        store_id,
        client:clients(
          id,
          name,
          email
        )
      `)
      .eq('sale_number', saleNumber)
      .single()

    if (saleError || !sale) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Obtener items de la venta
    const { data: items, error: itemsError } = await supabase
      .from('sale_items')
      .select(`
        quantity,
        unit_price,
        subtotal,
        product:products(
          name
        )
      `)
      .eq('sale_id', sale.id)

    if (itemsError) {
      console.error('[tickets] Error fetching items:', itemsError)
      return NextResponse.json(
        { error: 'Error fetching ticket items' },
        { status: 500 }
      )
    }

    // Calcular subtotal
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)

    // Preparar respuesta
    const ticketData = {
      saleNumber: sale.sale_number,
      date: sale.created_at,
      items: items.map(item => ({
        quantity: item.quantity,
        name: item.product?.name || 'Producto',
        unit_price: item.unit_price,
        subtotal: item.subtotal
      })),
      subtotal,
      discount: sale.discount,
      total: sale.total,
      paymentType: sale.sale_type,
      clientName: sale.client?.name,
      clientEmail: sale.client?.email,
      installments: sale.installments,
      storeName: sale.store_id
    }

    return NextResponse.json({ data: ticketData })
  } catch (error) {
    console.error('[tickets] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
