'use client'

import { useState, useRef, useEffect, type ComponentType } from 'react'
// xlsx-js-style is a drop-in fork of xlsx that supports cell styling (font, fill, alignment)
import * as XLSX from 'xlsx-js-style'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Image as ImageIcon,
  Store,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  ArrowLeft,
  ChevronRight,
  Banknote,
  CalendarDays,
  Clock,
  CreditCard,
  DollarSign,
  Layers,
  RefreshCw,
  ScrollText,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { ReportCharts } from './report-charts'
import {
  generateReport,
  generateDatabaseBackup
} from '@/actions/reports'
import { useStore } from '@/contexts/store-context'
import { getTodayPeru } from '@/lib/utils/timezone'

const EXCEL_CELL_TEXT_LIMIT = 32767
const EXCEL_TEXT_CHUNK_SIZE = 30000

function normalizeBackupCellValue(value: unknown): string | number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : ''
  if (typeof value === 'boolean') return value ? 'Si' : 'No'
  if (value == null) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function splitLongExcelText(value: string) {
  if (value.length <= EXCEL_CELL_TEXT_LIMIT) return [value]
  const chunks: string[] = []
  for (let i = 0; i < value.length; i += EXCEL_TEXT_CHUNK_SIZE) {
    chunks.push(value.slice(i, i + EXCEL_TEXT_CHUNK_SIZE))
  }
  return chunks
}

function normalizeBackupRowsForExcel(tableData: Record<string, unknown>[]) {
  const sourceHeaders = Array.from(new Set(tableData.flatMap(row => Object.keys(row || {}))))
  const normalizedRows: Record<string, string | number>[] = []
  const headerSet = new Set<string>()

  for (const row of tableData) {
    const normalized: Record<string, string | number> = {}
    for (const header of sourceHeaders) {
      const value = normalizeBackupCellValue(row[header])
      if (typeof value === 'string' && value.length > EXCEL_CELL_TEXT_LIMIT) {
        const chunks = splitLongExcelText(value)
        chunks.forEach((chunk, index) => {
          const key = `${header}__parte_${index + 1}`
          normalized[key] = chunk
          headerSet.add(key)
        })
      } else {
        normalized[header] = value
        headerSet.add(header)
      }
    }
    normalizedRows.push(normalized)
  }

  return {
    headers: Array.from(headerSet),
    rows: normalizedRows,
  }
}

// ─── Captura el contenedor de gráficos con html2canvas ───────────────────────
// html2canvas renderiza el DOM tal cual se ve en pantalla — resuelve CSS vars,
// fuentes, gradientes y dark mode correctamente. Mucho más fiable que SVG serialization.
async function captureChartsAsPng(
  container: HTMLElement
): Promise<{ data: string; w: number; h: number }[]> {
  // Importación dinámica para no incluir en el bundle inicial
  const html2canvas = (await import('html2canvas')).default

  const images: { data: string; w: number; h: number }[] = []

  // Buscar cada tarjeta de gráfico individualmente para mejor layout en PDF
  const chartCards = Array.from(
    container.querySelectorAll<HTMLElement>('[data-chart-card]')
  )

  // Si no hay tarjetas marcadas, capturar el contenedor completo
  const targets: HTMLElement[] = chartCards.length > 0 ? chartCards : [container]

  for (const target of targets) {
    try {
      const rect = target.getBoundingClientRect()
      if (rect.width < 50 || rect.height < 50) continue

      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2,                    // alta resolución
        useCORS: true,
        logging: false,
        allowTaint: true,
        removeContainer: true,
        // Ignorar elementos que no son gráficos (botones de acción, etc.)
        ignoreElements: (el) =>
          el.tagName === 'BUTTON' ||
          el.classList.contains('no-pdf'),
      })

      const data = canvas.toDataURL('image/png', 0.92)
      images.push({ data, w: rect.width, h: rect.height })
    } catch {
      // skip silently
    }
  }

  return images
}

// ─── Fechas por defecto por tipo de reporte ───────────────────────────────────
// Default: últimos 30 días para todos los reportes
// Excepción: sales-by-month → desde inicio del año (vista anual)
function daysAgoLima(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

function getDefaultDates(reportId: string) {
  const today = getTodayPeru()
  const now = new Date()
  const firstOfYear = new Date(now.getFullYear(), 0, 1).toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

  if (reportId === 'sales-by-month') {
    return { startDate: firstOfYear, endDate: today }
  }
  // Default 30 días — coherente con los KPIs del dashboard
  return { startDate: daysAgoLima(30), endDate: today }
}

type ReportDefinition = typeof REPORT_TYPES[keyof typeof REPORT_TYPES]
type IconComponent = ComponentType<{ className?: string }>

const CATEGORY_META: Record<string, { name: string; description: string; icon: IconComponent }> = {
  inventory: {
    name: 'Inventario',
    description: 'Stock, kardex, valorizacion y rotacion',
    icon: Package,
  },
  sales: {
    name: 'Ventas',
    description: 'Rendimiento comercial, productos y tiendas',
    icon: ShoppingCart,
  },
  purchases: {
    name: 'Compras',
    description: 'Compras por proveedor y periodo',
    icon: Truck,
  },
  clients: {
    name: 'Clientes y cobranzas',
    description: 'Cartera, deuda, mora y efectividad',
    icon: Users,
  },
  financial: {
    name: 'Financiero',
    description: 'Margen, flujo de caja e ingresos',
    icon: Wallet,
  },
}

const REPORT_ICONS: Record<string, IconComponent> = {
  'inventory-rotation': RefreshCw,
  'inventory-valuation': DollarSign,
  'stock-rotation': RefreshCw,
  'stock-valuation': DollarSign,
  'low-stock': AlertTriangle,
  kardex: ScrollText,
  'sales-timeline': TrendingUp,
  'sales-by-product': Trophy,
  'sales-by-category': Layers,
  'sales-by-period': CalendarDays,
  'sales-by-month': CalendarDays,
  'credit-vs-cash': CreditCard,
  'sales-summary': BarChart3,
  'sales-by-store': Store,
  'purchases-by-supplier': Truck,
  'purchases-by-period': CalendarDays,
  'clients-debt': Users,
  'clients-with-debt': Users,
  'overdue-installments': Clock,
  'collection-effectiveness': Target,
  'profit-margin': TrendingUp,
  'cash-flow': Banknote,
}

interface ReportsGeneratorProps {
  initialCategory?: string
  initialReport?: ReportTypeId
}

export function ReportsGenerator({ initialCategory, initialReport }: ReportsGeneratorProps) {
  // Obtener contexto de tienda — DEBE ir antes del useState de filters para poder
  // usarlo en el lazy initializer y así pre-poblar warehouse desde el primer render
  const storeCtx = useStore()
  const isLocked = storeCtx?.isStoreLocked ?? false
  const lockedStoreName = isLocked ? storeCtx?.selectedStore : null

  const STORE_NAME_MAP: Record<string, string> = {
    'MUJERES': 'Tienda Mujeres',
    'HOMBRES': 'Tienda Hombres',
  }

  const [selectedReport, setSelectedReport] = useState<ReportTypeId | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory || null)
  const [reportData, setReportData] = useState<any[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState<'stats' | 'data'>('stats')
  // Lazy initializer: pre-pobla warehouse en el primer render según la tienda del usuario
  // (evita que en el primer render el filtro salga vacío y luego lo corrija un useEffect)
  const [filters, setFilters] = useState<ReportFilters>(() => {
    const ctx = storeCtx?.selectedStore
    const initialWarehouse = (ctx && ctx !== 'ALL')
      ? (STORE_NAME_MAP[ctx] ?? ctx)
      : undefined
    return {
      startDate: daysAgoLima(30),
      endDate: getTodayPeru(),
      warehouse: initialWarehouse,
    }
  })

  useEffect(() => {
    if (initialReport) {
      const report = Object.values(REPORT_TYPES).find(r => r.id === initialReport)
      setSelectedReport(initialReport)
      setSelectedCategory(report?.category || initialCategory || null)
      setShowFilters(true)
      setFilters(f => ({ ...f, ...getDefaultDates(initialReport) }))
      return
    }

    if (initialCategory) {
      setSelectedCategory(initialCategory)
      setSelectedReport(null)
      setReportData([])
    }
  }, [initialCategory, initialReport])

  // Sincronizar warehouse filter con el selector global de tienda del header
  useEffect(() => {
    const ctx = storeCtx?.selectedStore
    if (!ctx || ctx === 'ALL') {
      if (!isLocked) setFilters(f => ({ ...f, warehouse: undefined }))
    } else {
      const storeName = STORE_NAME_MAP[ctx] || ctx
      setFilters(f => ({ ...f, warehouse: storeName }))
    }
  }, [storeCtx?.selectedStore, isLocked])

  // Cambio de reporte con fechas inteligentes
  const handleReportChange = (value: string) => {
    const report = Object.values(REPORT_TYPES).find(r => r.id === value)
    setSelectedReport(value as ReportTypeId)
    setSelectedCategory(report?.category || selectedCategory)
    setReportData([])
    setInsights([])
    setActiveTab('stats')
    setShowFilters(true)
    const defaults = getDefaultDates(value)
    setFilters(f => ({ ...f, ...defaults }))
  }

  const handleChangeReport = () => {
    setSelectedReport(null)
    setReportData([])
    setInsights([])
    setActiveTab('stats')
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

  // Exportar CSV \u2014 con metadata y headers prettified
  const exportCSV = () => {
    if (!reportData.length || !currentReport) {
      toast.warning('No hay datos para exportar')
      return
    }
    try {
      const headers = Object.keys(reportData[0])
      const fecha = new Date().toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })

      // Prefijo metadata como comentarios CSV (l\u00EDneas iniciales)
      const metaLines = [
        `# ${currentReport.name}`,
        `# Generado: ${fecha}`,
        `# Periodo: ${filters.startDate || 'N/A'} a ${filters.endDate || 'N/A'}`,
        `# Tienda: ${filters.warehouse || 'Todas'}`,
        `# Registros: ${reportData.length}`,
        '',
      ].join('\n')

      const csv = Papa.unparse({
        fields: headers.map(prettifyHeader),
        data: reportData.map(r => headers.map(h => r[h] ?? '')),
      })

      const blob = new Blob(['\uFEFF' + metaLines + csv], { type: 'text/csv;charset=utf-8;' })
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

  // Helpers para formato profesional de Excel
  const prettifyHeader = (h: string) =>
    h.replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim()

  const isCurrencyKey = (k: string) =>
    /(price|amount|total|monto|valor|saldo|deuda|costo|venta|ingres|gast|util)/i.test(k)

  const isPercentKey = (k: string) => /(porcentaj|percent|margen|tasa|rotac)/i.test(k)

  // Exportar Excel — formato profesional con portada, datos, resumen
  const exportExcel = () => {
    if (!reportData.length || !currentReport) {
      toast.warning('No hay datos para exportar')
      return
    }
    try {
      const wb = XLSX.utils.book_new()
      const headers = Object.keys(reportData[0])
      const prettyHeaders = headers.map(prettifyHeader)
      const fecha = new Date().toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })
      const numericKeys = headers.filter(h => typeof reportData[0][h] === 'number')

      // ─── Hoja 1: PORTADA ─────────────────────────────────────────────────
      const cover = XLSX.utils.aoa_to_sheet([
        ['ADICTION BOUTIQUE'],
        ['Sistema de Gestión'],
        [],
        [currentReport.name],
        [currentReport.description || ''],
        [],
        ['Generado', fecha],
        ['Periodo', `${filters.startDate || 'N/A'}  →  ${filters.endDate || 'N/A'}`],
        ['Tienda', filters.warehouse || 'Todas las tiendas'],
        ['Total de registros', reportData.length],
        [],
        ['Hojas incluidas:'],
        ['  • Datos — Listado completo de registros'],
        numericKeys.length > 0 ? ['  • Resumen — Totales, promedios, mínimos y máximos'] : null,
      ].filter(Boolean) as any[][])
      cover['!cols'] = [{ wch: 28 }, { wch: 50 }]
      cover['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
      ]
      // Negrita en celdas clave (xlsx soporta s.font con cellStyles)
      const boldCells = ['A1', 'A4']
      for (const ref of boldCells) {
        if (cover[ref]) cover[ref].s = { font: { bold: true, sz: 14 } }
      }
      XLSX.utils.book_append_sheet(wb, cover, 'Portada')

      // ─── Hoja 2: DATOS ────────────────────────────────────────────────────
      // Headers en negrita + filas con tipado numérico real
      const dataRows = reportData.map(r =>
        headers.map(h => {
          const v = r[h]
          if (typeof v === 'number') return v
          if (v == null) return ''
          // Detectar fechas ISO
          if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v
          return String(v)
        })
      )

      const ws = XLSX.utils.aoa_to_sheet([prettyHeaders, ...dataRows])

      // Anchos de columna inteligentes — basados en contenido máximo
      ws['!cols'] = headers.map((h, i) => {
        const maxLen = Math.max(
          prettyHeaders[i].length,
          ...reportData.slice(0, 100).map(r => String(r[h] ?? '').length)
        )
        return { wch: Math.min(Math.max(maxLen + 2, 12), 40) }
      })

      // Freeze header row + autofilter
      ws['!freeze'] = { xSplit: 0, ySplit: 1 }
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: dataRows.length, c: headers.length - 1 } }) }

      // Formato numérico por columna (currency / percent / integer)
      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        const key = headers[colIdx]
        if (typeof reportData[0][key] !== 'number') continue
        const fmt = isCurrencyKey(key)
          ? '"S/" #,##0.00'
          : isPercentKey(key)
            ? '0.00%'
            : '#,##0.##'
        for (let rowIdx = 1; rowIdx <= dataRows.length; rowIdx++) {
          const ref = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })
          if (ws[ref]) ws[ref].z = fmt
        }
      }

      // Header bold
      for (let c = 0; c < headers.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: 0, c })
        if (ws[ref]) {
          ws[ref].s = {
            font: { bold: true, color: { rgb: 'FFFFFFFF' } },
            fill: { fgColor: { rgb: 'FF10B981' } },
            alignment: { horizontal: 'center', vertical: 'center' },
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Datos')

      // ─── Hoja 3: RESUMEN ──────────────────────────────────────────────────
      if (numericKeys.length > 0) {
        const prettyNumKeys = numericKeys.map(prettifyHeader)
        const sumRow = ['Total', ...numericKeys.map(k => reportData.reduce((s, r) => s + (Number(r[k]) || 0), 0))]
        const avgRow = ['Promedio', ...numericKeys.map(k => {
          const sum = reportData.reduce((s, r) => s + (Number(r[k]) || 0), 0)
          return sum / reportData.length
        })]
        const minRow = ['Mínimo', ...numericKeys.map(k => Math.min(...reportData.map(r => Number(r[k]) || 0)))]
        const maxRow = ['Máximo', ...numericKeys.map(k => Math.max(...reportData.map(r => Number(r[k]) || 0)))]
        const countRow = ['Registros', ...numericKeys.map(() => reportData.length)]

        const wsSum = XLSX.utils.aoa_to_sheet([
          [currentReport.name + ' — Resumen Estadístico'],
          [`Periodo: ${filters.startDate || 'N/A'} → ${filters.endDate || 'N/A'}`],
          [],
          ['Concepto', ...prettyNumKeys],
          sumRow,
          avgRow,
          minRow,
          maxRow,
          countRow,
        ])
        wsSum['!cols'] = [{ wch: 18 }, ...numericKeys.map((k) => ({ wch: Math.max(prettifyHeader(k).length + 2, 16) }))]
        wsSum['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: numericKeys.length } }]

        // Formato numérico
        for (let colIdx = 1; colIdx <= numericKeys.length; colIdx++) {
          const key = numericKeys[colIdx - 1]
          const fmt = isCurrencyKey(key) ? '"S/" #,##0.00' : isPercentKey(key) ? '0.00%' : '#,##0.##'
          for (let rowIdx = 4; rowIdx <= 8; rowIdx++) {
            const ref = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })
            if (wsSum[ref]) wsSum[ref].z = fmt
          }
        }

        // Header bold
        for (let c = 0; c <= numericKeys.length; c++) {
          const ref = XLSX.utils.encode_cell({ r: 3, c })
          if (wsSum[ref]) {
            wsSum[ref].s = {
              font: { bold: true, color: { rgb: 'FFFFFFFF' } },
              fill: { fgColor: { rgb: 'FF10B981' } },
            }
          }
        }

        XLSX.utils.book_append_sheet(wb, wsSum, 'Resumen')
      }

      XLSX.writeFile(wb, `${currentReport.id}-${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Excel exportado · Portada, Datos y Resumen')
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
      // Si el usuario está en la pestaña de datos, cambiar a stats para capturar gráficos
      const wasOnDataTab = activeTab === 'data'
      if (wasOnDataTab) {
        setActiveTab('stats')
        // Dar tiempo al DOM para renderizar los gráficos
        await new Promise(r => setTimeout(r, 600))
      }

      const doc = new jsPDF('p', 'mm', 'a4')
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const fecha = new Date().toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })

      // ── Encabezado con banda de color ──────────────────────────────────────
      doc.setFillColor(16, 185, 129)      // emerald-500
      doc.rect(0, 0, pageW, 26, 'F')
      doc.setFillColor(5, 150, 105)       // emerald-600
      doc.rect(0, 24, pageW, 2, 'F')

      doc.setFontSize(14)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.text('ADICTION BOUTIQUE', 14, 11)

      doc.setFontSize(9)
      doc.setTextColor(236, 253, 245)
      doc.setFont('helvetica', 'normal')
      doc.text('Sistema de Gestión · Reporte', 14, 17)

      doc.setFontSize(11)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.text(currentReport.name, 14, 22)

      doc.setFontSize(7)
      doc.setTextColor(220, 252, 231)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generado: ${fecha}`, pageW - 14, 17, { align: 'right' })
      doc.text(`Periodo: ${filters.startDate || 'N/A'} — ${filters.endDate || 'N/A'}`, pageW - 14, 22, { align: 'right' })

      let yPos = 36

      // ── Gráficos (siempre intentar capturar) ──────────────────────────────
      let chartsCaptured = 0
      if (chartContainerRef.current) {
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
            doc.setLineWidth(0.4)
            doc.line(14, yPos, pageW - 14, yPos)
            yPos += 6
          }

          for (const chart of images) {
            const maxW = pageW - 28
            const aspect = chart.h / chart.w
            // Limitar altura máxima por gráfico a 90mm para que quepan varios por página
            const imgH = Math.min(Math.round(aspect * maxW), 90)

            if (yPos + imgH > pageH - 20) {
              doc.addPage()
              yPos = 15
            }
            doc.addImage(chart.data, 'PNG', 14, yPos, maxW, imgH)
            yPos += imgH + 10
            chartsCaptured++
          }
        } catch {
          // Continuar sin gráficos si falla
        }
      }

      // Restaurar tab original si lo cambiamos
      if (wasOnDataTab) setActiveTab('data')

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
          fillColor: [16, 185, 129],     // emerald-500
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }
        },
        alternateRowStyles: { fillColor: [240, 253, 244] },  // green-50
        tableLineColor: [229, 231, 235],
        tableLineWidth: 0.1,
        margin: { right: 14, left: 14 },
        didDrawPage: (hookData: any) => {
          const totalPages = (doc as any).internal.getNumberOfPages()
          const curPage = hookData.pageNumber
          // Footer en cada página — línea gris clara
          doc.setDrawColor(209, 213, 219)  // gray-300
          doc.setLineWidth(0.3)
          doc.line(14, pageH - 10, pageW - 14, pageH - 10)
          doc.setFontSize(6.5)
          doc.setTextColor(107, 114, 128)  // gray-500
          doc.setFont('helvetica', 'normal')
          doc.text(
            `${currentReport.name}  ·  Página ${curPage} de ${totalPages}  ·  ${fecha}`,
            pageW / 2,
            pageH - 5,
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

  // Backup BD — completo con todas las tablas del sistema (estructura profesional)
  const handleDatabaseBackup = async () => {
    try {
      setLoading(true)
      const toastId = toast.loading('Generando backup completo...')
      const result = await generateDatabaseBackup()
      if (result.success && result.data) {
        const wb = XLSX.utils.book_new()
        const backupData = (result.data as any).data || result.data
        const errors = (result.data as any).errors || []
        const fecha = new Date().toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })
        const dateStr = new Date().toISOString().split('T')[0]
        let tablesExported = 0
        let totalRecords = 0

        // ─── Hoja 1: PORTADA (primera, visible al abrir) ───────────────────
        const totals: [string, number][] = []
        Object.entries(backupData).forEach(([t, d]) => {
          if (Array.isArray(d)) totalRecords += d.length
          if (Array.isArray(d)) totals.push([t, d.length])
        })
        totals.sort((a, b) => b[1] - a[1])

        const cover = XLSX.utils.aoa_to_sheet([
          ['ADICTION BOUTIQUE'],
          ['Backup completo de base de datos'],
          [],
          ['Fecha de generación', fecha],
          ['Versión del esquema', (result.data as any).version || '2.0'],
          ['Total de tablas', Object.keys(backupData).length],
          ['Total de registros', totalRecords],
          ['Estado', errors.length > 0 ? `${errors.length} advertencias` : 'OK'],
          [],
          ['Tabla', 'Registros', 'Estado'],
          ...totals.map(([t, count]) => [
            t,
            count,
            errors.some((e: string) => e.startsWith(t)) ? '⚠ Error' : '✓ OK',
          ]),
        ])
        cover['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 12 }]
        cover['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
        ]
        // Estilos en celdas clave
        if (cover['A1']) cover['A1'].s = { font: { bold: true, sz: 16 } }
        if (cover['A2']) cover['A2'].s = { font: { italic: true, color: { rgb: 'FF6B7280' } } }
        // Header de tabla con fondo verde
        for (const ref of ['A10', 'B10', 'C10']) {
          if (cover[ref]) cover[ref].s = {
            font: { bold: true, color: { rgb: 'FFFFFFFF' } },
            fill: { fgColor: { rgb: 'FF10B981' } },
            alignment: { horizontal: 'center' },
          }
        }
        XLSX.utils.book_append_sheet(wb, cover, '📋 Portada')

        // ─── Hojas de datos por tabla ───────────────────────────────────────
        Object.entries(backupData).forEach(([tableName, tableData]: [string, any]) => {
          if (!Array.isArray(tableData)) return

          let ws: XLSX.WorkSheet
          if (tableData.length === 0) {
            ws = XLSX.utils.aoa_to_sheet([
              [`Tabla: ${tableName}`],
              ['(sin registros)'],
            ])
            ws['!cols'] = [{ wch: 40 }]
          } else {
            const normalizedTable = normalizeBackupRowsForExcel(tableData as Record<string, unknown>[])
            const headers = normalizedTable.headers
            const prettyHeaders = headers.map(prettifyHeader)

            // Datos con tipado correcto (números reales, fechas como strings ISO)
            const rows = normalizedTable.rows.map(row => headers.map(h => row[h] ?? ''))

            ws = XLSX.utils.aoa_to_sheet([prettyHeaders, ...rows])

            // Anchos inteligentes
            ws['!cols'] = headers.map((h, i) => {
              const maxLen = Math.max(
                prettyHeaders[i].length,
                ...normalizedTable.rows.slice(0, 50).map(r => String(r[h] ?? '').length)
              )
              return { wch: Math.min(Math.max(maxLen + 2, 10), 40) }
            })

            // Freeze + autofilter
            ws['!freeze'] = { xSplit: 0, ySplit: 1 }
            ws['!autofilter'] = {
              ref: XLSX.utils.encode_range({
                s: { r: 0, c: 0 },
                e: { r: rows.length, c: headers.length - 1 },
              }),
            }

            // Header bold
            for (let c = 0; c < headers.length; c++) {
              const ref = XLSX.utils.encode_cell({ r: 0, c })
              if (ws[ref]) ws[ref].s = {
                font: { bold: true, color: { rgb: 'FFFFFFFF' } },
                fill: { fgColor: { rgb: 'FF374151' } },
                alignment: { horizontal: 'center', vertical: 'center' },
              }
            }

            // Formato numérico para columnas conocidas
            for (let colIdx = 0; colIdx < headers.length; colIdx++) {
              const key = headers[colIdx]
              if (typeof normalizedTable.rows[0]?.[key] !== 'number') continue
              const fmt = isCurrencyKey(key) ? '"S/" #,##0.00' : '#,##0.##'
              for (let rowIdx = 1; rowIdx <= rows.length; rowIdx++) {
                const ref = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })
                if (ws[ref]) ws[ref].z = fmt
              }
            }
          }

          XLSX.utils.book_append_sheet(wb, ws, tableName.substring(0, 31))
          tablesExported++
        })

        const fileName = `backup-adiction-${dateStr}.xlsx`
        XLSX.writeFile(wb, fileName)

        if (errors.length > 0) {
          toast.warning(`Backup generado con ${errors.length} advertencias`, { id: toastId })
        } else {
          toast.success(`Backup completo · ${tablesExported} tablas · ${totalRecords.toLocaleString()} registros`, { id: toastId })
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
  }, {} as Record<string, ReportDefinition[]>)

  const categoryOrder = Object.keys(CATEGORY_META)
    .filter(category => reportsByCategory[category]?.length)
  const orderedCategories = selectedCategory
    ? [
      selectedCategory,
      ...categoryOrder.filter(category => category !== selectedCategory),
    ].filter(category => reportsByCategory[category]?.length)
    : categoryOrder

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
        {!selectedReport ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Seleccionar reporte</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Elige una tarjeta para ver filtros, graficos y exportaciones.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {categoryOrder.map(category => {
                  const meta = CATEGORY_META[category]
                  const Icon = meta?.icon || BarChart3
                  const active = selectedCategory === category
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(active ? null : category)}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground',
                      ].join(' ')}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {meta?.name || category}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-5">
              {orderedCategories.map(category => {
                const meta = CATEGORY_META[category]
                const CatIcon = meta?.icon || BarChart3
                const reports = reportsByCategory[category] || []
                const highlighted = selectedCategory === category

                return (
                  <section
                    key={category}
                    className={[
                      'rounded-lg border p-3 transition-colors',
                      highlighted
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-card',
                    ].join(' ')}
                  >
                    <div className="mb-3 flex items-start gap-2">
                      <div className="mt-0.5 rounded-md border border-border bg-background p-1.5">
                        <CatIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                          {meta?.name || category}
                        </h3>
                        <p className="text-xs text-muted-foreground">{meta?.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {reports.map(report => {
                        const ReportIcon = REPORT_ICONS[report.id] || FileText
                        return (
                          <button
                            key={report.id}
                            type="button"
                            onClick={() => handleReportChange(report.id)}
                            className="group flex min-h-[104px] flex-col items-start gap-2 rounded-lg border border-border bg-background p-3 text-left transition-all hover:border-primary hover:bg-primary/5 hover:shadow-sm"
                          >
                            <div className="flex w-full items-start justify-between gap-2">
                              <ReportIcon className="h-4 w-4 text-primary" />
                              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                            </div>
                            <span className="text-sm font-medium leading-tight text-foreground">{report.name}</span>
                            <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                              {report.description}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <Button variant="ghost" size="sm" onClick={handleChangeReport} className="-ml-2 mb-2 gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Cambiar reporte
              </Button>
              <div className="flex items-start gap-3">
                <div className="rounded-md border border-border bg-primary/10 p-2">
                  {(() => {
                    const ReportIcon = selectedReport ? REPORT_ICONS[selectedReport] || FileText : FileText
                    return <ReportIcon className="h-4 w-4 text-primary" />
                  })()}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">{currentReport?.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{currentReport?.description}</p>
                </div>
              </div>
            </div>

            <div className="flex min-w-[240px] flex-col gap-2">
              {isLocked && lockedStoreName && lockedStoreName !== 'ALL' && (
                <div className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                  <Store className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Mostrando datos de: <strong>{filters.warehouse || lockedStoreName}</strong></span>
                </div>
              )}
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
            </div>
          </div>
        )}

        {/* Filtros */}
        {showFilters && selectedReport && (
          <div className="mt-4 pt-4 border-t space-y-3">
            {/* Quick presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium mr-1">Rango rápido:</span>
              {[
                { label: 'Hoy', days: 0 },
                { label: '7 días', days: 7 },
                { label: '30 días', days: 30 },
                { label: '90 días', days: 90 },
                { label: 'Este año', days: -1 }, // sentinel for first-of-year
              ].map(preset => {
                const today = getTodayPeru()
                let start: string
                if (preset.days === -1) {
                  const now = new Date()
                  start = new Date(now.getFullYear(), 0, 1)
                    .toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
                } else if (preset.days === 0) {
                  start = today
                } else {
                  start = daysAgoLima(preset.days)
                }
                const isActive = filters.startDate === start && filters.endDate === today
                return (
                  <button
                    key={preset.label}
                    onClick={() => setFilters({ ...filters, startDate: start, endDate: today })}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground/70 border-border hover:bg-accent'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              <Label className="text-xs flex items-center gap-1.5">
                Tienda
                {isLocked && (
                  <Badge variant="outline" className="text-[9px] py-0 h-4 bg-blue-50 text-blue-700 border-blue-200 gap-1">
                    <Store className="h-2.5 w-2.5" />
                    Restringida
                  </Badge>
                )}
              </Label>
              {isLocked ? (
                <div className="h-9 px-3 flex items-center border rounded-md bg-muted text-sm text-muted-foreground">
                  {filters.warehouse || 'Tu tienda'}
                </div>
              ) : (
                <Select
                  value={filters.warehouse || 'all'}
                  onValueChange={(v) => setFilters({ ...filters, warehouse: v === 'all' ? undefined : v })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las tiendas</SelectItem>
                    <SelectItem value="Tienda Hombres">Tienda Hombres</SelectItem>
                    <SelectItem value="Tienda Mujeres">Tienda Mujeres</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
                <p className="text-sm text-muted-foreground">{reportData.length} registros</p>
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
                        insight.type === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900' :
                        insight.type === 'warning' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-900' :
                        insight.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900' :
                        'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900'
                      }`}>
                        <div className="flex items-start gap-2">
                          {insight.type === 'error' && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                          {insight.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />}
                          {insight.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />}
                          {insight.type === 'info' && <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />}
                          <div>
                            <p className="font-medium text-sm">{insight.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{insight.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className="text-xs text-muted-foreground flex items-center gap-1 px-1">
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
                    <tr className="border-b bg-muted/60">
                      {Object.keys(reportData[0]).map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                          {h.charAt(0).toUpperCase() + h.slice(1).replace(/([A-Z])/g, ' $1')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-muted/50 transition-colors">
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
