/**
 * Email Server Actions
 * 
 * Server actions for sending emails including:
 * - Sale receipt email with PDF attachment
 * - Professional design with installment details
 * 
 * Requirements: Email notification after sale
 */

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { generateReceiptEmailHTML } from '@/lib/email/receipt-email-template'
import { generateTicketPDF } from '@/lib/email/generate-ticket-pdf'

/**
 * Standard response type for server actions
 */
type ActionResponse<T = any> = {
  success: boolean
  data?: T
  error?: string
}

interface ReceiptEmailData {
  to: string
  saleNumber: string
  date: string
  items: Array<{
    quantity: number
    name: string
    unit_price: number
    subtotal: number
  }>
  subtotal: number
  discount: number
  total: number
  paymentType: 'CONTADO' | 'CREDITO'
  clientName?: string
  installments?: number
  installmentAmount?: number
  storeName: string
  storeAddress: string
  storePhone: string
  storeRuc: string
  logoUrl?: string
}

/**
 * Sends sale receipt via email with PDF attachment
 * 
 * Features:
 * - Professional HTML email template
 * - PDF attachment with ticket
 * - Installment details for credit sales
 * - Supports Resend and Gmail
 * 
 * @param data - Receipt data to send
 * @returns ActionResponse with success status
 */
export async function sendReceiptEmail(
  data: ReceiptEmailData
): Promise<ActionResponse> {
  try {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.to)) {
      return { success: false, error: 'Email inválido' }
    }

    // Generate HTML email content
    const htmlContent = generateReceiptEmailHTML(data)

    // Generate PDF
    let pdfBuffer: Buffer | null = null
    try {
      pdfBuffer = await generateTicketPDF(data)
      console.log('PDF generated successfully')
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError)
      // Continuar sin PDF si hay error
    }

    // Opción 1: Usar Resend (si está configurado)
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)

        const emailOptions: any = {
          from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to: data.to,
          subject: `Ticket de Venta ${data.saleNumber}`,
          html: htmlContent
        }

        // Agregar PDF si se generó correctamente
        if (pdfBuffer) {
          emailOptions.attachments = [
            {
              filename: `Ticket_${data.saleNumber}.pdf`,
              content: pdfBuffer.toString('base64')
            }
          ]
        }

        const result = await resend.emails.send(emailOptions)

        if (result.error) {
          console.error('Resend error:', result.error)
          // Continuar con Gmail si Resend falla
        } else {
          console.log('Email sent via Resend:', result.data?.id)
          return {
            success: true,
            data: {
              message: 'Email enviado exitosamente',
              to: data.to,
              id: result.data?.id
            }
          }
        }
      } catch (error) {
        console.error('Error with Resend:', error)
        // Continuar con Gmail
      }
    }

    // Opción 2: Usar Gmail SMTP (si está configurado)
    if (process.env.GMAIL_USER && process.env.GMAIL_PASSWORD) {
      try {
        const nodemailer = await import('nodemailer')
        const transporter = nodemailer.default.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASSWORD
          }
        })

        const mailOptions: any = {
          from: process.env.GMAIL_USER,
          to: data.to,
          subject: `Ticket de Venta ${data.saleNumber}`,
          html: htmlContent
        }

        // Agregar PDF si se generó correctamente
        if (pdfBuffer) {
          mailOptions.attachments = [
            {
              filename: `Ticket_${data.saleNumber}.pdf`,
              content: pdfBuffer
            }
          ]
        }

        const result = await transporter.sendMail(mailOptions)

        console.log('Email sent via Gmail:', result.messageId)
        return {
          success: true,
          data: {
            message: 'Email enviado exitosamente',
            to: data.to,
            id: result.messageId
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Error sending email via Gmail:', errorMessage)
        return {
          success: false,
          error: `Error al enviar email: ${errorMessage}`
        }
      }
    }

    // Opción 3: Modo desarrollo (simular)
    console.warn('No email service configured, simulating email send')
    console.log('Email would be sent to:', data.to)
    console.log('Subject:', `Ticket de Venta ${data.saleNumber}`)
    console.log('PDF attached:', pdfBuffer ? 'Yes' : 'No')

    return {
      success: true,
      data: {
        message: 'Email enviado exitosamente (simulado)',
        to: data.to
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error sending email:', error)
    return {
      success: false,
      error: `Error al enviar email: ${errorMessage}`
    }
  }
}
