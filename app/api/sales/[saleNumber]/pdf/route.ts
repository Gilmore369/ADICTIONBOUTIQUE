/**
 * API Route: Download Sale Receipt PDF by Sale Number
 * 
 * Endpoint directo para descargar PDF con nombre correcto en la URL
 * Formato: /api/sales/V-0001/pdf
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateSimpleReceiptPDF } from '@/lib/pdf/generate-simple-receipt'

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

    console.log('[pdf-download] Fetching sale:', saleNumber)

    // Obtener datos de la venta desde la base de datos
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    // ── Auth check ──────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sale, error } = await supabase
      .from('sales')
      .select(`
        *,
        clients (
          id,
          name,
          email
        ),
        sale_items (
          id,
          quantity,
          unit_price,
          subtotal,
          products (
            name
          )
        )
      `)
      .eq('sale_number', saleNumber)
      .single()

    if (error || !sale) {
      console.error('[pdf-download] Sale not found:', error)
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      )
    }

    console.log('[pdf-download] Sale data:', {
      sale_type: sale.sale_type,
      installments: sale.installments,
      total: sale.total
    })

    // Preparar datos para el PDF
    const pdfData = {
      saleNumber: sale.sale_number,
      date: sale.created_at,
      items: sale.sale_items.map((item: any) => ({
        quantity: item.quantity,
        name: item.products?.name || 'Producto',
        unit_price: item.unit_price,
        subtotal: item.subtotal
      })),
      subtotal: sale.subtotal,
      discount: sale.discount || 0,
      total: sale.total,
      paymentType: sale.sale_type,
      clientName: sale.clients?.name,
      storeName: 'ADICTION BOUTIQUE',
      storeAddress: 'Av. Principal 123, Trujillo',
      storePhone: '(044) 555-9999',
      storeRuc: '20123456789',
      installments: sale.sale_type === 'CREDITO' ? (sale.installments || 6) : undefined,
      ticketUrl: `${request.nextUrl.origin}/tickets/${sale.sale_number}`
    }

    console.log('[pdf-download] Generating PDF for sale:', saleNumber)

    // Generar PDF
    const pdfBuffer = await generateSimpleReceiptPDF(pdfData)

    console.log('[pdf-download] PDF generated successfully, size:', pdfBuffer.length, 'bytes')

    // Retornar PDF con headers correctos para descarga
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Ticket_${saleNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('[pdf-download] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { error: 'Error al generar PDF', details: errorMessage },
      { status: 500 }
    )
  }
}
