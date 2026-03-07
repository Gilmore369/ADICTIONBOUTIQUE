/**
 * API Route: Generate Sale Receipt PDF
 * 
 * Genera un PDF compacto del ticket de venta con código QR
 * Estilo similar a factura electrónica: sin espacios en blanco innecesarios
 * 
 * Soporta dos métodos de generación:
 * - puppeteer: Más completo pero puede tener problemas de compatibilidad
 * - jspdf: Más simple pero más compatible con visores de Windows
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateCompactReceiptPDF } from '@/lib/pdf/generate-compact-receipt'
import { generateSimpleReceiptPDF } from '@/lib/pdf/generate-simple-receipt'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    
    const {
      saleNumber,
      date,
      items,
      subtotal,
      discount,
      total,
      paymentType,
      clientName,
      storeName,
      storeAddress,
      storePhone,
      storeRuc,
      installments,
      installmentAmount,
      ticketUrl,
      method = 'jspdf' // Por defecto usar jspdf para mejor compatibilidad
    } = body

    // Validar datos requeridos
    if (!saleNumber || !items || items.length === 0) {
      console.error('[generate-pdf] Missing required data:', { saleNumber, itemsCount: items?.length })
      return NextResponse.json(
        { error: 'Datos incompletos: se requiere número de venta y productos' },
        { status: 400 }
      )
    }

    console.log('[generate-pdf] Generating PDF for sale:', saleNumber, 'using method:', method)

    // Generar URL del ticket para el QR si no se proporciona
    const finalTicketUrl = ticketUrl || `${request.nextUrl.origin}/tickets/${saleNumber}`

    const pdfData = {
      saleNumber,
      date: date || new Date().toISOString(),
      items,
      subtotal: subtotal || 0,
      discount: discount || 0,
      total: total || 0,
      paymentType: paymentType || 'CONTADO',
      clientName,
      storeName: storeName || 'ADICTION BOUTIQUE',
      storeAddress: storeAddress || 'Av. Principal 123, Trujillo',
      storePhone: storePhone || '(044) 555-9999',
      storeRuc: storeRuc || '20123456789',
      installments,
      installmentAmount,
      ticketUrl: finalTicketUrl
    }

    // Generar PDF usando el método seleccionado
    let pdfBuffer: Buffer
    
    if (method === 'puppeteer') {
      pdfBuffer = await generateCompactReceiptPDF(pdfData)
    } else {
      // Por defecto usar jspdf (más compatible)
      pdfBuffer = await generateSimpleReceiptPDF(pdfData)
    }

    console.log('[generate-pdf] PDF generated successfully, size:', pdfBuffer.length, 'bytes')

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
    console.error('[generate-pdf] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { error: 'Error al generar PDF', details: errorMessage },
      { status: 500 }
    )
  }
}
