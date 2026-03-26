'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from '@/components/ui/select'
import { REPORT_TYPES, ReportTypeId, ReportFilters } from '@/lib/reports/report-types'
import { generateInsights, Insight } from '@/lib/reports/insights'
import {
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  BarChart3,
  Table2,
  Database,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Image as ImageIcon
} from 'lucide-react'
import { ReportCharts } from './report-charts'
import {
  generateReport,
  generateDatabaseBackup
} from '@/actions/reports'

// ─── Captura SVG de recharts como imagen PNG ──────────────────────────────────
async function captureChartsAsPng(
  container: HTMLElement
): Promise<{ data: string; w: number; h: number }[]> {
  const svgs = Array.from(container.querySelectorAll('svg'))
  const images: { data: string; w: number; h: number }[] = []

  for (const svg of svgs) {
    try {
      const bbox = svg.getBoundingClientRect()
      const srcW = Math.round(bbox.width) || 800
      const srcH = Math.round(bbox.height) || 380

      // Skip tiny/invisible SVGs (legend icons, etc.)
      if (srcW < 50 || srcH < 50) continue

      const clone = svg.cloneNode(true) as SVGElement
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      clone.setAttribute('width', String(srcW))
      clone.setAttribute('height', String(srcH))

      // Fondo blanco
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('width', '100%')
      rect.setAttribute('height', '100%')
      rect.setAttribute('fill', 'white')
      clone.insertBefore(rect, clone.firstChild)

      // Inline computed styles on all child elements (necesario para que SVG se vea igual fuera del DOM)
      const allEls = Array.from(clone.querySelectorAll('*'))
      const srcEls = Array.from(svg.querySelectorAll('*'))
      for (let i = 0; i < Math.min(allEls.length, srcEls.length); i++) {
        try {
          const computed = window.getComputedStyle(srcEls[i] as Element)
          const fill = computed.getPropertyValue('fill')
          const stroke = computed.getPropertyValue('stroke')
          const fontSize = computed.getPropertyValue('font-size')
          const fontFamily = computed.getPropertyValue('font-family')
          const el = allEls[i] as SVGElement
          if (fill && fill !== 'none') el.style.fill = fill
          if (stroke && stroke !== 'none') el.style.stroke = stroke
          if (fontSize) el.style.fontSize = fontSize
          if (fontFamily) el.style.fontFamily = fontFamily
        } catch { /* skip */ }
      }

      const svgStr = new XMLSerializer().serializeToString(clone)
      // Usar data URL base64 en vez de blob URL (más compatible con CSP)
      const svgB64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)))

      const imgData = await new Promise<string | null>((resolve) => {
        const img = new window.Image()
        const timeout = setTimeout(() => resolve(null), 5000)
        img.onload = () => {
          clearTimeout(timeout)
          const scale = 1.5
          const canvas = document.createElement('canvas')
          canvas.width = srcW * scale
          canvas.height = srcH * scale
          const ctx = canvas.getContext('2d')!
          ctx.scale(scale, scale)
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, srcW, srcH)
          ctx.drawImage(img, 0, 0, srcW, srcH)
          resolve(canvas.toDataURL('image/png', 0.9))
        }
        img.onerror = () => { clearTimeout(timeout); resolve(null) }
        img.src = svgB64
      })
      if (imgData) images.push({ data: imgData, w: srcW, h: srcH })
    } catch {
      // Skip failed captures silently
    }
  }
  return images
}

// ─── Fechas por defecto por tipo de reporte ───────────────────────────────────
function getDefaultDates(reportId: string) {
  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const firstOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  if (reportId === 'sales-by-month') {
    return { startDate: firstOfYear, endDate: today }
  }
  if (['purchases-by-supplier', 'purchases-by-period', 'inventory-rotation', 'stock-rotation', 'kardex'].includes(reportId)) {
    return { startDate: ninetyDaysAgo, endDate: today }
  }
  return { startDate: firstOfMonth, endDate: today }
}

export function ReportsGenerator() {
  const [selectedReport, setSelectedReport] = useState<ReportTypeId | null>(null)
  const [reportData, setReportData] = useState<any[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState<'stats' | 'data'>('stats')
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    warehouse: undefined
  })

  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const currentReport = Object.values(REPORT_TYPES).find(r => r.id === selectedReport)

  // Cambio de reporte con fechas inteligentes
  const handleReportChange = (value: string) => {
    setSelectedReport(value as ReportTypeId)
    setReportData([])
    const defaults = getDefaultDates(value)
    setFilters(f => ({ ...f, ...defaults }))
  }

  // Generar reporte
  const handleGenerateReport = async () => {
    if (!selectedReport) {
      toast.warning('Por favor selecciona un reporte')
      return
    }
    setLoading(true)
    try {
      const result = await generateReport(selectedReport, filters)
      if (!result.success) {
        toast.error(result.error || 'Error al generar el reporte')
        return
      }
      const data: any[] = Array.isArray(result.data)
        ? result.data
        : Array.isArray(result.data?.rows)
          ? result.data.rows
          : []

      if (data.length === 0) {
        toast.info('No se encontraron datos para este reporte con los filtros seleccionados')
      }
      setReportData(data)
      setInsights(generateInsights(selectedReport, data))
      setActiveTab('stats')
    } catch {
      toast.error('Error al generar el reporte. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // Exportar CSV
  const exportCSV = () => {
    if (!reportData.length || !currentReport) {
      toast.warning('No hay datos para exportar')
      return
    }
    try {
      const headers = Object.keys(reportData[0])
      const csv = Papa.unparse({ fields: headers, data: reportData.map(r => headers.map(h => r[h] ?? '')) })
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `${currentReport.id}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a); a.click()
      setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url) }, 100)
      toast.success('CSV exportado correctamente')
    } catch (e) {
      toast.error(`Error al exportar CSV: ${e instanceof Error ? e.message : 'Error'}`)
    }
  }

  // Exportar Excel con hoja de datos + hoja de resumen
  const exportExcel = () => {
    if (!reportData.length || !currentReport) {
      toast.warning('No hay datos para exportar')
      return
    }
    try {
      const wb = XLSX.utils.book_new()
      const headers = Object.keys(reportData[0])
      const fecha = new Date().toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })

      // Hoja principal: Datos
      const ws = XLSX.utils.aoa_to_sheet([
        [currentReport.name],
        [`Generado: ${fecha}`],
        [`Periodo: ${filters.startDate || ''} a ${filters.endDate || ''}`],
        [],
        headers,
        ...reportData.map(r => headers.map(h => {
          const v = r[h]
          return typeof v === 'number' ? v : (v != null ? String(v) : '')
        }))
      ])
      ws['!cols'] = headers.map(() => ({ wch: 20 }))
      XLSX.utils.book_append_sheet(wb, ws, 'Datos')

      // Hoja secundaria: Resumen agregado (si el reporte tiene campos numericos)
      const numericKeys = headers.filter(h => typeof reportData[0][h] === 'number')
      if (numericKeys.length > 0) {
        const sumRow = ['TOTAL', ...numericKeys.map(k => reportData.reduce((s, r) => s + (Number(r[k]) || 0), 0))]
        const avgRow = ['PROMEDIO', ...numericKeys.map(k => {
          const sum = reportData.reduce((s, r) => s + (Number(r[k]) || 0), 0)
          return sum / reportData.length
        })]
        const maxRow = ['MAXIMO', ...numericKeys.map(k => Math.max(...reportData.map(r => Number(r[k]) || 0)))]
        const wsSum = XLSX.utils.aoa_to_sheet([
          [currentReport.name + ' — Resumen'],
          [`Generado: ${fecha}`],
          [],
          ['CONCEPTO', ...numericKeys],
          sumRow,
          avgRow,
          maxRow
        ])
        wsSum['!cols'] = [{ wch: 20 }, ...numericKeys.map(() => ({ wch: 16 }))]
        XLSX.utils.book_append_sheet(wb, wsSum, 'Resumen')
      }

      XLSX.writeFile(wb, `${currentReport.id}-${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Excel exportado con hoja de datos y resumen')
    } catch (e) {
      toast.error(`Error al exportar Excel: ${e instanceof Error ? e.message : 'Error'}`)
    }
  }

  // Exportar PDF — informe profesional con gráficos y tabla de datos
  const exportPDF = async () => {
    if (!reportData.length || !currentReport) {
      toast.warning('No hay datos para exportar')
      return
    }
    setLoading(true)
    const toastId = toast.loading('Generando PDF...')
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const fecha = new Date().toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })

      // ── Encabezado con banda de color ──────────────────────────────────────
      doc.setFillColor(17, 24, 39)        // gray-900
      doc.rect(0, 0, pageW, 28, 'F')

      doc.setFontSize(14)
      doc.setTextColor(16, 185, 129)      // emerald
      doc.setFont('helvetica', 'bold')
      doc.text('ADICTION BOUTIQUE', 14, 11)

      doc.setFontSize(9)
      doc.setTextColor(200, 200, 200)
      doc.setFont('helvetica', 'normal')
      doc.text('Sistema de Gestión · Reporte', 14, 17)

      doc.setFontSize(11)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.text(currentReport.name, 14, 24)

      // Fecha y periodo (derecha)
      doc.setFontSize(7)
      doc.setTextColor(180, 180, 180)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generado: ${fecha}`, pageW - 14, 17, { align: 'right' })
      doc.text(`Periodo: ${filters.startDate || 'N/A'} — ${filters.endDate || 'N/A'}`, pageW - 14, 22, { align: 'right' })

      let yPos = 36

      // ── Gráficos capturados ────────────────────────────────────────────────
      let chartsCaptured = 0
      if (chartContainerRef.current && activeTab === 'stats') {
        toast.loading('Capturando gráficos...', { id: toastId })
        try {
          const images = await captureChartsAsPng(chartContainerRef.current)
          if (images.length > 0) {
            doc.setFontSize(9)
            doc.setTextColor(55, 65, 81)
            doc.setFont('helvetica', 'bold')
            doc.text('VISUALIZACIONES', 14, yPos)
            yPos += 2
            doc.setDrawColor(16, 185, 129)
            doc.setLineWidth(0.3)
            doc.line(14, yPos, pageW - 14, yPos)
            yPos += 5
          }

          for (const chart of images) {
            const maxW = pageW - 28
            const aspect = chart.h / chart.w
            const imgH = Math.min(Math.round(aspect * maxW), 110)

            if (yPos + imgH > pageH - 20) {
              doc.addPage()
              yPos = 15
            }
            doc.addImage(chart.data, 'PNG', 14, yPos, maxW, imgH)
            yPos += imgH + 8
            chartsCaptured++
          }
        } catch {
          // Si falla la captura, continuar sin gráficos
        }
      }

      // ── Sección de datos tabulados ────────────────────────────────────────
      if (chartsCaptured > 0 || yPos > pageH - 60) {
        doc.addPage()
        yPos = 15
      }

      doc.setFontSize(9)
      doc.setTextColor(55, 65, 81)
      doc.setFont('helvetica', 'bold')
      doc.text('DATOS DETALLADOS', 14, yPos)
      yPos += 2
      doc.setDrawColor(16, 185, 129)
      doc.setLineWidth(0.3)
      doc.line(14, yPos, pageW - 14, yPos)
      yPos += 5

      // Formatear headers (legibles)
      const rawHeaders = Object.keys(reportData[0])
      const friendlyHeaders = rawHeaders.map(h =>
        h.replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .replace(/^\w/, c => c.toUpperCase())
          .trim()
      )

      const tableData = reportData.map(r => rawHeaders.map(h => {
        const v = r[h]
        if (typeof v === 'number') {
          // Distinguir montos de cantidades: si el key incluye palabras de monto
          const isMonetary = /total|monto|precio|ingreso|ganancia|deuda|pago|credito|contado/i.test(h)
          if (isMonetary && !Number.isInteger(v)) {
            return `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
          return v.toLocaleString('es-PE')
        }
        return v != null ? String(v) : '—'
      }))

      autoTable(doc, {
        head: [friendlyHeaders],
        body: tableData,
        startY: yPos,
        styles: {
          fontSize: 7,
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
          overflow: 'linebreak',
          textColor: [55, 65, 81]
        },
        headStyles: {
          fillColor: [17, 24, 39],
          textColor: [16, 185, 129],
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        tableLineColor: [229, 231, 235],
        tableLineWidth: 0.1,
        margin: { right: 14, left: 14 },
        didDrawPage: (hookData: any) => {
          const totalPages = (doc as any).internal.getNumberOfPages()
          const curPage = hookData.pageNumber
          // Footer en cada página
          doc.setFillColor(17, 24, 39)
          doc.rect(0, pageH - 10, pageW, 10, 'F')
          doc.setFontSize(6.5)
          doc.setTextColor(150, 150, 150)
          doc.setFont('helvetica', 'normal')
          doc.text(
            `${currentReport.name}  ·  Página ${curPage} de ${totalPages}  ·  ${fecha}`,
            pageW / 2,
            pageH - 4,
            { align: 'center' }
          )
        }
      })

      // ── Guardar / descargar ────────────────────────────────────────────────
      const fileName = `${currentReport.id}-${new Date().toISOString().split('T')[0]}.pdf`

      // Método 1: doc.save() (descarga directa)
      try {
        doc.save(fileName)
        toast.success(`PDF exportado: ${fileName}`, { id: toastId })
      } catch {
        // Método 2: URL de datos como fallback
        const pdfBlob = doc.output('blob')
        const url = URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 200)
        toast.success(`PDF exportado: ${fileName}`, { id: toastId })
      }
    } catch (e) {
      console.error('[exportPDF]', e)
      toast.error(`Error al exportar PDF: ${e instanceof Error ? e.message : 'Error desconocido'}`, { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  // Backup BD — completo con todas las tablas del sistema
  const handleDatabaseBackup = async () => {
    try {
      setLoading(true)
      const toastId = toast.loading('Generando backup completo...')
      const result = await generateDatabaseBackup()
      if (result.success && result.data) {
        const wb = XLSX.utils.book_new()
        const backupData = (result.data as any).data || result.data
        const errors = (result.data as any).errors || []
        let tablesExported = 0

        Object.entries(backupData).forEach(([tableName, tableData]: [string, any]) => {
          if (Array.isArray(tableData)) {
            // Incluir hoja aunque esté vacía (importante para verificar estructura)
            const ws = tableData.length > 0
              ? XLSX.utils.json_to_sheet(tableData)
              : XLSX.utils.aoa_to_sheet([['(tabla vacía)']])
            XLSX.utils.book_append_sheet(wb, ws, tableName.substring(0, 31))
            tablesExported++
          }
        })

        // Hoja de índice con metadata
        const fecha = new Date().toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })
        const indexData = [
          ['BACKUP — ADICTION BOUTIQUE'],
          [`Fecha: ${fecha}`],
          [`Versión: ${(result.data as any).version || '2.0'}`],
          [`Tablas exportadas: ${tablesExported}`],
          [],
          ['TABLA', 'REGISTROS', 'ESTADO'],
          ...Object.entries(backupData).map(([t, d]: [string, any]) => [
            t,
            Array.isArray(d) ? d.length : 0,
            errors.some((e: string) => e.startsWith(t)) ? '⚠ Error' : '✓ OK'
          ])
        ]
        const wsIdx = XLSX.utils.aoa_to_sheet(indexData)
        wsIdx['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 10 }]
        XLSX.utils.book_append_sheet(wb, wsIdx, '_INDICE')

        const fileName = `backup-adiction-${new Date().toISOString().split('T')[0]}.xlsx`
        XLSX.writeFile(wb, fileName)

        if (errors.length > 0) {
          toast.warning(`Backup generado con advertencias (${errors.length} tablas con error)`, { id: toastId })
        } else {
          toast.success(`Backup completo: ${tablesExported} tablas exportadas`, { id: toastId })
        }
      } else {
        toast.error(`Error al crear backup: ${result.error || 'Error'}`)
      }
    } catch (e) {
      toast.error(`Error al crear backup: ${e instanceof Error ? e.message : 'Error'}`)
    } finally {
      setLoading(false)
    }
  }

  // Agrupar por categoria
  const reportsByCategory = Object.values(REPORT_TYPES).reduce((acc, report) => {
    if (!acc[report.category]) acc[report.category] = []
    acc[report.category].push(report)
    return acc
  }, {} as Record<string, typeof REPORT_TYPES[keyof typeof REPORT_TYPES][]>)

  const categoryInfo: Record<string, { name: string }> = {
    inventory: { name: '📦 Inventario' },
    sales: { name: '💰 Ventas' },
    purchases: { name: '🛒 Compras' },
    clients: { name: '👥 Clientes' },
    financial: { name: '💵 Financiero' }
  }

  return (
    <div className="space-y-4">
      {/* Backup */}
      <div className="flex items-center justify-end">
        <Button variant="outline" onClick={handleDatabaseBackup} disabled={loading} className="gap-2">
          <Database className="h-4 w-4" />
          Backup BD
        </Button>
      </div>

      {/* Selector */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Seleccionar Reporte</Label>
            <Select
              value={selectedReport || ''}
              onValueChange={handleReportChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un reporte..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(reportsByCategory).map(([category, reports]) => {
                  const info = categoryInfo[category]
                  return (
                    <SelectGroup key={category}>
                      <SelectLabel>{info?.name || category}</SelectLabel>
                      {reports.map((report) => (
                        <SelectItem key={report.id} value={report.id}>
                          {report.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )
                })}
              </SelectContent>
            </Select>
            {currentReport && (
              <p className="text-xs text-gray-500 mt-2">{currentReport.description}</p>
            )}
          </div>

          {selectedReport && (
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="flex-1" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {showFilters ? 'Ocultar' : 'Filtros'}
              </Button>
              <Button onClick={handleGenerateReport} disabled={loading} className="flex-1" size="sm">
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-2" />Generar</>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Filtros */}
        {showFilters && selectedReport && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t">
            <div>
              <Label className="text-xs">Fecha Inicio</Label>
              <Input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Fecha Fin</Label>
              <Input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Tienda</Label>
              <Select
                value={filters.warehouse || 'all'}
                onValueChange={(v) => setFilters({ ...filters, warehouse: v === 'all' ? undefined : v })}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Tienda Hombres">Tienda Hombres</SelectItem>
                  <SelectItem value="Tienda Mujeres">Tienda Mujeres</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedReport === 'low-stock' && (
              <div>
                <Label className="text-xs">Stock Minimo</Label>
                <Input
                  type="number"
                  value={filters.minStock || 5}
                  onChange={(e) => setFilters({ ...filters, minStock: parseInt(e.target.value) })}
                  className="h-9 text-sm"
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Resultados */}
      {reportData.length > 0 && selectedReport && (
        <div className="space-y-4">
          {/* Header con exportacion */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{currentReport?.name}</h2>
                <p className="text-sm text-gray-500">{reportData.length} registros</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading}>
                  <FileText className="h-4 w-4 mr-1.5" />CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={loading}>
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportPDF} disabled={loading}>
                  {loading
                    ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    : <FileDown className="h-4 w-4 mr-1.5" />
                  }
                  PDF + Graficos
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="stats" className="text-sm">
                  <BarChart3 className="h-4 w-4 mr-2" />Graficos
                </TabsTrigger>
                <TabsTrigger value="data" className="text-sm">
                  <Table2 className="h-4 w-4 mr-2" />Datos
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </Card>

          {activeTab === 'stats' && (
            <>
              {/* Insights */}
              {insights.length > 0 && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    <h3 className="font-semibold text-sm">Insights Automaticos</h3>
                  </div>
                  <div className="space-y-2">
                    {insights.map((insight, idx) => (
                      <div key={idx} className={`p-3 rounded-lg border ${
                        insight.type === 'error' ? 'bg-red-50 border-red-200' :
                        insight.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                        insight.type === 'success' ? 'bg-green-50 border-green-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          {insight.type === 'error' && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                          {insight.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />}
                          {insight.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />}
                          {insight.type === 'info' && <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />}
                          <div>
                            <p className="font-medium text-sm">{insight.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{insight.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className="text-xs text-gray-400 flex items-center gap-1 px-1">
                <ImageIcon className="h-3 w-3" />
                Los graficos se incluyen automaticamente al exportar en PDF
              </div>

              {/* Graficos con ref para captura */}
              <ReportCharts
                ref={chartContainerRef}
                data={reportData}
                reportType={selectedReport as string}
              />
            </>
          )}

          {activeTab === 'data' && (
            <Card className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      {Object.keys(reportData[0]).map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-xs text-gray-600 uppercase tracking-wide">
                          {h.charAt(0).toUpperCase() + h.slice(1).replace(/([A-Z])/g, ' $1')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                        {Object.values(row).map((v: any, ci) => (
                          <td key={ci} className="px-3 py-2 text-xs tabular-nums">
                            {typeof v === 'number' && !Number.isInteger(v)
                              ? v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : v?.toString() || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
