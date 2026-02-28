/**
 * Generate PDF API Route
 * 
 * Generates a PDF ticket for a sale
 */

import { generateTicketPDF } from '@/lib/email/generate-ticket-pdf'

interface TicketItem {
  quantity: number
  name: string
  unit_price: number
  subtotal: number
}

interface GeneratePDFRequest {
  saleNumber: string
  date: string
  items: TicketItem[]
  subtotal: number
  discount: number
  total: number
  paymentType: 'CONTADO' | 'CREDITO'
  clientName?: string
  storeName: string
  storeAddress: string
  storePhone: string
  storeRuc: string
  installments?: number
  installmentAmount?: number
}

export async function POST(request: Request) {
  try {
    const data: GeneratePDFRequest = await request.json()

    // Generate PDF
    const pdfBuffer = await generateTicketPDF(data)

    // Return PDF as response
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Ticket_${data.saleNumber}.pdf"`
      }
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error generating PDF'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
