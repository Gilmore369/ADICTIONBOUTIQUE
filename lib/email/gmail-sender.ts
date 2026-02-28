/**
 * Gmail Email Sender
 * 
 * Envía correos usando SMTP de Gmail
 * Requiere contraseña de aplicación (no la contraseña normal)
 */

import nodemailer from 'nodemailer'

// Crear transporte de Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD
  }
})

export async function sendEmailViaGmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD) {
      return {
        success: false,
        error: 'Gmail credentials not configured'
      }
    }

    const result = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      html
    })

    console.log('Email sent via Gmail:', result.messageId)
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error sending email via Gmail:', errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}
