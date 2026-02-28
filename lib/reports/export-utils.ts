/**
 * Utilidades para exportar reportes en diferentes formatos
 */

import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'

export type ExportFormat = 'csv' | 'excel' | 'pdf'

interface ExportOptions {
  filename: string
  title: string
  headers: string[]
  data: any[][]
  format: ExportFormat
}

/**
 * Exportar datos a CSV
 */
export function exportToCSV(options: ExportOptions) {
  try {
    const { filename, headers, data } = options
    
    // Validar datos
    if (!data || data.length === 0) {
      throw new Error('No hay datos para exportar')
    }
    
    console.log('Generando CSV con', data.length, 'filas')
    
    const csv = Papa.unparse({
      fields: headers,
      data: data
    })
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }) // BOM para Excel
    downloadBlob(blob, `${filename}.csv`)
    
    console.log('CSV generado exitosamente')
  } catch (error) {
    console.error('Error al exportar CSV:', error)
    throw new Error(`Error al exportar CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
}

/**
 * Exportar datos a Excel
 */
export function exportToExcel(options: ExportOptions) {
  try {
    const { filename, title, headers, data } = options
    
    // Validar datos
    if (!data || data.length === 0) {
      throw new Error('No hay datos para exportar')
    }
    
    console.log('Generando Excel con', data.length, 'filas')
    
    // Crear hoja con título
    const titleRow = [[title]]
    const dateRow = [[`Generado: ${new Date().toLocaleString('es-PE', { 
      dateStyle: 'long', 
      timeStyle: 'short' 
    })}`]]
    const emptyRow = [[]]
    
    const worksheet = XLSX.utils.aoa_to_sheet([
      ...titleRow,
      ...dateRow,
      ...emptyRow,
      headers,
      ...data
    ])
    
    // Aplicar estilos (ancho de columnas)
    const colWidths = headers.map(() => ({ wch: 18 }))
    worksheet['!cols'] = colWidths
    
    // Crear libro
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte')
    
    // Guardar archivo
    XLSX.writeFile(workbook, `${filename}.xlsx`)
    
    console.log('Excel generado exitosamente')
  } catch (error) {
    console.error('Error al exportar Excel:', error)
    throw new Error(`Error al exportar Excel: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
}

/**
 * Exportar datos a PDF
 */
export function exportToPDF(options: ExportOptions) {
  try {
    const { filename, title, headers, data } = options
    
    // Validar datos
    if (!data || data.length === 0) {
      throw new Error('No hay datos para exportar')
    }
    
    console.log('Generando PDF con', data.length, 'filas')
    
    const doc = new jsPDF('l', 'mm', 'a4') // Landscape para más espacio
    
    // Título
    doc.setFontSize(18)
    doc.setTextColor(26, 26, 26) // Negro profesional
    doc.text(title, 14, 15)
    
    // Fecha de generación
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    const fecha = new Date().toLocaleString('es-PE', { 
      dateStyle: 'long', 
      timeStyle: 'short' 
    })
    doc.text(`Generado: ${fecha}`, 14, 22)
    
    // Línea separadora
    doc.setDrawColor(212, 165, 116) // Dorado
    doc.setLineWidth(0.5)
    doc.line(14, 25, 283, 25)
    
    // Tabla
    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 30,
      styles: { 
        fontSize: 7,
        cellPadding: 1.5,
        overflow: 'linebreak',
        halign: 'left'
      },
      headStyles: { 
        fillColor: [26, 26, 26], // Negro
        textColor: [212, 165, 116], // Dorado
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245] // Gris claro
      },
      margin: { top: 30, right: 14, bottom: 20, left: 14 },
      didDrawPage: (data) => {
        // Pie de página en cada página
        const pageCount = (doc as any).internal.getNumberOfPages()
        const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber
        
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Página ${currentPage} de ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        )
      }
    })
    
    doc.save(`${filename}.pdf`)
    
    console.log('PDF generado exitosamente')
  } catch (error) {
    console.error('Error al exportar PDF:', error)
    throw new Error(`Error al exportar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
}

/**
 * Función principal de exportación
 */
export function exportReport(options: ExportOptions) {
  try {
    console.log('Iniciando exportación:', options.format)
    
    // Validar opciones
    if (!options.filename || !options.title || !options.headers || !options.data) {
      throw new Error('Faltan parámetros requeridos para la exportación')
    }
    
    if (options.headers.length === 0) {
      throw new Error('No hay encabezados definidos')
    }
    
    if (options.data.length === 0) {
      throw new Error('No hay datos para exportar')
    }
    
    console.log('Validación exitosa. Headers:', options.headers.length, 'Filas:', options.data.length)
    
    switch (options.format) {
      case 'csv':
        exportToCSV(options)
        break
      case 'excel':
        exportToExcel(options)
        break
      case 'pdf':
        exportToPDF(options)
        break
      default:
        throw new Error(`Formato de exportación no soportado: ${options.format}`)
    }
    
    console.log('Exportación completada exitosamente')
  } catch (error) {
    console.error('Error en exportReport:', error)
    throw error
  }
}

/**
 * Descargar blob
 */
function downloadBlob(blob: Blob, filename: string) {
  try {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    
    // Limpiar después de un pequeño delay
    setTimeout(() => {
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }, 100)
  } catch (error) {
    console.error('Error al descargar archivo:', error)
    throw error
  }
}
