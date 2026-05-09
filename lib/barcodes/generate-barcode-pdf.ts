'use client'

/**
 * Generador de PDF de códigos de barra para impresión en A4.
 *
 * Layout: grilla de 3 columnas × 7 filas = 21 etiquetas por página A4.
 * Cada etiqueta incluye:
 *   - Código de barras Code128 (alta densidad, soporta letras y números)
 *   - Texto del código abajo
 *   - Nombre del producto (truncado)
 *   - Talla · Color
 *   - Precio
 *
 * El usuario imprime y recorta. Compatible con hojas adhesivas Avery L7163.
 */

import { jsPDF } from 'jspdf'
import JsBarcode from 'jsbarcode'

export interface BarcodeItem {
  barcode: string         // ej: "BIL-001-S-ROJO"
  name: string            // "Blusa Casual"
  size?: string | null    // "S"
  color?: string | null   // "Rojo"
  price?: number | null   // 89.90
  quantity: number        // cuántas etiquetas imprimir de este SKU
}

interface PdfOptions {
  title?: string          // título superior (ej: "Etiquetas — Lote 2026-05-09")
  layout?: 'standard' | 'compact'  // standard: 3×7 (21/pág), compact: 3×8 (24/pág)
  showPrice?: boolean
}

const A4_WIDTH = 210
const A4_HEIGHT = 297
const PAGE_MARGIN_X = 5
const PAGE_MARGIN_Y = 8

/**
 * Genera un canvas con el código de barras renderizado y devuelve el dataURL.
 * Usa Code128 que soporta letras + números + guiones (formato del sistema).
 */
function generateBarcodeDataURL(code: string, w = 200, h = 60): string {
  const canvas = document.createElement('canvas')
  try {
    JsBarcode(canvas, code, {
      format: 'CODE128',
      width: 2,
      height: h,
      displayValue: false, // nosotros pintamos el texto a mano
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    })
    return canvas.toDataURL('image/png')
  } catch (err) {
    // Si jsbarcode falla (p.ej. caracteres no soportados), devolver imagen vacía blanca
    console.warn('[barcode] Error generando', code, err)
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#000'
      ctx.font = '10px sans-serif'
      ctx.fillText('ERROR: ' + code, 4, 30)
    }
    return canvas.toDataURL('image/png')
  }
}

/**
 * Genera el PDF de etiquetas y dispara su descarga.
 * @param items lista de productos con cantidades — cada uno se replica `quantity` veces
 * @param options ajustes de layout
 */
export function generateBarcodePdf(items: BarcodeItem[], options: PdfOptions = {}): void {
  const { title, layout = 'standard', showPrice = true } = options

  // Expandir según cantidad: 1 etiqueta por unidad física
  const expanded: BarcodeItem[] = []
  for (const item of items) {
    const qty = Math.max(1, Math.floor(item.quantity || 1))
    for (let i = 0; i < qty; i++) {
      expanded.push(item)
    }
  }

  if (expanded.length === 0) {
    throw new Error('No hay productos para generar etiquetas')
  }

  // Layout grid
  const cols = 3
  const rows = layout === 'compact' ? 8 : 7
  const perPage = cols * rows

  const cellW = (A4_WIDTH - 2 * PAGE_MARGIN_X) / cols      // ≈ 66.67 mm
  const cellH = (A4_HEIGHT - 2 * PAGE_MARGIN_Y) / rows     // standard: 40.1 mm, compact: 35.1 mm

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  for (let i = 0; i < expanded.length; i++) {
    const item = expanded[i]
    const pageIdx = Math.floor(i / perPage)
    const cellIdx = i % perPage
    const col = cellIdx % cols
    const row = Math.floor(cellIdx / cols)

    if (cellIdx === 0 && pageIdx > 0) doc.addPage()

    const x = PAGE_MARGIN_X + col * cellW
    const y = PAGE_MARGIN_Y + row * cellH

    drawLabel(doc, item, x, y, cellW, cellH, showPrice)
  }

  // Título en footer de cada página (si se proporciona)
  if (title) {
    const pageCount = doc.getNumberOfPages()
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text(`${title}  ·  Pág ${p}/${pageCount}  ·  ${expanded.length} etiquetas`,
        A4_WIDTH / 2, A4_HEIGHT - 3, { align: 'center' })
    }
  }

  const filename = `etiquetas-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

/**
 * Dibuja una etiqueta individual: barcode + texto + nombre/talla/color/precio.
 */
function drawLabel(
  doc: jsPDF,
  item: BarcodeItem,
  x: number,
  y: number,
  w: number,
  h: number,
  showPrice: boolean,
): void {
  const padding = 2

  // Borde sutil para guía de corte (gris claro, no se imprime fuerte)
  doc.setDrawColor(220)
  doc.setLineWidth(0.1)
  doc.rect(x, y, w, h)

  // ── Barcode (canvas → PNG → embed) ──────────────────────────────────────
  const bcW = w - padding * 2
  const bcH = h * 0.45    // 45% de la altura para el código
  const bcX = x + padding
  const bcY = y + padding

  try {
    const dataUrl = generateBarcodeDataURL(item.barcode, 300, 80)
    doc.addImage(dataUrl, 'PNG', bcX, bcY, bcW, bcH)
  } catch (err) {
    doc.setFontSize(8)
    doc.setTextColor(200, 0, 0)
    doc.text('ERR: ' + item.barcode, bcX, bcY + 5)
  }

  // ── Código en texto debajo del barcode ──────────────────────────────────
  doc.setFont('courier', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0)
  doc.text(item.barcode, x + w / 2, bcY + bcH + 3, { align: 'center' })

  // ── Info del producto ───────────────────────────────────────────────────
  let textY = bcY + bcH + 7

  // Nombre (truncado al ancho disponible)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  const maxChars = Math.floor(w / 1.5) // estimación
  const name = item.name.length > maxChars ? item.name.slice(0, maxChars - 1) + '…' : item.name
  doc.text(name, x + w / 2, textY, { align: 'center' })
  textY += 3.2

  // Talla · Color
  const meta: string[] = []
  if (item.size) meta.push(item.size)
  if (item.color) meta.push(item.color)
  if (meta.length > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(80)
    doc.text(meta.join(' · '), x + w / 2, textY, { align: 'center' })
    textY += 3
  }

  // Precio
  if (showPrice && item.price != null && item.price > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(0)
    doc.text(`S/ ${Number(item.price).toFixed(2)}`, x + w / 2, textY, { align: 'center' })
  }
}
