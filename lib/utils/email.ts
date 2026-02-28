/**
 * Email Utilities
 * 
 * Helper functions for sending emails (receipts, notifications, etc.)
 * Uses Resend API for email delivery
 */

import { formatCurrency } from './currency'

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
  storeName?: string
  storeAddress?: string
  storePhone?: string
  storeRuc?: string
}

/**
 * Generates HTML for receipt email
 */
function generateReceiptHTML(data: ReceiptEmailData): string {
  const {
    saleNumber,
    date,
    items,
    subtotal,
    discount,
    total,
    paymentType,
    clientName,
    storeName = 'ADICTION BOUTIQUE',
    storeAddress = 'Av. Principal 123, Trujillo',
    storePhone = '(044) 555-9999',
    storeRuc = '20123456789'
  } = data

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket de Venta - ${saleNumber}</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      max-width: 400px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .receipt {
      background-color: white;
      padding: 24px;
      border: 1px solid #ddd;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2px dashed #333;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 20px;
      font-weight: bold;
    }
    .header p {
      margin: 4px 0;
      font-size: 12px;
      color: #666;
    }
    .info {
      text-align: center;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 2px dashed #333;
      font-size: 12px;
    }
    .info .ticket-number {
      font-weight: bold;
      font-size: 14px;
      margin: 8px 0;
    }
    .items {
      margin-bottom: 16px;
    }
    .items-header {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid #333;
    }
    .item {
      margin-bottom: 12px;
      font-size: 12px;
    }
    .item-line {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .item-detail {
      font-size: 11px;
      color: #666;
      margin-left: 24px;
    }
    .totals {
      border-top: 2px dashed #333;
      padding-top: 16px;
      margin-bottom: 16px;
    }
    .total-line {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .total-line.final {
      font-size: 16px;
      font-weight: bold;
      border-top: 1px solid #333;
      padding-top: 8px;
      margin-top: 8px;
    }
    .payment {
      text-align: center;
      margin-bottom: 16px;
      padding: 12px 0;
      border-top: 2px dashed #333;
      border-bottom: 2px dashed #333;
      font-size: 12px;
    }
    .payment .method {
      font-weight: bold;
      margin-bottom: 4px;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #666;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 2px dashed #333;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>${storeName}</h1>
      <p>${storeAddress}</p>
      <p>Tel: ${storePhone}</p>
      <p>RUC: ${storeRuc}</p>
    </div>

    <div class="info">
      <p>${new Date(date).toLocaleString('es-PE')}</p>
      <p class="ticket-number">TICKET: ${saleNumber}</p>
      ${clientName ? `<p>Cliente: ${clientName}</p>` : ''}
    </div>

    <div class="items">
      <div class="items-header">
        <span>C. DESCRIPCIÓN</span>
        <span>TOTAL</span>
      </div>
      ${items.map(item => `
        <div class="item">
          <div class="item-line">
            <span>${item.quantity} ${item.name}</span>
            <span>${formatCurrency(item.subtotal, false)}</span>
          </div>
          <div class="item-detail">
            @ ${formatCurrency(item.unit_price)} c/u
          </div>
        </div>
      `).join('')}
    </div>

    <div class="totals">
      <div class="total-line">
        <span>Subtotal:</span>
        <span>${formatCurrency(subtotal)}</span>
      </div>
      ${discount > 0 ? `
        <div class="total-line">
          <span>Descuento:</span>
          <span>- ${formatCurrency(discount)}</span>
        </div>
      ` : ''}
      <div class="total-line final">
        <span>TOTAL A PAGAR:</span>
        <span>${formatCurrency(total)}</span>
      </div>
    </div>

    <div class="payment">
      <div class="method">
        F. PAGO: ${paymentType === 'CONTADO' ? 'EFECTIVO' : 'CRÉDITO'}
      </div>
      ${paymentType === 'CONTADO' ? `
        <p>RECIBIDO: ${formatCurrency(total, false)}</p>
        <p>VUELTO: 0.00</p>
      ` : ''}
    </div>

    <div class="footer">
      <p>¡Gracias por su preferencia!</p>
      <p>Vuelva pronto.</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Sends receipt email using Resend API
 * 
 * @param data - Receipt data
 * @returns Promise with success status
 */
export async function sendReceiptEmail(data: ReceiptEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const html = generateReceiptHTML(data)

    const response = await fetch('/api/sales/send-receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: data.to,
        subject: `Ticket de Venta - ${data.saleNumber}`,
        html
      })
    })

    const result = await response.json()

    if (!response.ok) {
      return { success: false, error: result.error || 'Error al enviar email' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error sending receipt email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}
