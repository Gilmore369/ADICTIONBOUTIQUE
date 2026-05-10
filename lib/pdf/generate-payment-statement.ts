/**
 * Generate Payment Statement PDF — Adiction Boutique
 *
 * PDF profesional de estado de cuenta que incluye:
 *   - Logo + cabecera de la tienda
 *   - Datos del cliente
 *   - Resumen del pago recibido
 *   - Por cada plan de crédito: productos comprados + cuotas PENDIENTES/PARCIALES
 *   - Las cuotas pagadas NO se listan (el cliente las ve en historial de compras)
 *   - Próxima fecha de pago
 */

import jsPDF from 'jspdf'
import fs from 'fs'
import path from 'path'

export interface InstallmentRow {
  number: number
  dueDate: string        // YYYY-MM-DD
  amount: number
  paidAmount: number
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'VOIDED' | string
}

export interface ProductRow {
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface PlanSection {
  saleNumber?: string     // 'V-0022'
  saleDate?: string       // ISO date
  purchaseDescription?: string  // para planes legacy sin venta
  products: ProductRow[]
  originalTotal: number
  paidSoFar: number
  installments: InstallmentRow[]   // TODAS — el PDF filtra PAID
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
  // Totales globales del cliente
  originalTotal: number
  totalPaid: number
  remainingBalance: number
  // Próxima fecha de pago
  nextDueDate?: string
  notes?: string
  // Logo de la tienda
  logoBase64?: string
  // Desglose por plan (cada crédito = una sección con sus productos y cuotas)
  plans: PlanSection[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────
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
function statusLabel(s: string) {
  if (s === 'PAID') return 'PAGADA'
  if (s === 'PARTIAL') return 'PARCIAL'
  if (s === 'VOIDED') return 'ANULADA'
  return 'PENDIENTE'
}
function statusColor(s: string): [number, number, number] {
  if (s === 'PAID') return [22, 101, 52]
  if (s === 'PARTIAL') return [180, 83, 9]
  if (s === 'VOIDED') return [100, 100, 100]
  return [30, 64, 175]
}

// ── Helpers de dibujo ─────────────────────────────────────────────────────────
function checkPageBreak(doc: jsPDF, y: number, needed: number, pageH: number, margin: number): number {
  if (y + needed > pageH - 20) {
    doc.addPage()
    return margin + 6
  }
  return y
}

// ── Main ─────────────────────────────────────────────────────────────────────
export async function generatePaymentStatementPDF(data: PaymentStatementData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const margin = 14
  const contentW = pageW - margin * 2
  let y = margin

  // ── LOGO ──────────────────────────────────────────────────────────────────
  // Detecta MIME real desde magic bytes del buffer
  function detectMime(buf: Buffer): 'JPEG' | 'PNG' | 'WEBP' {
    if (buf[0] === 0xFF && buf[1] === 0xD8) return 'JPEG'
    if (buf[0] === 0x89 && buf[1] === 0x50) return 'PNG'
    if (buf[4] === 0x57 && buf[5] === 0x45) return 'WEBP'
    return 'JPEG' // fallback seguro
  }

  let logoB64: string | null = null
  let logoMime: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG'
  try {
    if (data.logoBase64?.startsWith('data:')) {
      // data-URL desde Supabase: data:image/jpeg;base64,XXXX
      const match = data.logoBase64.match(/^data:(image\/[\w+]+);base64,(.+)$/)
      if (match) {
        const rawMime = match[1].replace('image/', '').toUpperCase()
        logoMime = rawMime === 'PNG' ? 'PNG' : rawMime === 'WEBP' ? 'WEBP' : 'JPEG'
        logoB64 = match[2]
      }
    } else if (data.logoBase64?.startsWith('http')) {
      const mod = data.logoBase64.startsWith('https') ? await import('https') : await import('http')
      const imgBuf = await new Promise<Buffer>((res, rej) => {
        (mod as any).get(data.logoBase64!, (r: any) => {
          const c: Buffer[] = []
          r.on('data', (d: Buffer) => c.push(d))
          r.on('end', () => res(Buffer.concat(c)))
          r.on('error', rej)
        }).on('error', rej)
      })
      logoMime = detectMime(imgBuf)
      logoB64 = imgBuf.toString('base64')
    } else {
      // Fallback: logo estático del filesystem (puede ser JPEG renombrado como .png)
      const p = path.join(process.cwd(), 'public', 'images', 'logo.png')
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p)
        logoMime = detectMime(buf)   // ← detecta JPEG aunque la extensión sea .png
        logoB64 = buf.toString('base64')
        console.log(`[pdf-logo] Loaded local logo: ${buf.length} bytes, detected MIME: ${logoMime}`)
      } else {
        console.warn('[pdf-logo] No logo found at', p)
      }
    }
  } catch (e) {
    console.warn('[pdf-logo] Failed to load logo:', e)
  }

  // ── HEADER ────────────────────────────────────────────────────────────────
  const hasLogo = !!logoB64
  const headerH = hasLogo ? 54 : 36
  doc.setFillColor(17, 24, 39)
  doc.rect(0, 0, pageW, headerH, 'F')
  doc.setFillColor(212, 165, 116)
  doc.rect(0, headerH, pageW, 1.5, 'F')

  if (logoB64) {
    const lSize = 22
    doc.addImage(logoB64, logoMime, (pageW - lSize) / 2, 4, lSize, lSize)
  }
  const tY = hasLogo ? 31 : 12
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('ADICTION BOUTIQUE', pageW / 2, tY, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(212, 165, 116)
  doc.text('ESTADO DE CUENTA — CONFIRMACIÓN DE PAGO', pageW / 2, tY + 7, { align: 'center' })
  doc.setTextColor(156, 163, 175)
  doc.setFontSize(7.5)
  doc.text(`Emitido: ${fmtDateTime(data.paymentDate)}`, pageW / 2, tY + 14, { align: 'center' })

  y = headerH + 8

  // ── DATOS DEL CLIENTE ─────────────────────────────────────────────────────
  doc.setFillColor(249, 250, 251)
  doc.setDrawColor(229, 231, 235)
  doc.roundedRect(margin, y, contentW, 26, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(107, 114, 128)
  doc.text('DATOS DEL CLIENTE', margin + 4, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text(data.clientName.toUpperCase(), margin + 4, y + 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(75, 85, 99)
  const clientMeta = [
    data.clientDni ? `DNI: ${data.clientDni}` : null,
    data.clientPhone ? `Tel: ${data.clientPhone}` : null,
    data.clientEmail || null,
  ].filter(Boolean).join('  ·  ')
  doc.text(clientMeta, margin + 4, y + 20)

  y += 32

  // ── PAGO RECIBIDO ─────────────────────────────────────────────────────────
  doc.setFillColor(240, 253, 244)
  doc.setDrawColor(187, 247, 208)
  doc.roundedRect(margin, y, contentW, 28, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(22, 101, 52)
  doc.text('✓  PAGO RECIBIDO', margin + 4, y + 7)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(21, 128, 61)
  doc.text(money(data.amountPaid), pageW / 2, y + 17, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(74, 222, 128)
  const methodDisplay = METHOD_LABEL[data.paymentMethod?.toUpperCase()] ?? data.paymentMethod ?? 'Efectivo'
  doc.text(`${fmtDateTime(data.paymentDate)}  ·  ${methodDisplay}`, pageW / 2, y + 24, { align: 'center' })

  y += 34

  // ── 4 CAJAS RESUMEN ───────────────────────────────────────────────────────
  const pct = data.originalTotal > 0
    ? Math.min(100, Math.round((data.totalPaid / data.originalTotal) * 100))
    : 0
  const bW = (contentW - 6) / 4
  const boxes = [
    { label: 'Monto Total', value: money(data.originalTotal), color: [55, 65, 81] as [number,number,number] },
    { label: 'Total Pagado', value: money(data.totalPaid), color: [21, 128, 61] as [number,number,number] },
    { label: 'Saldo Pendiente', value: money(data.remainingBalance), color: data.remainingBalance > 0 ? [180, 83, 9] as [number,number,number] : [21, 128, 61] as [number,number,number] },
    { label: 'Próximo Pago', value: data.nextDueDate ? fmtDate(data.nextDueDate) : '—', color: [30, 64, 175] as [number,number,number] },
  ]
  boxes.forEach((box, i) => {
    const bx = margin + i * (bW + 2)
    doc.setFillColor(249, 250, 251)
    doc.setDrawColor(229, 231, 235)
    doc.roundedRect(bx, y, bW, 21, 2, 2, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(107, 114, 128)
    doc.text(box.label, bx + bW / 2, y + 6, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...box.color)
    doc.text(box.value, bx + bW / 2, y + 14, { align: 'center' })
  })
  y += 27

  // ── BARRA DE PROGRESO ─────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(55, 65, 81)
  doc.text(`Progreso general: ${pct}%`, margin, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(107, 114, 128)
  doc.text(`${money(data.totalPaid)} pagado de ${money(data.originalTotal)}`, pageW - margin, y + 4, { align: 'right' })
  y += 7
  doc.setFillColor(229, 231, 235)
  doc.roundedRect(margin, y, contentW, 4.5, 2, 2, 'F')
  if (pct > 0) {
    doc.setFillColor(21, 128, 61)
    doc.roundedRect(margin, y, contentW * (pct / 100), 4.5, 2, 2, 'F')
  }
  y += 12

  // ── SECCIONES POR PLAN DE CRÉDITO ─────────────────────────────────────────
  const rowH = 7.5
  const colCuota   = { x: margin,      w: 12 }
  const colVenc    = { x: margin + 12, w: 26 }
  const colMonto   = { x: margin + 38, w: 26 }
  const colPagado  = { x: margin + 64, w: 26 }
  const colPend    = { x: margin + 90, w: 28 }
  const colEstado  = { x: margin + 118, w: 64 }

  for (const plan of data.plans) {
    const pendingInsts = plan.installments.filter(i => i.status !== 'PAID' && i.status !== 'VOIDED')
    const paidCount    = plan.installments.filter(i => i.status === 'PAID').length
    const totalInsts   = plan.installments.filter(i => i.status !== 'VOIDED').length

    // Estimar espacio: encabezado + productos + tabla cuotas pendientes
    const neededApprox = 22 + (plan.products.length * 6) + 10 + (pendingInsts.length * rowH) + 20
    y = checkPageBreak(doc, y, Math.min(neededApprox, 60), pageH, margin)

    // ── Plan header ──────────────────────────────────────────────────────────
    doc.setFillColor(17, 24, 39)
    doc.roundedRect(margin, y, contentW, 13, 2, 2, 'F')

    const planTitle = plan.saleNumber
      ? `Venta ${plan.saleNumber}`
      : plan.purchaseDescription
        ? `Deuda: ${plan.purchaseDescription.substring(0, 45)}`
        : 'Crédito'

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(212, 165, 116)
    doc.text(planTitle, margin + 4, y + 8)

    if (plan.saleDate) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(156, 163, 175)
      doc.text(fmtDate(plan.saleDate), pageW - margin - 4, y + 8, { align: 'right' })
    }

    // Cuotas completadas info
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(156, 163, 175)
    const planProgress = `${paidCount}/${totalInsts} cuotas pagadas  ·  Total: ${money(plan.originalTotal)}  ·  Pagado: ${money(plan.paidSoFar)}`
    // (se muestra en el sub-header, abajo)

    y += 15

    // ── Productos de esta compra ──────────────────────────────────────────────
    if (plan.products.length > 0) {
      y = checkPageBreak(doc, y, 10 + plan.products.length * 6, pageH, margin)

      doc.setFillColor(243, 244, 246)
      doc.setDrawColor(229, 231, 235)
      doc.rect(margin, y, contentW, 8, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(55, 65, 81)
      doc.text('PRODUCTOS COMPRADOS', margin + 3, y + 5.5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(107, 114, 128)
      doc.text(`${paidCount}/${totalInsts} cuotas pagadas`, pageW - margin - 3, y + 5.5, { align: 'right' })

      y += 8

      for (const prod of plan.products) {
        y = checkPageBreak(doc, y, 7, pageH, margin)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(55, 65, 81)
        const prodName = prod.name.length > 55 ? prod.name.substring(0, 52) + '...' : prod.name
        doc.text(`• ${prodName}`, margin + 3, y + 5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(17, 24, 39)
        doc.text(`${prod.quantity} × ${money(prod.unitPrice)} = ${money(prod.subtotal)}`, pageW - margin - 3, y + 5, { align: 'right' })
        doc.setDrawColor(243, 244, 246)
        doc.line(margin, y + 7, margin + contentW, y + 7)
        y += 7
      }
      y += 2
    } else if (plan.purchaseDescription) {
      // Sin productos detallados (legacy) — mostrar descripción
      y = checkPageBreak(doc, y, 12, pageH, margin)
      doc.setFillColor(254, 249, 240)
      doc.setDrawColor(253, 230, 138)
      doc.roundedRect(margin, y, contentW, 10, 1, 1, 'FD')
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7.5)
      doc.setTextColor(107, 114, 128)
      doc.text(`Compra: ${plan.purchaseDescription}`, margin + 4, y + 7)
      y += 14
    }

    // ── Cuotas pendientes / parciales ─────────────────────────────────────────
    if (pendingInsts.length === 0) {
      // Plan completamente pagado — solo mostrar resumen
      y = checkPageBreak(doc, y, 10, pageH, margin)
      doc.setFillColor(240, 253, 244)
      doc.setDrawColor(187, 247, 208)
      doc.roundedRect(margin, y, contentW, 9, 1, 1, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(22, 101, 52)
      doc.text('✓ Crédito completamente pagado', pageW / 2, y + 6, { align: 'center' })
      y += 14
      continue
    }

    // Header de tabla
    y = checkPageBreak(doc, y, rowH + 4, pageH, margin)
    doc.setFillColor(30, 41, 59)
    doc.rect(margin, y, contentW, rowH, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(255, 255, 255)
    doc.text('N°', colCuota.x + 2, y + 5)
    doc.text('Vencimiento', colVenc.x + 2, y + 5)
    doc.text('Monto cuota', colMonto.x + 2, y + 5)
    doc.text('Ya pagado', colPagado.x + 2, y + 5)
    doc.text('Pendiente', colPend.x + 2, y + 5)
    doc.text('Estado', colEstado.x + 2, y + 5)
    y += rowH

    pendingInsts.forEach((inst, idx) => {
      y = checkPageBreak(doc, y, rowH, pageH, margin)
      const isEven = idx % 2 === 0
      doc.setFillColor(isEven ? 249 : 255, isEven ? 250 : 255, isEven ? 251 : 255)
      doc.rect(margin, y, contentW, rowH, 'F')
      doc.setDrawColor(229, 231, 235)
      doc.line(margin, y + rowH, margin + contentW, y + rowH)

      const pending = Math.max(0, inst.amount - inst.paidAmount)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(55, 65, 81)
      doc.text(String(inst.number), colCuota.x + 2, y + 5)
      doc.text(fmtDate(inst.dueDate), colVenc.x + 2, y + 5)
      doc.text(money(inst.amount), colMonto.x + 2, y + 5)

      if (inst.paidAmount > 0) doc.setTextColor(21, 128, 61)
      doc.text(money(inst.paidAmount), colPagado.x + 2, y + 5)

      doc.setTextColor(185, 28, 28)
      doc.text(money(pending), colPend.x + 2, y + 5)

      // Badge estado
      const [sr, sg, sb] = statusColor(inst.status)
      doc.setFillColor(sr, sg, sb)
      const bx = colEstado.x + 2
      doc.roundedRect(bx, y + 1.5, 22, 4.5, 1, 1, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5.5)
      doc.text(statusLabel(inst.status), bx + 11, y + 4.8, { align: 'center' })

      y += rowH
    })

    y += 6
  }

  // ── PRÓXIMO PAGO / COMPLETADO ──────────────────────────────────────────────
  y = checkPageBreak(doc, y, 22, pageH, margin)
  if (data.remainingBalance <= 0) {
    doc.setFillColor(17, 24, 39)
    doc.roundedRect(margin, y, contentW, 18, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(212, 165, 116)
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
    doc.text(`Saldo pendiente total: ${money(data.remainingBalance)}  ·  ¡Gracias por mantener tu cuenta al día!`, margin + 4, y + 14)
    y += 24
  }

  // ── NOTAS ──────────────────────────────────────────────────────────────────
  if (data.notes) {
    y = checkPageBreak(doc, y, 8, pageH, margin)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.setTextColor(107, 114, 128)
    doc.text(data.notes, margin, y)
    y += 8
  }

  // ── FOOTER (en cada página) ────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    const fY = pageH - 16
    doc.setFillColor(17, 24, 39)
    doc.rect(0, fY, pageW, 16, 'F')
    doc.setFillColor(212, 165, 116)
    doc.rect(0, fY, pageW, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(212, 165, 116)
    doc.text('ADICTION BOUTIQUE', pageW / 2, fY + 6, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(107, 114, 128)
    doc.text(`Trujillo, La Libertad — Perú  ·  Página ${p} de ${totalPages}`, pageW / 2, fY + 12, { align: 'center' })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
