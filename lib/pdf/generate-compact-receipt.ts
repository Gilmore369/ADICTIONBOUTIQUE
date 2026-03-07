/**
 * Generate Compact Receipt PDF
 * 
 * Genera un PDF compacto del ticket de venta similar a factura electrónica
 * - Sin espacios en blanco innecesarios
 * - Tamaño ajustado al contenido
 * - Código QR para descargar el ticket
 * - Logo de la empresa
 */

'use server'

import QRCode from 'qrcode'
import { formatCurrency } from '@/lib/utils/currency'

interface CompactReceiptData {
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
  storeName: string
  storeAddress: string
  storePhone: string
  storeRuc: string
  installments?: number
  installmentAmount?: number
  ticketUrl: string
}

/**
 * Genera el HTML del ticket compacto
 */
async function generateCompactHTML(data: CompactReceiptData): Promise<string> {
  // Generar código QR como data URL
  const qrDataUrl = await QRCode.toDataURL(data.ticketUrl, {
    width: 150,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  })

  const itemsHTML = data.items.map(item => `
    <tr>
      <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 10px;">${item.quantity}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px;">${item.name}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-family: 'Courier New', monospace; font-size: 10px;">
        ${formatCurrency(item.unit_price)}
      </td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-family: 'Courier New', monospace; font-size: 10px; font-weight: 600;">
        ${formatCurrency(item.subtotal)}
      </td>
    </tr>
  `).join('')

  const installmentsHTML = data.paymentType === 'CREDITO' && data.installments && data.installments > 1 ? `
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #d1d5db;">
      <p style="margin: 0 0 8px 0; font-weight: 700; font-size: 10px; text-align: center;">
        PLAN DE CUOTAS (${data.installments} cuotas)
      </p>
      <table style="width: 100%; font-size: 9px;">
        ${Array.from({ length: data.installments }, (_, i) => {
          const installmentAmount = data.total / data.installments
          const dueDate = new Date()
          dueDate.setMonth(dueDate.getMonth() + i + 1)
          return `
            <tr>
              <td style="padding: 3px 0;">Cuota ${i + 1}:</td>
              <td style="padding: 3px 0; text-align: right; font-family: 'Courier New', monospace;">
                ${formatCurrency(installmentAmount)} - ${dueDate.toLocaleDateString('es-PE')}
              </td>
            </tr>
          `
        }).join('')}
      </table>
    </div>
  ` : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket ${data.saleNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1a1a1a;
      background: white;
    }
    .container {
      width: 80mm;
      margin: 0 auto;
      padding: 8mm;
      background: white;
    }
    .header {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 2px solid #1a1a1a;
    }
    .logo {
      max-width: 60mm;
      height: auto;
      margin-bottom: 8px;
    }
    .store-name {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }
    .store-info {
      font-size: 9px;
      color: #4b5563;
      line-height: 1.3;
    }
    .ticket-info {
      background: #f9fafb;
      padding: 8px;
      margin-bottom: 12px;
      border-radius: 4px;
      font-size: 10px;
    }
    .ticket-info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .ticket-info-row:last-child {
      margin-bottom: 0;
    }
    .ticket-number {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      font-size: 11px;
    }
    .client-info {
      background: #fef3c7;
      padding: 6px 8px;
      margin-bottom: 12px;
      border-radius: 4px;
      font-size: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    thead {
      background: #1a1a1a;
      color: white;
    }
    thead th {
      padding: 6px 8px;
      text-align: left;
      font-size: 9px;
      font-weight: 700;
    }
    .totals {
      border-top: 2px solid #e5e7eb;
      padding-top: 8px;
      margin-bottom: 12px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 10px;
    }
    .total-row.final {
      border-top: 2px solid #1a1a1a;
      padding-top: 8px;
      margin-top: 8px;
      font-size: 13px;
      font-weight: 700;
    }
    .qr-section {
      text-align: center;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed #d1d5db;
    }
    .qr-code {
      width: 120px;
      height: 120px;
      margin: 8px auto;
    }
    .qr-text {
      font-size: 8px;
      color: #6b7280;
      margin-top: 4px;
    }
    .footer {
      text-align: center;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 2px solid #1a1a1a;
      font-size: 10px;
    }
    .footer-message {
      font-weight: 600;
      margin-bottom: 4px;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .container {
        width: 80mm;
        margin: 0;
        padding: 8mm;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="store-name">${data.storeName}</div>
      <div class="store-info">
        ${data.storeAddress}<br>
        Tel: ${data.storePhone}<br>
        RUC: ${data.storeRuc}
      </div>
    </div>

    <!-- Ticket Info -->
    <div class="ticket-info">
      <div class="ticket-info-row">
        <span><strong>TICKET:</strong></span>
        <span class="ticket-number">${data.saleNumber}</span>
      </div>
      <div class="ticket-info-row">
        <span><strong>FECHA:</strong></span>
        <span>${new Date(data.date).toLocaleString('es-PE', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })}</span>
      </div>
      <div class="ticket-info-row">
        <span><strong>PAGO:</strong></span>
        <span>${data.paymentType === 'CONTADO' ? 'EFECTIVO' : 'CRÉDITO'}</span>
      </div>
    </div>

    <!-- Client Info -->
    ${data.clientName ? `
    <div class="client-info">
      <strong>CLIENTE:</strong> ${data.clientName}
    </div>
    ` : ''}

    <!-- Items -->
    <table>
      <thead>
        <tr>
          <th style="text-align: center; width: 15%;">CANT</th>
          <th style="width: 45%;">DESCRIPCIÓN</th>
          <th style="text-align: right; width: 20%;">P.UNIT</th>
          <th style="text-align: right; width: 20%;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="total-row">
        <span>Subtotal:</span>
        <span style="font-family: 'Courier New', monospace;">${formatCurrency(data.subtotal)}</span>
      </div>
      ${data.discount > 0 ? `
      <div class="total-row">
        <span>Descuento:</span>
        <span style="font-family: 'Courier New', monospace; color: #dc2626;">- ${formatCurrency(data.discount)}</span>
      </div>
      ` : ''}
      <div class="total-row final">
        <span>TOTAL:</span>
        <span style="font-family: 'Courier New', monospace;">${formatCurrency(data.total)}</span>
      </div>
    </div>

    <!-- Installments -->
    ${installmentsHTML}

    <!-- QR Code -->
    <div class="qr-section">
      <div style="font-size: 9px; font-weight: 600; margin-bottom: 6px;">
        DESCARGA TU TICKET
      </div>
      <img src="${qrDataUrl}" alt="QR Code" class="qr-code" />
      <div class="qr-text">
        Escanea el código QR para descargar<br>
        tu ticket digital
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-message">¡Gracias por su preferencia!</div>
      <div style="font-size: 9px; color: #6b7280;">
        Vuelva pronto a ${data.storeName}
      </div>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Genera el PDF usando puppeteer
 */
export async function generateCompactReceiptPDF(data: CompactReceiptData): Promise<Buffer> {
  let browser = null
  try {
    const puppeteer = await import('puppeteer')
    
    // Configuración de puppeteer para Windows
    browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    })

    const page = await browser.newPage()
    const htmlContent = await generateCompactHTML(data)

    // Configurar viewport para el tamaño del ticket
    await page.setViewport({
      width: 302, // 80mm en pixels (80mm * 3.78 = 302px)
      height: 1200
    })

    await page.setContent(htmlContent, { 
      waitUntil: ['networkidle0', 'load'],
      timeout: 30000
    })

    // Esperar a que las imágenes se carguen
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => {
            img.onload = img.onerror = resolve
          }))
      )
    })

    // Generar PDF con tamaño ajustado al contenido (80mm de ancho)
    const pdfBuffer = await page.pdf({
      width: '80mm',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      },
      preferCSSPageSize: false
    })

    await browser.close()

    return Buffer.from(pdfBuffer)
  } catch (error) {
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error('[generateCompactReceiptPDF] Error closing browser:', closeError)
      }
    }
    console.error('[generateCompactReceiptPDF] Error:', error)
    throw new Error(`Error generating PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
