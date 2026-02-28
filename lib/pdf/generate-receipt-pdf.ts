/**
 * Generate Receipt PDF
 * 
 * Genera un PDF del ticket de venta usando html2pdf
 * Este archivo se ejecuta en el cliente (navegador)
 */

import { formatCurrency } from '@/lib/utils/currency'

export interface ReceiptPDFData {
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
  storeName: string
  storeAddress: string
  storePhone: string
  storeRuc: string
}

/**
 * Genera HTML para el PDF del ticket
 */
export function generateReceiptPDFHTML(data: ReceiptPDFData): string {
  const itemsHTML = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; font-size: 11px;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 11px;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-family: monospace; font-size: 11px;">
        ${formatCurrency(item.unit_price)}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-family: monospace; font-size: 11px; font-weight: 600;">
        ${formatCurrency(item.subtotal)}
      </td>
    </tr>
  `).join('')

  const installmentsHTML = data.paymentType === 'CREDITO' && data.installments && data.installments > 1 ? `
    <tr style="background-color: #f5f5f5;">
      <td colspan="4" style="padding: 15px; border-top: 2px solid #d4a574;">
        <p style="margin: 0 0 10px 0; font-weight: 700; color: #1a1a1a; font-size: 12px;">PLAN DE CUOTAS (${data.installments} cuotas)</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 11px;">
          ${Array.from({ length: data.installments }, (_, i) => {
            const installmentAmount = data.total / data.installments
            const dueDate = new Date()
            dueDate.setMonth(dueDate.getMonth() + i + 1)
            return `
              <tr>
                <td style="padding: 5px 0; color: #666;">Cuota ${i + 1}:</td>
                <td style="padding: 5px 0; text-align: right; font-family: monospace; color: #1a1a1a; font-weight: 600;">
                  ${formatCurrency(installmentAmount)} - Vence: ${dueDate.toLocaleDateString('es-PE')}
                </td>
              </tr>
            `
          }).join('')}
        </table>
      </td>
    </tr>
  ` : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket de Venta ${data.saleNumber}</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: white;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: white;
    }
    .header {
      padding: 20px;
      background-color: #1a1a1a;
      text-align: center;
      border-bottom: 4px solid #d4a574;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .header p {
      margin: 8px 0 0 0;
      color: #b0b0b0;
      font-size: 12px;
    }
    .info {
      padding: 15px 20px;
      background-color: #f9f9f9;
      border-bottom: 1px solid #e5e7eb;
      font-size: 12px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .client-info {
      padding: 10px 20px;
      background-color: #f0f0f0;
      border-bottom: 1px solid #e5e7eb;
      font-size: 12px;
    }
    .items {
      padding: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead tr {
      background-color: #1a1a1a;
    }
    thead th {
      padding: 10px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #ffffff;
      border: none;
    }
    .totals {
      padding: 20px;
      background-color: #f9f9f9;
      border-top: 2px solid #e5e7eb;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .total-row.final {
      border-top: 2px solid #d4a574;
      padding-top: 10px;
      margin-top: 10px;
      font-size: 14px;
      font-weight: 700;
      color: #1a1a1a;
    }
    .footer {
      padding: 20px;
      text-align: center;
      background-color: #1a1a1a;
      color: #b0b0b0;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>${data.storeName}</h1>
      <p>TIENDA DE MODA</p>
    </div>

    <!-- Info -->
    <div class="info">
      <div class="info-row">
        <span><strong>Dirección:</strong> ${data.storeAddress}</span>
      </div>
      <div class="info-row">
        <span><strong>Teléfono:</strong> ${data.storePhone}</span>
        <span><strong>RUC:</strong> ${data.storeRuc}</span>
      </div>
      <div class="info-row">
        <span><strong>Ticket:</strong> <span style="font-family: monospace; font-weight: 700;">${data.saleNumber}</span></span>
        <span><strong>Fecha:</strong> ${new Date(data.date).toLocaleString('es-PE', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })}</span>
      </div>
      <div class="info-row">
        <span><strong>Forma de Pago:</strong> ${data.paymentType === 'CONTADO' ? 'EFECTIVO' : 'CRÉDITO'}</span>
      </div>
    </div>

    <!-- Cliente -->
    ${data.clientName ? `
    <div class="client-info">
      <strong>Cliente:</strong> ${data.clientName}
    </div>
    ` : ''}

    <!-- Items -->
    <div class="items">
      <table>
        <thead>
          <tr>
            <th style="text-align: center;">Cant.</th>
            <th>Descripción</th>
            <th style="text-align: right;">P. Unit.</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
    </div>

    <!-- Totales -->
    <div class="totals">
      <div class="total-row">
        <span>Subtotal:</span>
        <span style="font-family: monospace;">${formatCurrency(data.subtotal)}</span>
      </div>
      ${data.discount > 0 ? `
      <div class="total-row">
        <span>Descuento:</span>
        <span style="font-family: monospace; color: #d32f2f;">- ${formatCurrency(data.discount)}</span>
      </div>
      ` : ''}
      <div class="total-row final">
        <span>TOTAL A PAGAR:</span>
        <span style="font-family: monospace;">${formatCurrency(data.total)}</span>
      </div>

      ${installmentsHTML}
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 0;">¡Gracias por su preferencia!</p>
      <p style="margin: 5px 0 0 0; font-size: 11px;">Vuelva pronto a ADICTION BOUTIQUE</p>
    </div>
  </div>
</body>
</html>
  `
}
