/**
 * Send Receipt Email API Route
 * 
 * POST /api/sales/send-receipt
 * Sends sale receipt via email using Resend
 * 
 * Requirements: Email notification after sale
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, html } = body

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, html' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Development mode: Simulate email sending
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 [DEV] Simulating email send:', {
        to,
        subject,
        htmlLength: html.length
      })
      
      return NextResponse.json({
        success: true,
        data: { 
          id: 'dev-simulated-email-' + Date.now(),
          message: 'Email simulated in development mode'
        }
      })
    }

    // Production mode: Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured')
      return NextResponse.json(
        { error: 'Email service not configured. Please contact administrator.' },
        { status: 500 }
      )
    }

    // Production: Import Resend only when needed
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY!)

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'ventas@adictionboutique.com',
      to: [to],
      subject,
      html
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to send email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { id: data?.id }
    })
  } catch (error) {
    console.error('Error sending receipt email:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
