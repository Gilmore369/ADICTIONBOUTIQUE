/**
 * Generate Simple Receipt PDF using jsPDF
 * 
 * Alternativa más compatible para Windows que usa jsPDF
 * en lugar de Puppeteer para mejor compatibilidad con visores PDF
 * Diseño compacto sin espacios en blanco innecesarios
 */

import QRCode from 'qrcode'
import { formatCurrency } from '@/lib/utils/currency'
import { PERU_TZ } from '@/lib/utils/timezone'
import fs from 'fs'
import path from 'path'
import jsPDF from 'jspdf'

interface SimpleReceiptData {
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
  ticketUrl: string
}

export async function generateSimpleReceiptPDF(data: SimpleReceiptData): Promise<Buffer> {
  try {
    // Calcular altura aproximada del contenido - EXTRA LARGO para evitar recortes
    let estimatedHeight = 50 // Margen inicial EXTRA grande
    
    // Logo (si existe) - EXTRA espacio para separación clara
    estimatedHeight += 110
    
    // Header (nombre tienda + dirección + teléfono/RUC) - EXTRA espacio
    estimatedHeight += 85
    
    // Info del ticket (fecha + número + cliente) - EXTRA espacio
    estimatedHeight += data.clientName ? 80 : 70
    
    // Tabla de productos - EXTRA espacio entre filas
    // Header de tabla: 35pt (texto + líneas)
    // Cada producto: ~33pt (nombre + precio unitario + espacio)
    estimatedHeight += 35 + (data.items.length * 33) + 10
    
    // Totales (subtotal + descuento + total + forma de pago) - EXTRA espacio
    estimatedHeight += data.discount > 0 ? 130 : 120
    
    // Cuotas (si aplica) - EXTRA espacio
    if (data.paymentType === 'CREDITO' && data.installments) {
      // Header cuotas + cada cuota + espacios EXTRA
      const numInstallments = data.installments > 1 ? data.installments : 6 // Default 6 cuotas si no está especificado
      estimatedHeight += 60 + (numInstallments * 18)
    }
    
    // QR + footer - EXTRA espacio
    // Línea + título + QR (60pt) + texto + línea + gracias + vuelva pronto
    estimatedHeight += 200
    
    console.log('[PDF] Altura estimada:', estimatedHeight, 'puntos')

    // Crear documento PDF (80mm de ancho = 226 puntos, altura dinámica)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: [226, Math.ceil(estimatedHeight)] // Altura dinámica calculada
    })

    let yPos = 40 // Margen inicial EXTRA grande

    // Intentar cargar el logo
    let logoDataUrl: string | null = null
    try {
      const logoPath = path.join(process.cwd(), 'public', 'images', 'logo.png')
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath)
        const logoBase64 = logoBuffer.toString('base64')
        logoDataUrl = `data:image/png;base64,${logoBase64}`
        console.log('[PDF] Logo cargado exitosamente')
      } else {
        console.log('[PDF] Logo no encontrado en:', logoPath)
      }
    } catch (error) {
      console.error('[PDF] Error cargando logo:', error)
    }

    // Logo (si existe) - centrado y con EXTRA espacio
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', 73, yPos, 80, 40)
        yPos += 90 // EXTRA espacio después del logo para separación CLARA
      } catch (error) {
        console.error('[PDF] Error agregando logo al PDF:', error)
        yPos += 20
      }
    } else {
      yPos += 20
    }

    // Header - Nombre de la tienda (debajo del logo con EXTRA espacio)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(data.storeName, 113, yPos, { align: 'center' })
    yPos += 28

    // Información de la tienda
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(data.storeAddress, 113, yPos, { align: 'center' })
    yPos += 18
    doc.text(`Tel: ${data.storePhone} | RUC: ${data.storeRuc}`, 113, yPos, { align: 'center' })
    yPos += 28

    // Línea separadora delgada
    doc.setLineWidth(0.5)
    doc.line(10, yPos, 216, yPos)
    yPos += 22

    // Información del ticket
    doc.setFontSize(8)
    const dateStr = new Date(data.date).toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: PERU_TZ,
    })
    
    doc.setFont('helvetica', 'normal')
    doc.text(`${dateStr}`, 10, yPos)
    yPos += 20
    
    doc.setFont('helvetica', 'bold')
    doc.text('TICKET:', 10, yPos)
    doc.setFont('courier', 'bold')
    doc.text(data.saleNumber, 216, yPos, { align: 'right' })
    yPos += 20

    // Cliente (si existe)
    if (data.clientName) {
      doc.setFont('helvetica', 'bold')
      doc.text('Cliente:', 10, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(data.clientName, 216, yPos, { align: 'right' })
      yPos += 20
    }

    // Línea separadora
    doc.setLineWidth(0.5)
    doc.line(10, yPos, 216, yPos)
    yPos += 20

    // Header de tabla (sin fondo negro, solo texto)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('C.', 15, yPos)
    doc.text('DESCRIPCIÓN', 35, yPos)
    doc.text('TOTAL', 216, yPos, { align: 'right' })
    yPos += 15

    // Línea separadora después del header
    doc.setLineWidth(0.5)
    doc.line(10, yPos, 216, yPos)
    yPos += 15

    // Items de la venta (sin tabla, texto directo)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    
    data.items.forEach((item) => {
      // Cantidad y nombre del producto
      doc.text(item.quantity.toString(), 15, yPos, { align: 'center' })
      doc.text(item.name, 35, yPos)
      doc.text(formatCurrency(item.subtotal), 216, yPos, { align: 'right' })
      yPos += 15
      
      // Precio unitario (más pequeño, debajo del nombre)
      doc.setFontSize(7)
      doc.setTextColor(100, 100, 100)
      doc.text(`@ ${formatCurrency(item.unit_price)} c/u`, 35, yPos)
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(8)
      yPos += 18
    })

    yPos += 5

    // Línea separadora
    doc.setLineWidth(0.5)
    doc.line(10, yPos, 216, yPos)
    yPos += 22

    // Totales
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Subtotal:', 10, yPos)
    doc.setFont('courier', 'normal')
    doc.text(formatCurrency(data.subtotal), 216, yPos, { align: 'right' })
    yPos += 20

    if (data.discount > 0) {
      doc.setFont('helvetica', 'normal')
      doc.text('Descuento:', 10, yPos)
      doc.setFont('courier', 'normal')
      doc.text(`- ${formatCurrency(data.discount)}`, 216, yPos, { align: 'right' })
      yPos += 20
    }

    // Línea separadora
    doc.setLineWidth(1)
    doc.line(10, yPos, 216, yPos)
    yPos += 25

    // Total (destacado)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL A PAGAR:', 10, yPos)
    doc.setFont('courier', 'bold')
    doc.text(formatCurrency(data.total), 216, yPos, { align: 'right' })
    yPos += 28

    // Forma de pago
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('F. PAGO: ' + data.paymentType, 113, yPos, { align: 'center' })
    yPos += 28

    // Cuotas (si aplica)
    if (data.paymentType === 'CREDITO' && data.installments) {
      doc.setLineWidth(0.5)
      // Línea punteada manual (jsPDF no soporta setLineDash en todas las versiones)
      doc.line(10, yPos, 216, yPos)
      yPos += 20

      // Si installments es 1 o no está definido correctamente, usar 6 por defecto
      const numInstallments = data.installments > 1 ? data.installments : 6

      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(`PLAN DE CUOTAS (${numInstallments} cuotas)`, 113, yPos, { align: 'center' })
      yPos += 20

      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      const installmentAmount = data.total / numInstallments

      for (let i = 0; i < numInstallments; i++) {
        const dueDate = new Date()
        dueDate.setMonth(dueDate.getMonth() + i + 1)
        const dueDateStr = dueDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: PERU_TZ })
        
        doc.text(`Cuota ${i + 1}:`, 10, yPos)
        doc.setFont('courier', 'normal')
        doc.text(`${formatCurrency(installmentAmount)} - Vence: ${dueDateStr}`, 216, yPos, { align: 'right' })
        doc.setFont('helvetica', 'normal')
        yPos += 16
      }
      yPos += 20
    }

    // Código QR (más pequeño y centrado)
    doc.setLineWidth(0.5)
    doc.line(10, yPos, 216, yPos)
    yPos += 22

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('DESCARGA TU TICKET', 113, yPos, { align: 'center' })
    yPos += 20

    // Generar QR code más pequeño (60x60 en lugar de 80x80)
    const qrDataUrl = await QRCode.toDataURL(data.ticketUrl, {
      width: 150,
      margin: 1
    })

    doc.addImage(qrDataUrl, 'PNG', 83, yPos, 60, 60)
    yPos += 75

    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.text('Escanea para descargar tu ticket digital', 113, yPos, { align: 'center' })
    yPos += 22

    // Footer
    doc.setLineWidth(0.5)
    doc.line(10, yPos, 216, yPos)
    yPos += 22

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('¡Gracias por su preferencia!', 113, yPos, { align: 'center' })
    yPos += 20

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(`Vuelva pronto a ${data.storeName}`, 113, yPos, { align: 'center' })
    yPos += 30 // Margen final EXTRA grande

    console.log('[PDF] Altura final del contenido:', yPos, 'puntos')

    // Convertir a buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    const finalHeight = Math.ceil(yPos)
    console.log('[PDF] PDF generado exitosamente')
    console.log('[PDF] - Tamaño archivo:', pdfBuffer.length, 'bytes')
    console.log('[PDF] - Altura estimada:', Math.ceil(estimatedHeight), 'pt')
    console.log('[PDF] - Altura real usada:', finalHeight, 'pt')
    console.log('[PDF] - Formato final: [226, ' + Math.ceil(estimatedHeight) + ']')
    return pdfBuffer
  } catch (error) {
    console.error('[generateSimpleReceiptPDF] Error:', error)
    throw new Error(`Error generating PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
