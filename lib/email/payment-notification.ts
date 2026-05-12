/**
 * Payment Notification Email — Adiction Boutique
 *
 * Genera el HTML del correo que se envía al cliente cuando se registra
 * un cobro (visita de cobranza o pago directo).
 *
 * Incluye:
 *   - Logo / cabecera de Adiction Boutique
 *   - Detalle del pago recibido
 *   - Descripción de la deuda original
 *   - Saldo pendiente
 *   - Próxima fecha de pago estimada
 */

import { formatDatePeru, getTodayPeru, normalizeDateOnlyPeru } from '@/lib/utils/timezone'

export interface PaymentNotificationData {
  clientName: string
  clientEmail: string
  amountPaid: number
  paymentMethod: string       // EFECTIVO, YAPE, etc.
  paymentDate: string         // ISO string
  purchaseDescription?: string // Descripción de la compra original
  originalTotal?: number
  totalPaid?: number           // Total pagado (incluyendo este pago)
  remainingBalance: number
  nextDueDate?: string         // Próxima fecha de pago (ISO date YYYY-MM-DD)
  receiptProofUrl?: string     // URL foto del voucher (opcional)
  notes?: string
  pdfBuffer?: Buffer           // PDF adjunto generado externamente
}

// ── Formateadores ─────────────────────────────────────────────────────────────
function formatMoney(n: number): string {
  return `S/ ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function formatDate(iso: string): string {
  return formatDatePeru(iso, { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ── Estimar próxima fecha de pago: primer día del mes siguiente ───────────────
export function estimateNextPaymentDate(fromDate?: string): string {
  const [year, month] = normalizeDateOnlyPeru(fromDate || getTodayPeru()).split('-').map(Number)
  // Primer día del mes que sigue
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
}

// ── Generar HTML del email ────────────────────────────────────────────────────
export function generatePaymentNotificationHTML(data: PaymentNotificationData): string {
  const nextPayDate = data.nextDueDate
    ? formatDate(data.nextDueDate)
    : formatDate(estimateNextPaymentDate(data.paymentDate))

  const methodLabel: Record<string, string> = {
    EFECTIVO: 'Efectivo',
    YAPE: 'Yape',
    PLIN: 'Plin',
    TRANSFERENCIA: 'Transferencia bancaria',
    TARJETA: 'Tarjeta',
    BCP: 'BCP',
    INTERBANK: 'Interbank',
    BBVA: 'BBVA',
    OTRO: 'Otro medio',
  }
  const methodDisplay = methodLabel[data.paymentMethod?.toUpperCase()] ?? data.paymentMethod ?? 'Efectivo'

  const progressPct = data.originalTotal && data.originalTotal > 0
    ? Math.min(100, Math.round(((data.totalPaid ?? data.amountPaid) / data.originalTotal) * 100))
    : null

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Pago — Adiction Boutique</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.10);">

          <!-- HEADER -->
          <tr>
            <td style="background:#111827;padding:36px 32px;text-align:center;border-bottom:4px solid #d4a574;">
              <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:2px;text-transform:uppercase;">
                ADICTION BOUTIQUE
              </div>
              <div style="font-size:12px;color:#d4a574;margin-top:6px;letter-spacing:1px;">
                Confirmación de Pago Recibido
              </div>
            </td>
          </tr>

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <p style="margin:0;font-size:16px;color:#111827;">Hola, <strong>${data.clientName}</strong></p>
              <p style="margin:8px 0 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                Hemos registrado correctamente tu pago. A continuación encontrarás el detalle completo.
              </p>
            </td>
          </tr>

          <!-- PAYMENT AMOUNT — destacado -->
          <tr>
            <td style="padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:8px;">
                <tr>
                  <td style="padding:20px 24px;text-align:center;">
                    <div style="font-size:13px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
                      Pago Recibido
                    </div>
                    <div style="font-size:42px;font-weight:800;color:#15803d;font-variant-numeric:tabular-nums;line-height:1;">
                      ${formatMoney(data.amountPaid)}
                    </div>
                    <div style="font-size:13px;color:#4ade80;margin-top:8px;">
                      ${formatDateTime(data.paymentDate)} · ${methodDisplay}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- DETAIL TABLE -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="background:#f9fafb;">
                  <td style="padding:12px 16px;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;" colspan="2">
                    Detalle de tu cuenta
                  </td>
                </tr>
                ${data.purchaseDescription ? `
                <tr>
                  <td style="padding:12px 16px;font-size:13px;color:#6b7280;width:45%;border-bottom:1px solid #f3f4f6;">Compra</td>
                  <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:500;border-bottom:1px solid #f3f4f6;">${data.purchaseDescription}</td>
                </tr>` : ''}
                ${data.originalTotal ? `
                <tr>
                  <td style="padding:12px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Monto original</td>
                  <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:500;font-variant-numeric:tabular-nums;border-bottom:1px solid #f3f4f6;">${formatMoney(data.originalTotal)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:12px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Este pago</td>
                  <td style="padding:12px 16px;font-size:13px;color:#15803d;font-weight:700;font-variant-numeric:tabular-nums;border-bottom:1px solid #f3f4f6;">+ ${formatMoney(data.amountPaid)}</td>
                </tr>
                <tr style="background:#fef9f0;">
                  <td style="padding:14px 16px;font-size:14px;color:#92400e;font-weight:700;border-bottom:1px solid #fde68a;">Saldo pendiente</td>
                  <td style="padding:14px 16px;font-size:14px;color:#b45309;font-weight:800;font-variant-numeric:tabular-nums;border-bottom:1px solid #fde68a;">${formatMoney(data.remainingBalance)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-size:13px;color:#6b7280;">Próximo pago</td>
                  <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:500;">${nextPayDate}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${progressPct !== null ? `
          <!-- PROGRESS BAR -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:600;">
                Progreso de pago: ${progressPct}%
              </div>
              <div style="background:#e5e7eb;border-radius:999px;height:10px;overflow:hidden;">
                <div style="background:#15803d;width:${progressPct}%;height:10px;border-radius:999px;"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:#9ca3af;">
                <span>S/ 0</span>
                <span>${formatMoney(data.originalTotal!)}</span>
              </div>
            </td>
          </tr>` : ''}

          ${data.remainingBalance <= 0 ? `
          <!-- FULLY PAID -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:8px;">
                <tr>
                  <td style="padding:18px 24px;text-align:center;">
                    <div style="font-size:20px;margin-bottom:6px;">🎉</div>
                    <div style="font-size:15px;font-weight:700;color:#d4a574;">¡Deuda cancelada completamente!</div>
                    <div style="font-size:13px;color:#9ca3af;margin-top:4px;">Gracias por cumplir con tu compromiso. ¡Eres un cliente excelente!</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : `
          <!-- REMINDER -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
                <tr>
                  <td style="padding:14px 20px;">
                    <p style="margin:0;font-size:13px;color:#92400e;">
                      <strong>📅 Próxima fecha de pago:</strong> ${nextPayDate}
                    </p>
                    <p style="margin:6px 0 0 0;font-size:12px;color:#a16207;">
                      Saldo pendiente: <strong>${formatMoney(data.remainingBalance)}</strong>. ¡Gracias por mantener tu cuenta al día!
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`}

          ${data.notes ? `
          <!-- NOTES -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;font-style:italic;">${data.notes}</p>
            </td>
          </tr>` : ''}

          <!-- FOOTER -->
          <tr>
            <td style="background:#111827;padding:24px 32px;text-align:center;border-top:4px solid #d4a574;">
              <p style="margin:0;font-size:13px;color:#d4a574;font-weight:600;">ADICTION BOUTIQUE</p>
              <p style="margin:6px 0 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
                Trujillo, La Libertad — Perú<br>
                Este correo es una confirmación automática de pago.<br>
                Si tienes dudas, contacta a tu asesor de ventas.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`
}

// ── Enviar email vía Resend ───────────────────────────────────────────────────
export async function sendPaymentNotificationEmail(
  data: PaymentNotificationData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn('[payment-email] RESEND_API_KEY not configured — skipping email')
      return { success: false, error: 'Email not configured' }
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'ventas@adictionboutique.agsys.es'
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)

    const html = generatePaymentNotificationHTML(data)
    const subject = data.remainingBalance <= 0
      ? `✅ Pago completado — Deuda cancelada — Adiction Boutique`
      : `✅ Pago registrado S/ ${data.amountPaid.toFixed(2)} — Saldo: S/ ${data.remainingBalance.toFixed(2)}`

    // Adjuntar PDF si viene en los datos
    const attachments: Array<{ filename: string; content: Buffer }> = []
    if (data.pdfBuffer) {
      attachments.push({
        filename: `Estado_Cuenta_${data.clientName.replace(/\s+/g, '_')}.pdf`,
        content: data.pdfBuffer,
      })
    }

    const { error } = await resend.emails.send({
      from: `Adiction Boutique <${fromEmail}>`,
      to: data.clientEmail,
      subject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    })

    if (error) {
      console.error('[payment-email] Resend error:', error)
      return { success: false, error: String(error) }
    }

    console.log(`[payment-email] Sent via Resend to ${data.clientEmail} — amount: ${data.amountPaid}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[payment-email] Error sending notification:', msg)
    return { success: false, error: msg }
  }
}
