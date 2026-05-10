/**
 * Generate Payment Statement PDF — Adiction Boutique
 *
 * Genera un PDF profesional con:
 *   - Logo de la tienda
 *   - Datos del cliente
 *   - Resumen del pago registrado
 *   - Estado de cuenta completo (todas las cuotas)
 *   - Barra de progreso
 *   - Próxima fecha de pago
 */

import jsPDF from 'jspdf'
import fs from 'fs'
import path from 'path'

export interface InstallmentRow {
  number: number         // Nro de cuota
  dueDate: string        // YYYY-MM-DD
  amount: number
  paidAmount: number
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'VOIDED' | string
}

export interface PaymentStatementData {
  clientName: string
  clientDni?: string
  clientPhone?: string
  clientEmail?: string
  // Pago actual
  amountPaid: number
  paymentMethod: string
  paymentDate: string     // ISO
  // Deuda general
  originalTotal: number
  totalPaid: number       // acumulado INCLUYENDO este pago
  remainingBalance: number
  purchaseDescription?: string
  // Cuotas (todas, para mostrar tabla completa)
  installments: InstallmentRow[]
  // Próxima fecha de pago (ISO YYYY-MM-DD o undefined)
  nextDueDate?: string
  notes?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function money(n: number): string {
  return `S/ ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00-05:00')
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' })
  } catch { return iso }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

const METHOD_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta',
  BCP: 'BCP', INTERBANK: 'Interbank', BBVA: 'BBVA', OTRO: 'Otro',
}

function statusLabel(s: string): string {
  if (s === 'PAID') return 'PAGADA'
  if (s === 'PARTIAL') return 'PARCIAL'
  if (s === 'VOIDED') return 'ANULADA'
  return 'PENDIENTE'
}

function statusColor(s: string): [number, number, number] {
  if (s === 'PAID') return [22, 101, 52]       // green
  if (s === 'PARTIAL') return [180, 83, 9]     // amber
  if (s === 'VOIDED') return [100, 100, 100]   // gray
  return [30, 64, 175]                          // blue PENDING
}

// ── Main generator ─────────────────────────────────────────────────────────────
export async function generatePaymentStatementPDF(data: PaymentStatementData): Promise<Buffer> {
  // A4 portrait
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const margin = 16
  const contentW = pageW - margin * 2
  let y = margin

  // ── LOGO ────────────────────────────────────────────────────────────────────
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logo.png')
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath)
      const logoB64 = logoData.toString('base64')
      const logoH = 18
      const logoW = 18
      doc.addImage(logoB64, 'PNG', margin, y, logoW, logoH)
    }
  } catch { /* logo opcional */ }

  // ── HEADER TEXT ────────────────────────────────────────────────────────────
  doc.setFillColor(17, 24, 39)
  doc.rect(0, 0, pageW, 36, 'F')
  // Gold accent line
  doc.setFillColor(212, 165, 116)
  doc.rect(0, 36, pageW, 1.2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('ADICTION BOUTIQUE', pageW / 2, 14, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(212, 165, 116)
  doc.text('ESTADO DE CUENTA — CONFIRMACIÓN DE PAGO', pageW / 2, 21, { align: 'center' })
  doc.setTextColor(156, 163, 175)
  doc.setFontSize(8)
  doc.text(`Fecha de emisión: ${fmtDateTime(data.paymentDate)}`, pageW / 2, 28, { align: 'center' })

  y = 44

  // ── DATOS DEL CLIENTE ──────────────────────────────────────────────────────
  doc.setFillColor(249, 250, 251)
  doc.roundedRect(margin, y, contentW, 28, 2, 2, 'F')
  doc.setDrawColor(229, 231, 235)
  doc.roundedRect(margin, y, contentW, 28, 2, 2, 'S')

  doc.setTextColor(107, 114, 128)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('DATOS DEL CLIENTE', margin + 4, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text(data.clientName.toUpperCase(), margin + 4, y + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(75, 85, 99)
  const clientDetails: string[] = []
  if (data.clientDni) clientDetails.push(`DNI: ${data.clientDni}`)
  if (data.clientPhone) clientDetails.push(`Tel: ${data.clientPhone}`)
  if (data.clientEmail) clientDetails.push(data.clientEmail)
  doc.text(clientDetails.join('   ·   '), margin + 4, y + 20)

  // Nro de documento en esquina derecha
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(17, 24, 39)
  const docLabel = 'Estado de Cuenta'
  doc.text(docLabel, pageW - margin - 4, y + 10, { align: 'right' })

  y += 34

  // ── PAGO REGISTRADO (highlight box) ────────────────────────────────────────
  doc.setFillColor(240, 253, 244)
  doc.roundedRect(margin, y, contentW, 30, 2, 2, 'F')
  doc.setDrawColor(187, 247, 208)
  doc.roundedRect(margin, y, contentW, 30, 2, 2, 'S')

  // "PAGO RECIBIDO" label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(22, 101, 52)
  doc.text('✓ PAGO RECIBIDO', margin + 4, y + 7)

  // Monto grande centrado
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(21, 128, 61)
  doc.text(money(data.amountPaid), pageW / 2, y + 17, { align: 'center' })

  // Método + fecha
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(74, 222, 128)
  const methodDisplay = METHOD_LABEL[data.paymentMethod?.toUpperCase()] ?? data.paymentMethod ?? 'Efectivo'
  doc.text(`${fmtDateTime(data.paymentDate)}  ·  ${methodDisplay}`, pageW / 2, y + 24, { align: 'center' })

  y += 36

  // ── RESUMEN FINANCIERO (4 cajas) ───────────────────────────────────────────
  const boxW = (contentW - 6) / 4
  const boxes = [
    { label: 'Monto Original', value: money(data.originalTotal), color: [55, 65, 81] as [number,number,number] },
    { label: 'Total Pagado', value: money(data.totalPaid), color: [21, 128, 61] as [number,number,number] },
    { label: 'Saldo Pendiente', value: money(data.remainingBalance), color: data.remainingBalance > 0 ? [180, 83, 9] as [number,number,number] : [21, 128, 61] as [number,number,number] },
    { label: 'Próximo Pago', value: data.nextDueDate ? fmtDate(data.nextDueDate) : '—', color: [30, 64, 175] as [number,number,number] },
  ]

  boxes.forEach((box, i) => {
    const bx = margin + i * (boxW + 2)
    doc.setFillColor(249, 250, 251)
    doc.roundedRect(bx, y, boxW, 22, 2, 2, 'F')
    doc.setDrawColor(229, 231, 235)
    doc.roundedRect(bx, y, boxW, 22, 2, 2, 'S')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(107, 114, 128)
    doc.text(box.label, bx + boxW / 2, y + 6, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...box.color)
    doc.text(box.value, bx + boxW / 2, y + 14, { align: 'center' })
  })

  y += 28

  // ── BARRA DE PROGRESO ──────────────────────────────────────────────────────
  const pct = data.originalTotal > 0
    ? Math.min(100, Math.round((data.totalPaid / data.originalTotal) * 100))
    : 0
  const barW = contentW
  const barH = 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(55, 65, 81)
  doc.text(`Progreso de pago: ${pct}%`, margin, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(107, 114, 128)
  doc.text(`${money(data.totalPaid)} de ${money(data.originalTotal)}`, pageW - margin, y + 4, { align: 'right' })

  y += 7
  // Track (gray)
  doc.setFillColor(229, 231, 235)
  doc.roundedRect(margin, y, barW, barH, 2, 2, 'F')
  // Fill (green)
  if (pct > 0) {
    doc.setFillColor(21, 128, 61)
    doc.roundedRect(margin, y, barW * (pct / 100), barH, 2, 2, 'F')
  }

  y += 12

  // ── DESCRIPCIÓN DE COMPRA (si aplica) ──────────────────────────────────────
  if (data.purchaseDescription) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    doc.text(`Compra: ${data.purchaseDescription}`, margin, y)
    y += 6
  }

  // ── TABLA DE CUOTAS ────────────────────────────────────────────────────────
  y += 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(17, 24, 39)
  doc.text('DETALLE DE CUOTAS', margin, y + 4)

  y += 8

  // Header row
  const cols = [
    { label: 'Cuota', x: margin,      w: 14 },
    { label: 'Vencimiento', x: margin + 14, w: 28 },
    { label: 'Monto',   x: margin + 42, w: 28 },
    { label: 'Pagado',  x: margin + 70, w: 28 },
    { label: 'Pendiente', x: margin + 98, w: 30 },
    { label: 'Estado',  x: margin + 128, w: 30 },
  ]

  const rowH = 8
  // Header bg
  doc.setFillColor(17, 24, 39)
  doc.rect(margin, y, contentW, rowH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  cols.forEach(col => {
    doc.text(col.label, col.x + 2, y + 5.5)
  })

  y += rowH

  // Rows
  const activeInstallments = data.installments.filter(i => i.status !== 'VOIDED')
  activeInstallments.forEach((inst, idx) => {
    const isEven = idx % 2 === 0
    if (isEven) {
      doc.setFillColor(249, 250, 251)
      doc.rect(margin, y, contentW, rowH, 'F')
    } else {
      doc.setFillColor(255, 255, 255)
      doc.rect(margin, y, contentW, rowH, 'F')
    }

    // Border bottom
    doc.setDrawColor(229, 231, 235)
    doc.line(margin, y + rowH, margin + contentW, y + rowH)

    const pending = Math.max(0, inst.amount - inst.paidAmount)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(55, 65, 81)
    doc.text(String(inst.number), cols[0].x + 2, y + 5.5)
    doc.text(fmtDate(inst.dueDate), cols[1].x + 2, y + 5.5)
    doc.text(money(inst.amount), cols[2].x + 2, y + 5.5)

    // Pagado en verde si > 0
    if (inst.paidAmount > 0) doc.setTextColor(21, 128, 61)
    doc.text(money(inst.paidAmount), cols[3].x + 2, y + 5.5)
    doc.setTextColor(55, 65, 81)

    // Pendiente en rojo si > 0
    if (pending > 0) doc.setTextColor(185, 28, 28)
    doc.text(money(pending), cols[4].x + 2, y + 5.5)
    doc.setTextColor(55, 65, 81)

    // Badge de estado
    const [sr, sg, sb] = statusColor(inst.status)
    doc.setFillColor(sr, sg, sb)
    const badgeX = cols[5].x + 2
    const badgeW = 22
    const badgeH = 4.5
    doc.roundedRect(badgeX, y + 1.8, badgeW, badgeH, 1, 1, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.text(statusLabel(inst.status), badgeX + badgeW / 2, y + 5, { align: 'center' })
    doc.setTextColor(55, 65, 81)

    y += rowH

    // Nueva página si queda poco espacio
    if (y > pageH - 40) {
      doc.addPage()
      y = margin + 10
    }
  })

  y += 6

  // ── PRÓXIMO PAGO / COMPLETADO ──────────────────────────────────────────────
  if (data.remainingBalance <= 0) {
    doc.setFillColor(17, 24, 39)
    doc.roundedRect(margin, y, contentW, 18, 2, 2, 'F')
    doc.setTextColor(212, 165, 116)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('🎉 ¡Deuda cancelada completamente!', pageW / 2, y + 8, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(156, 163, 175)
    doc.text('Gracias por cumplir con tu compromiso. ¡Eres un cliente excelente!', pageW / 2, y + 14, { align: 'center' })
    y += 24
  } else if (data.nextDueDate) {
    doc.setFillColor(255, 251, 235)
    doc.setDrawColor(253, 230, 138)
    doc.roundedRect(margin, y, contentW, 18, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(146, 64, 14)
    doc.text(`📅 Próxima fecha de pago: ${fmtDate(data.nextDueDate)}`, margin + 4, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(161, 98, 7)
    doc.text(`Saldo pendiente: ${money(data.remainingBalance)}  ·  ¡Gracias por mantener tu cuenta al día!`, margin + 4, y + 14)
    y += 24
  }

  // ── NOTAS ──────────────────────────────────────────────────────────────────
  if (data.notes) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(107, 114, 128)
    doc.text(data.notes, margin, y)
    y += 8
  }

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  const footerY = pageH - 18
  doc.setFillColor(17, 24, 39)
  doc.rect(0, footerY, pageW, 18, 'F')
  doc.setFillColor(212, 165, 116)
  doc.rect(0, footerY, pageW, 1, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(212, 165, 116)
  doc.text('ADICTION BOUTIQUE', pageW / 2, footerY + 6, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(107, 114, 128)
  doc.text('Trujillo, La Libertad — Perú  ·  Documento generado automáticamente', pageW / 2, footerY + 12, { align: 'center' })

  // Retornar como Buffer
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
