/**
 * Receipt Email Template
 * 
 * Plantilla profesional de correo para tickets de venta
 * Colores: Negro (#1a1a1a) y oro (#d4a574)
 */

import { formatCurrency } from '@/lib/utils/currency'

interface ReceiptEmailData {
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
}

export function generateReceiptEmailHTML(data: ReceiptEmailData): string {
  const itemsHTML = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0;">${item.name}</td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: 'Courier New', monospace;">
        ${formatCurrency(item.unit_price)}
      </td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: 'Courier New', monospace; font-weight: 600;">
        ${formatCurrency(item.subtotal)}
      </td>
    </tr>
  `
    )
    .join('')

  const installmentsHTML =
    data.paymentType === 'CREDITO' && data.installments && data.installmentAmount
      ? `
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; margin-top: 15px;">
      <p style="margin: 0 0 10px 0; font-weight: 700; color: #1a1a1a; font-size: 13px;">PLAN DE CUOTAS (${data.installments} cuotas)</p>
      <table style="width: 100%; font-size: 12px;">
        ${Array.from({ length: data.installments }, (_, i) => {
          const dueDate = new Date()
          dueDate.setMonth(dueDate.getMonth() + i + 1)
          return `
            <tr>
              <td style="padding: 5px 0; color: #666;">Cuota ${i + 1}:</td>
              <td style="padding: 5px 0; text-align: right; font-family: 'Courier New', monospace; color: #1a1a1a; font-weight: 600;">
                ${formatCurrency(data.installmentAmount)} - Vence: ${dueDate.toLocaleDateString('es-PE')}
              </td>
            </tr>
          `
        }).join('')}
      </table>
    </div>
  `
      : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket de Venta ${data.saleNumber}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f7fafc;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      background-color: #1a1a1a;
      padding: 40px 20px;
      text-align: center;
      color: white;
      border-bottom: 4px solid #d4a574;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .header p {
      margin: 8px 0 0 0;
      font-size: 13px;
      opacity: 0.95;
      line-height: 1.6;
    }
    .content {
      padding: 30px 20px;
    }
    .ticket-info {
      background-color: #f7fafc;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 25px;
      border-left: 4px solid #d4a574;
    }
    .ticket-info p {
      margin: 6px 0;
      color: #1a1a1a;
      font-size: 13px;
    }
    .ticket-number {
      font-size: 16px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    thead {
      background-color: #1a1a1a;
      border-bottom: 2px solid #d4a574;
    }
    thead th {
      padding: 12px 8px;
      text-align: left;
      font-weight: 700;
      color: #d4a574;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    tbody tr:hover {
      background-color: #f7fafc;
    }
    .totals-section {
      margin-top: 25px;
      padding-top: 15px;
      border-top: 2px solid #e2e8f0;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      font-size: 14px;
      color: #1a1a1a;
    }
    .total-row.discount {
      color: #c53030;
    }
    .total-row.final {
      padding: 15px 0;
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
      border-top: 2px solid #d4a574;
      border-bottom: 2px solid #d4a574;
    }
    .payment-info {
      background-color: #f7fafc;
      padding: 15px;
      border-radius: 6px;
      margin-top: 20px;
      text-align: center;
      border-left: 4px solid #d4a574;
    }
    .payment-info p {
      margin: 6px 0;
      color: #1a1a1a;
      font-size: 13px;
    }
    .payment-type {
      font-weight: 700;
      color: #1a1a1a;
      font-size: 14px;
    }
    .footer {
      background-color: #1a1a1a;
      color: #d4a574;
      padding: 20px;
      text-align: center;
      font-size: 12px;
    }
    .footer p {
      margin: 0;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>${data.storeName}</h1>
      <p>${data.storeAddress}</p>
      <p>Tel: ${data.storePhone} | RUC: ${data.storeRuc}</p>
    </div>

    <!-- Content -->
    <div class="content">
      <!-- Ticket Info -->
      <div class="ticket-info">
        <div class="ticket-number">TICKET: ${data.saleNumber}</div>
        <p>
          <strong>Fecha:</strong> ${new Date(data.date).toLocaleString('es-PE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
        ${data.clientName ? `<p><strong>Cliente:</strong> ${data.clientName}</p>` : ''}
      </div>

      <!-- Items Table -->
      <table>
        <thead>
          <tr>
            <th style="width: 10%; text-align: center;">Cant.</th>
            <th style="width: 50%;">Descripción</th>
            <th style="width: 20%; text-align: right;">P. Unit.</th>
            <th style="width: 20%; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <!-- Totals -->
      <div class="totals-section">
        <div class="total-row">
          <span>Subtotal:</span>
          <span style="font-family: 'Courier New', monospace;">${formatCurrency(data.subtotal)}</span>
        </div>
        ${
          data.discount > 0
            ? `
          <div class="total-row discount">
            <span>Descuento:</span>
            <span style="font-family: 'Courier New', monospace;">- ${formatCurrency(data.discount)}</span>
          </div>
        `
            : ''
        }
        <div class="total-row final">
          <span>TOTAL A PAGAR:</span>
          <span style="font-family: 'Courier New', monospace;">${formatCurrency(data.total)}</span>
        </div>
      </div>

      <!-- Payment Info -->
      <div class="payment-info">
        <p class="payment-type">
          Forma de Pago: ${data.paymentType === 'CONTADO' ? 'EFECTIVO' : 'CRÉDITO'}
        </p>
      </div>

      <!-- Installments (only for credit) -->
      ${installmentsHTML}
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>¡Gracias por su preferencia!</p>
      <p>Vuelva pronto a ${data.storeName}</p>
    </div>
  </div>
</body>
</html>
  `
}
