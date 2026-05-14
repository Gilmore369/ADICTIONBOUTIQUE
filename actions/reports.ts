'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ReportFilters, ReportTypeId } from '@/lib/reports/report-types'
import { PERU_TZ, peruMidnightUTC, peruEndOfDayUTC, getTodayPeru } from '@/lib/utils/timezone'

/**
 * Convert a YYYY-MM-DD filter string to Peru-aware UTC start (00:00 Lima = 05:00 UTC).
 * If already an ISO timestamp, return as-is.
 */
function toPeruStart(dateStr: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? peruMidnightUTC(dateStr) : dateStr
}

/**
 * Convert a YYYY-MM-DD filter string to Peru-aware UTC end (23:59:59 Lima = next 04:59:59 UTC).
 * If already an ISO timestamp, return as-is.
 */
function toPeruEnd(dateStr: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? peruEndOfDayUTC(dateStr) : dateStr
}

// Mapa de clave de tienda del usuario → nombre en BD
const RETURN_STATUSES_FOR_NET = ['PENDIENTE', 'APROBADA', 'COMPLETADA']

function money(value: unknown) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function getReturnTotal(ret: any) {
  return money(ret?.total_amount ?? ret?.total_refund ?? ret?.refund_amount ?? 0)
}

function getReturnItemTotal(item: any) {
  return money(
    item?.refund_subtotal ??
    item?.refund_amount ??
    item?.subtotal ??
    (Number(item?.unit_price || 0) * Number(item?.quantity || 0))
  )
}

function describeReturn(ret: any) {
  const items = Array.isArray(ret?.returned_items) ? ret.returned_items : []
  const productText = items.length > 0
    ? items.map((item: any) => {
      const name = item?.product_name || item?.base_name || item?.product_barcode || 'Producto'
      return `${Number(item?.quantity || 0)} x ${name}`
    }).join('; ')
    : 'sin detalle de productos'

  const date = ret?.return_date
    ? new Date(ret.return_date).toLocaleDateString('es-PE', { timeZone: PERU_TZ })
    : 's/f'

  return `${ret?.return_number || 'DEV'} (${ret?.status || 'N/A'}, ${date}): S/ ${getReturnTotal(ret).toFixed(2)} - ${productText}`
}

async function loadReturnsForSales(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  saleIds: string[]
) {
  const ids = Array.from(new Set(saleIds.filter(Boolean)))
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('returns')
    .select('id, sale_id, return_number, status, return_date, return_type, total_amount, refund_amount, returned_items')
    .in('sale_id', ids)
    .in('status', RETURN_STATUSES_FOR_NET)

  if (error) {
    console.warn('[reports] No se pudieron cargar devoluciones:', error.message)
    return []
  }

  return data || []
}

function buildReturnMaps(returns: any[]) {
  const bySale = new Map<string, { total: number; count: number; details: string[] }>()
  const bySaleItem = new Map<string, { quantity: number; amount: number }>()

  for (const ret of returns || []) {
    const saleId = ret?.sale_id
    if (!saleId) continue

    const saleSummary = bySale.get(saleId) || { total: 0, count: 0, details: [] }
    saleSummary.total = money(saleSummary.total + getReturnTotal(ret))
    saleSummary.count += 1
    saleSummary.details.push(describeReturn(ret))
    bySale.set(saleId, saleSummary)

    const items = Array.isArray(ret?.returned_items) ? ret.returned_items : []
    for (const item of items) {
      const saleItemId = item?.sale_item_id
      if (!saleItemId) continue

      const prev = bySaleItem.get(saleItemId) || { quantity: 0, amount: 0 }
      bySaleItem.set(saleItemId, {
        quantity: prev.quantity + Number(item?.quantity || 0),
        amount: money(prev.amount + getReturnItemTotal(item)),
      })
    }
  }

  return { bySale, bySaleItem }
}

function saleNetFields(sale: any, bySale: Map<string, { total: number; count: number; details: string[] }>) {
  const gross = money(sale?.total)
  const summary = bySale.get(sale?.id)
  const returned = money(summary?.total || 0)
  const net = money(Math.max(0, gross - returned))

  return {
    gross,
    returned,
    net,
    returnCount: summary?.count || 0,
    returnDetails: summary?.details?.join(' | ') || 'Sin devoluciones',
  }
}

function applyReturnToSaleItem(
  item: any,
  bySaleItem: Map<string, { quantity: number; amount: number }>,
  adjustedGrossRevenue?: number
) {
  const grossQuantity = Number(item?.quantity || 0)
  const grossRevenue = money(adjustedGrossRevenue ?? item?.subtotal)
  const returned = bySaleItem.get(item?.id) || { quantity: 0, amount: 0 }
  const returnedQuantity = Math.min(grossQuantity, Number(returned.quantity || 0))
  const returnedAmount = Math.min(grossRevenue, money(returned.amount))
  const netQuantity = Math.max(0, grossQuantity - returnedQuantity)
  const netRevenue = money(Math.max(0, grossRevenue - returnedAmount))

  return {
    grossQuantity,
    grossRevenue,
    returnedQuantity,
    returnedAmount,
    netQuantity,
    netRevenue,
  }
}

function buildSaleItemSubtotalMap(items: any[]) {
  return (items || []).reduce((acc: Map<string, number>, item: any) => {
    const saleId = item?.sale_id
    if (!saleId) return acc
    acc.set(saleId, money((acc.get(saleId) || 0) + Number(item?.subtotal || 0)))
    return acc
  }, new Map<string, number>())
}

function adjustedItemGrossRevenue(item: any, saleItemSubtotals: Map<string, number>) {
  const itemSubtotal = money(item?.subtotal)
  const saleTotal = money(item?.sales?.total)
  const saleItemsSubtotal = saleItemSubtotals.get(item?.sale_id) || itemSubtotal

  if (itemSubtotal <= 0 || saleTotal <= 0 || saleItemsSubtotal <= 0) return itemSubtotal
  return money(itemSubtotal * (saleTotal / saleItemsSubtotal))
}

const STORE_KEY_MAP: Record<string, string> = {
  'MUJERES':        'Tienda Mujeres',
  'HOMBRES':        'Tienda Hombres',
  'Tienda Mujeres': 'Tienda Mujeres',
  'Tienda Hombres': 'Tienda Hombres',
  'mujeres':        'Tienda Mujeres',
  'hombres':        'Tienda Hombres',
}

/**
 * Resuelve el filtro de tienda efectivo:
 * - Si el usuario no es admin y tiene solo 1 tienda asignada → fuerza ese filtro
 * - Si el usuario seleccionó un filtro manual → usa ese
 * - Si el usuario es admin y no seleccionó → sin filtro (ve todo)
 */
async function resolveStoreFilter(filters: ReportFilters): Promise<string | undefined> {
  // Si hay un filtro manual de warehouse, úsalo siempre
  if (filters.warehouse) return filters.warehouse

  // Leer perfil del usuario actual
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return undefined

    const { data: profile } = await supabase
      .from('users')
      .select('roles, stores')
      .eq('id', user.id)
      .single()

    if (!profile) return undefined

    const roles: string[] = ((profile as any).roles || []).map((r: string) => r.toLowerCase())
    const userStores: string[] = (profile as any).stores || []

    // Admin ve todo sin restricción
    if (roles.includes('admin')) return undefined

    // Si el usuario tiene exactamente 1 tienda asignada, aplicar automáticamente
    if (userStores.length === 1) {
      const mapped = STORE_KEY_MAP[userStores[0]]
      if (mapped) return mapped
    }
  } catch { /* silenciar errores */ }

  return undefined
}

/**
 * Funcion unificada para generar reportes.
 * Enruta cada reportId a su funcion de consulta directa correspondiente.
 * Aplica automáticamente el filtro de tienda según el rol del usuario.
 */
export async function generateReport(reportId: ReportTypeId, filters: ReportFilters) {
  try {
    if (filters.startDate && filters.endDate) {
      if (new Date(filters.startDate) > new Date(filters.endDate)) {
        return { success: false, error: 'La fecha de inicio debe ser anterior a la fecha fin', data: null }
      }
    }

    // Resolver filtro de tienda con aislamiento de usuario
    const effectiveWarehouse = await resolveStoreFilter(filters)
    const effectiveFilters: ReportFilters = { ...filters, warehouse: effectiveWarehouse }

    let data: any[] = []

    switch (reportId) {
      // Inventario
      case 'inventory-rotation':
      case 'stock-rotation':
        data = await generateStockRotationReport(effectiveFilters); break
      case 'inventory-valuation':
      case 'stock-valuation':
        data = await generateStockValuationReport(effectiveFilters); break
      case 'low-stock':
        data = await generateLowStockReport(effectiveFilters); break
      case 'kardex':
        data = await generateKardexReport(effectiveFilters); break

      // Ventas
      case 'sales-timeline':
      case 'sales-by-period':
        data = await generateSalesByPeriodReport(effectiveFilters); break
      case 'sales-by-month':
        data = await generateSalesByMonthReport(effectiveFilters); break
      case 'sales-summary':
        data = await generateSalesSummaryReport(effectiveFilters); break
      case 'sales-by-product':
        data = await generateSalesByProductReport(effectiveFilters); break
      case 'sales-by-category':
        data = await generateSalesByCategoryReport(effectiveFilters); break
      case 'credit-vs-cash':
        data = await generateCreditVsCashReport(effectiveFilters); break
      case 'sales-by-store':
        data = await generateSalesByStoreReport(effectiveFilters); break

      // Compras
      case 'purchases-by-supplier':
        data = await generatePurchasesBySupplierReport(effectiveFilters); break
      case 'purchases-by-period':
        data = await generatePurchasesByPeriodReport(effectiveFilters); break

      // Clientes
      case 'clients-debt':
      case 'clients-with-debt':
        data = await generateClientsWithDebtReport(effectiveFilters); break
      case 'overdue-installments':
        data = await generateOverdueInstallmentsReport(effectiveFilters); break
      case 'collection-effectiveness':
        data = await generateCollectionEffectivenessReport(effectiveFilters); break

      // Financiero
      case 'profit-margin':
        data = await generateProfitMarginReport(effectiveFilters); break
      case 'cash-flow':
        data = await generateCashFlowReport(effectiveFilters); break

      default:
        return { success: false, error: `Reporte '${reportId}' no reconocido`, data: null }
    }

    return { success: true, error: null, data }
  } catch (error) {
    console.error('[generateReport] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
      data: null
    }
  }
}

// ============================================================================
// INVENTARIO
// ============================================================================

export async function generateStockRotationReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  // Default: ultimos 90 dias
  const ninetyAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  let movQuery = supabase
    .from('movements')
    .select('*, products(id, name, barcode, purchase_price, price)')
    .eq('type', 'SALIDA')
    .gte('created_at', filters.startDate ? toPeruStart(filters.startDate) : ninetyAgo.toISOString())
    .lte('created_at', filters.endDate ? toPeruEnd(filters.endDate) : new Date().toISOString())

  // Filtrar por tienda — warehouse_id almacena el nombre ("Tienda Mujeres")
  if (filters.warehouse) movQuery = movQuery.eq('warehouse_id', filters.warehouse) as typeof movQuery

  const { data: movements } = await movQuery

  const productSales = movements?.reduce((acc: any, mov: any) => {
    const productId = mov.product_id
    if (!acc[productId]) {
      acc[productId] = { product: mov.products, totalSold: 0, transactions: 0 }
    }
    acc[productId].totalSold += Math.abs(mov.quantity)
    acc[productId].transactions += 1
    return acc
  }, {}) || {}

  let stockQuery = supabase.from('stock').select('product_id, quantity')
  if (filters.warehouse) stockQuery = stockQuery.eq('warehouse_id', filters.warehouse) as typeof stockQuery
  const { data: stock } = await stockQuery
  const stockMap = stock?.reduce((acc: any, s: any) => {
    acc[s.product_id] = (acc[s.product_id] || 0) + s.quantity
    return acc
  }, {}) || {}

  const report = Object.values(productSales).map((item: any) => {
    if (!item.product) return null
    const currentStock = stockMap[item.product.id] || 0
    const rotationNum = currentStock > 0 ? parseFloat((item.totalSold / currentStock).toFixed(2)) : 0
    return {
      barcode: item.product.barcode,
      name: item.product.name,
      totalSold: item.totalSold,
      currentStock,
      rotation: rotationNum,
      rotationLabel: currentStock > 0 ? rotationNum.toFixed(2) : 'N/A',
      transactions: item.transactions
    }
  }).filter(Boolean)

  return (report as any[]).sort((a, b) => b.totalSold - a.totalSold)
}

export async function generateStockValuationReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  let query = supabase
    .from('stock')
    .select('quantity, warehouse_id, products(id, name, barcode, purchase_price, price, categories(name), lines(name))')
    .gt('quantity', 0)

  if (filters.categoryId) query = query.eq('products.category_id', filters.categoryId)
  // Filtrar por tienda — warehouse_id almacena el nombre ("Tienda Mujeres")
  if (filters.warehouse) query = query.eq('warehouse_id', filters.warehouse) as typeof query

  const { data: stock } = await query

  return (stock || []).map((item: any) => ({
    barcode: item.products?.barcode || 'N/A',
    name: item.products?.name || 'N/A',
    category: item.products?.categories?.name || 'Sin categoria',
    line: item.products?.lines?.name || 'Sin linea',
    tienda: item.warehouse_id || 'N/A',
    quantity: item.quantity,
    costPrice: Number(item.products?.purchase_price || 0),
    salePrice: Number(item.products?.price || 0),
    totalCost: item.quantity * Number(item.products?.purchase_price || 0),
    totalSale: item.quantity * Number(item.products?.price || 0),
    potentialProfit: item.quantity * (Number(item.products?.price || 0) - Number(item.products?.purchase_price || 0))
  }))
}

export async function generateLowStockReport(filters: ReportFilters) {
  const supabase = await createServerClient()
  const minStock = filters.minStock || 5

  let query = supabase
    .from('stock')
    .select('quantity, warehouse_id, products(name, barcode, purchase_price, price, categories(name))')
    .lte('quantity', minStock)
    .order('quantity', { ascending: true })

  // Filtrar por tienda — warehouse_id almacena el nombre de la tienda ("Tienda Mujeres")
  if (filters.warehouse) query = query.eq('warehouse_id', filters.warehouse) as typeof query

  const { data: stock } = await query

  return (stock || []).map((item: any) => ({
    barcode: item.products?.barcode || 'N/A',
    name: item.products?.name || 'N/A',
    category: item.products?.categories?.name || 'Sin categoria',
    tienda: item.warehouse_id || 'N/A',
    currentStock: item.quantity,
    status: item.quantity === 0 ? 'Agotado' : 'Stock Bajo',
    costPrice: Number(item.products?.purchase_price || 0),
    salePrice: Number(item.products?.price || 0)
  }))
}

export async function generateKardexReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  let query = supabase
    .from('movements')
    .select('*, products(name, barcode)')
    .order('created_at', { ascending: false })

  if (filters.startDate) query = query.gte('created_at', toPeruStart(filters.startDate))
  if (filters.endDate) query = query.lte('created_at', toPeruEnd(filters.endDate))
  if (filters.productId) query = query.eq('product_id', filters.productId)
  if (filters.warehouseId) query = query.eq('warehouse_id', filters.warehouseId)

  const { data: movements } = await query

  return (movements || []).map((mov: any) => ({
    date: new Date(mov.created_at).toLocaleDateString('es-PE', { timeZone: PERU_TZ }),
    barcode: mov.products?.barcode || 'N/A',
    product: mov.products?.name || 'N/A',
    warehouse: mov.warehouse_id || 'N/A',
    type: mov.type === 'ENTRADA' ? 'Entrada' : 'Salida',
    quantity: Math.abs(mov.quantity),
    notes: mov.notes || 'N/A',
    reference: mov.reference || 'N/A'
  }))
}

// ============================================================================
// VENTAS
// ============================================================================

export async function generateSalesByPeriodReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  let query = supabase
    .from('sales')
    .select('*')
    .eq('voided', false)
    .order('created_at', { ascending: false })

  query = query.gte('created_at', filters.startDate ? toPeruStart(filters.startDate) : firstDay.toISOString())
  query = query.lte('created_at', filters.endDate ? toPeruEnd(filters.endDate) : lastDay.toISOString())
  if (filters.warehouse) query = query.eq('store_id', filters.warehouse)

  const { data: sales } = await query
  const returns = await loadReturnsForSales(supabase, (sales || []).map((sale: any) => sale.id))
  const { bySale } = buildReturnMaps(returns)

  return (sales || []).map((sale: any) => {
    const net = saleNetFields(sale, bySale)
    return {
      fecha: new Date(sale.created_at).toLocaleDateString('es-PE', { timeZone: PERU_TZ }),
      numeroVenta: sale.sale_number,
      tienda: sale.store_id === 'Tienda Hombres' ? 'Tienda Hombres' : 'Tienda Mujeres',
      tipo: sale.sale_type === 'CREDITO' ? 'Credito' : 'Contado',
      metodoPago: sale.payment_type || 'N/A',
      subtotal: Number(sale.subtotal),
      descuento: Number(sale.discount || 0),
      totalBruto: net.gross,
      devoluciones: net.returned,
      total: net.net,
      neto: net.net,
      devolucionesDetalle: net.returnDetails
    }
  })
}

/**
 * Ventas por Mes - Agrupa por MES (no por dia)
 * Por defecto: año en curso completo (enero 1 a hoy)
 */
export async function generateSalesByMonthReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  const now = new Date()
  // Default: enero 1 del año actual a hoy para mostrar todos los meses
  const defaultStart = new Date(now.getFullYear(), 0, 1)

  let query = supabase
    .from('sales')
    .select('*')
    .eq('voided', false)
    .order('created_at', { ascending: true })

  query = query.gte('created_at', filters.startDate ? toPeruStart(filters.startDate) : defaultStart.toISOString())
  query = query.lte('created_at', filters.endDate ? toPeruEnd(filters.endDate) : now.toISOString())
  if (filters.warehouse) query = query.eq('store_id', filters.warehouse)

  const { data: sales } = await query
  const returns = await loadReturnsForSales(supabase, (sales || []).map((sale: any) => sale.id))
  const { bySale } = buildReturnMaps(returns)

  // Agrupar por MES (YYYY-MM)
  const salesByMonth = (sales || []).reduce((acc: any, sale: any) => {
    const d = new Date(sale.created_at)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = d.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', timeZone: PERU_TZ })
    const net = saleNetFields(sale, bySale)

    if (!acc[monthKey]) {
      acc[monthKey] = {
        mes: monthLabel,
        mesKey: monthKey,
        cantidadVentas: 0,
        totalContado: 0,
        totalCredito: 0,
        totalBruto: 0,
        devoluciones: 0,
        total: 0
      }
    }
    acc[monthKey].cantidadVentas += 1
    acc[monthKey].totalBruto += net.gross
    acc[monthKey].devoluciones += net.returned
    if (sale.sale_type === 'CONTADO') {
      acc[monthKey].totalContado += net.net
    } else {
      acc[monthKey].totalCredito += net.net
    }
    acc[monthKey].total += net.net
    return acc
  }, {})

  return Object.values(salesByMonth)
    .sort((a: any, b: any) => a.mesKey.localeCompare(b.mesKey))
    .map(({ mesKey, ...rest }: any) => rest)
}

export async function generateSalesSummaryReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  let query = supabase.from('sales').select('*').eq('voided', false)
  query = query.gte('created_at', filters.startDate ? toPeruStart(filters.startDate) : firstDay.toISOString())
  query = query.lte('created_at', filters.endDate ? toPeruEnd(filters.endDate) : lastDay.toISOString())
  if (filters.warehouse) query = query.eq('store_id', filters.warehouse)

  const { data: sales } = await query
  const returns = await loadReturnsForSales(supabase, (sales || []).map((sale: any) => sale.id))
  const { bySale } = buildReturnMaps(returns)
  const salesWithNet = (sales || []).map((sale: any) => ({
    ...sale,
    _net: saleNetFields(sale, bySale)
  }))

  const totalSales = salesWithNet.length
  const totalGross = salesWithNet.reduce((s: number, r: any) => s + r._net.gross, 0)
  const totalReturns = salesWithNet.reduce((s: number, r: any) => s + r._net.returned, 0)
  const totalRevenue = salesWithNet.reduce((s: number, r: any) => s + r._net.net, 0)
  const cashSales = salesWithNet.filter((s: any) => s.sale_type === 'CONTADO')
  const creditSales = salesWithNet.filter((s: any) => s.sale_type === 'CREDITO')
  const totalCash = cashSales.reduce((s: number, r: any) => s + r._net.net, 0)
  const totalCredit = creditSales.reduce((s: number, r: any) => s + r._net.net, 0)
  const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0

  return [
    { concepto: 'Ventas Netas', valor: totalSales, monto: money(totalRevenue) },
    { concepto: 'Ventas Brutas', valor: totalSales, monto: money(totalGross) },
    { concepto: 'Devoluciones', valor: returns.length, monto: money(totalReturns) },
    { concepto: 'Ventas al Contado Netas', valor: cashSales.length, monto: money(totalCash) },
    { concepto: 'Ventas al Credito Netas', valor: creditSales.length, monto: money(totalCredit) },
    { concepto: 'Promedio por Venta Neto', valor: 1, monto: money(avgSale) }
  ]
}

export async function generateSalesByProductReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  let query = supabase
    .from('sale_items')
    .select('id, sale_id, product_id, quantity, unit_price, subtotal, sales!inner(id, created_at, voided, store_id, total), products(name, barcode, purchase_price)')
    .eq('sales.voided', false)

  if (filters.startDate) query = query.gte('sales.created_at', toPeruStart(filters.startDate))
  if (filters.endDate) query = query.lte('sales.created_at', toPeruEnd(filters.endDate))
  if (filters.warehouse) query = query.eq('sales.store_id', filters.warehouse)

  const { data: items } = await query
  const returns = await loadReturnsForSales(supabase, (items || []).map((item: any) => item.sale_id))
  const { bySaleItem } = buildReturnMaps(returns)
  const saleItemSubtotals = buildSaleItemSubtotalMap(items || [])

  const productSales = (items || []).reduce((acc: any, item: any) => {
    const barcode = item.products?.barcode || 'N/A'
    const net = applyReturnToSaleItem(item, bySaleItem, adjustedItemGrossRevenue(item, saleItemSubtotals))
    if (!acc[barcode]) {
      acc[barcode] = {
        barcode,
        name: item.products?.name || 'N/A',
        quantitySold: 0,
        quantityReturned: 0,
        grossRevenue: 0,
        returnedAmount: 0,
        totalRevenue: 0,
        totalCost: 0,
        transactions: 0
      }
    }
    acc[barcode].quantitySold += net.netQuantity
    acc[barcode].quantityReturned += net.returnedQuantity
    acc[barcode].grossRevenue += net.grossRevenue
    acc[barcode].returnedAmount += net.returnedAmount
    acc[barcode].totalRevenue += net.netRevenue
    acc[barcode].totalCost += net.netQuantity * Number(item.products?.purchase_price || 0)
    acc[barcode].transactions += 1
    return acc
  }, {})

  return Object.values(productSales).map((item: any) => ({
    ...item,
    profit: item.totalRevenue - item.totalCost,
    margin: item.totalRevenue > 0
      ? ((item.totalRevenue - item.totalCost) / item.totalRevenue * 100).toFixed(2) + '%'
      : '0%'
  })).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
}

export async function generateSalesByCategoryReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  let query = supabase
    .from('sale_items')
    .select('id, sale_id, product_id, quantity, unit_price, subtotal, sales!inner(id, created_at, voided, store_id, total), products!inner(name, barcode, purchase_price, categories(name))')
    .eq('sales.voided', false)

  query = query.gte('sales.created_at', filters.startDate ? toPeruStart(filters.startDate) : firstDay.toISOString())
  query = query.lte('sales.created_at', filters.endDate ? toPeruEnd(filters.endDate) : lastDay.toISOString())
  if (filters.warehouse) query = query.eq('sales.store_id', filters.warehouse)

  const { data: items } = await query
  const returns = await loadReturnsForSales(supabase, (items || []).map((item: any) => item.sale_id))
  const { bySaleItem } = buildReturnMaps(returns)
  const saleItemSubtotals = buildSaleItemSubtotalMap(items || [])

  const categoryData = (items || []).reduce((acc: any, item: any) => {
    const category = item.products?.categories?.name || 'Sin categoria'
    const net = applyReturnToSaleItem(item, bySaleItem, adjustedItemGrossRevenue(item, saleItemSubtotals))
    if (!acc[category]) {
      acc[category] = {
        categoria: category,
        cantidadVendida: 0,
        cantidadDevuelta: 0,
        ingresosBrutos: 0,
        devoluciones: 0,
        totalIngresos: 0,
        numeroTransacciones: 0,
        productos: new Set()
      }
    }
    acc[category].cantidadVendida += net.netQuantity
    acc[category].cantidadDevuelta += net.returnedQuantity
    acc[category].ingresosBrutos += net.grossRevenue
    acc[category].devoluciones += net.returnedAmount
    acc[category].totalIngresos += net.netRevenue
    acc[category].numeroTransacciones += 1
    acc[category].productos.add(item.products?.name)
    return acc
  }, {})

  return Object.values(categoryData).map((cat: any) => ({
    categoria: cat.categoria,
    cantidadVendida: cat.cantidadVendida,
    cantidadDevuelta: cat.cantidadDevuelta,
    ingresosBrutos: cat.ingresosBrutos,
    devoluciones: cat.devoluciones,
    totalIngresos: cat.totalIngresos,
    numeroTransacciones: cat.numeroTransacciones,
    productosUnicos: cat.productos.size
  })).sort((a: any, b: any) => b.totalIngresos - a.totalIngresos)
}

export async function generateCreditVsCashReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  let query = supabase.from('sales').select('*').eq('voided', false)
  query = query.gte('created_at', filters.startDate ? toPeruStart(filters.startDate) : firstDay.toISOString())
  query = query.lte('created_at', filters.endDate ? toPeruEnd(filters.endDate) : lastDay.toISOString())
  if (filters.warehouse) query = query.eq('store_id', filters.warehouse)

  const { data: sales } = await query
  const returns = await loadReturnsForSales(supabase, (sales || []).map((sale: any) => sale.id))
  const { bySale } = buildReturnMaps(returns)
  const salesWithNet = (sales || []).map((sale: any) => ({ ...sale, _net: saleNetFields(sale, bySale) }))
  const cashSales = salesWithNet.filter((s: any) => s.sale_type === 'CONTADO')
  const creditSales = salesWithNet.filter((s: any) => s.sale_type === 'CREDITO')

  return [
    {
      tipo: 'Contado',
      cantidad: cashSales.length,
      bruto: money(cashSales.reduce((s: number, r: any) => s + r._net.gross, 0)),
      devoluciones: money(cashSales.reduce((s: number, r: any) => s + r._net.returned, 0)),
      total: money(cashSales.reduce((s: number, r: any) => s + r._net.net, 0)),
      porcentaje: salesWithNet.length ? ((cashSales.length / salesWithNet.length) * 100).toFixed(2) + '%' : '0%'
    },
    {
      tipo: 'Credito',
      cantidad: creditSales.length,
      bruto: money(creditSales.reduce((s: number, r: any) => s + r._net.gross, 0)),
      devoluciones: money(creditSales.reduce((s: number, r: any) => s + r._net.returned, 0)),
      total: money(creditSales.reduce((s: number, r: any) => s + r._net.net, 0)),
      porcentaje: salesWithNet.length ? ((creditSales.length / salesWithNet.length) * 100).toFixed(2) + '%' : '0%'
    }
  ]
}

export async function generateSalesByStoreReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  let query = supabase.from('sales').select('*').eq('voided', false)
  query = query.gte('created_at', filters.startDate ? toPeruStart(filters.startDate) : firstDay.toISOString())
  query = query.lte('created_at', filters.endDate ? toPeruEnd(filters.endDate) : lastDay.toISOString())
  if (filters.warehouse) query = query.eq('store_id', filters.warehouse)

  const { data: sales } = await query
  const returns = await loadReturnsForSales(supabase, (sales || []).map((sale: any) => sale.id))
  const { bySale } = buildReturnMaps(returns)

  const storeData = (sales || []).reduce((acc: any, sale: any) => {
    const store = sale.store_id || 'Sin tienda'
    const storeName = store
    const net = saleNetFields(sale, bySale)

    if (!acc[storeName]) {
      acc[storeName] = { tienda: storeName, cantidadVentas: 0, totalBruto: 0, devoluciones: 0, totalContado: 0, totalCredito: 0, total: 0 }
    }
    acc[storeName].cantidadVentas += 1
    acc[storeName].totalBruto += net.gross
    acc[storeName].devoluciones += net.returned
    if (sale.sale_type === 'CONTADO') acc[storeName].totalContado += net.net
    else acc[storeName].totalCredito += net.net
    acc[storeName].total += net.net
    return acc
  }, {})

  return Object.values(storeData).sort((a: any, b: any) => b.total - a.total)
}

// ============================================================================
// COMPRAS - Default: ultimos 90 dias para mayor cobertura
// ============================================================================

export async function generatePurchasesBySupplierReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  // Default: ultimos 90 dias
  const ninetyAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  let query = supabase
    .from('movements')
    .select('*, products(name, barcode, purchase_price)')
    .eq('type', 'ENTRADA')
    .order('created_at', { ascending: false })

  query = query.gte('created_at', filters.startDate ? toPeruStart(filters.startDate) : ninetyAgo.toISOString())
  query = query.lte('created_at', filters.endDate ? toPeruEnd(filters.endDate) : new Date().toISOString())
  // Filtrar por tienda — warehouse_id almacena el nombre ("Tienda Mujeres")
  if (filters.warehouse) query = query.eq('warehouse_id', filters.warehouse) as typeof query

  const { data: movements } = await query

  // Agrupar por producto (no hay proveedor en movements)
  const byProduct = (movements || []).reduce((acc: any, mov: any) => {
    const key = mov.products?.barcode || 'N/A'
    if (!acc[key]) {
      acc[key] = {
        producto: mov.products?.name || 'N/A',
        barcode: key,
        totalUnidades: 0,
        totalCosto: 0,
        entradas: 0
      }
    }
    acc[key].totalUnidades += mov.quantity
    acc[key].totalCosto += mov.quantity * Number(mov.products?.purchase_price || 0)
    acc[key].entradas += 1
    return acc
  }, {})

  return Object.values(byProduct).sort((a: any, b: any) => b.totalCosto - a.totalCosto)
}

export async function generatePurchasesByPeriodReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  // Default: ultimos 90 dias
  const ninetyAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  let query = supabase
    .from('movements')
    .select('*, products(name, barcode, purchase_price)')
    .eq('type', 'ENTRADA')
    .order('created_at', { ascending: false })

  query = query.gte('created_at', filters.startDate ? toPeruStart(filters.startDate) : ninetyAgo.toISOString())
  query = query.lte('created_at', filters.endDate ? toPeruEnd(filters.endDate) : new Date().toISOString())
  // Filtrar por tienda — warehouse_id almacena el nombre ("Tienda Mujeres")
  if (filters.warehouse) query = query.eq('warehouse_id', filters.warehouse) as typeof query

  const { data: movements } = await query

  return (movements || []).map((mov: any) => ({
    fecha: new Date(mov.created_at).toLocaleDateString('es-PE', { timeZone: PERU_TZ }),
    producto: mov.products?.name || 'N/A',
    codigoBarras: mov.products?.barcode || 'N/A',
    cantidad: mov.quantity,
    costoUnitario: Number(mov.products?.purchase_price || 0),
    costoTotal: mov.quantity * Number(mov.products?.purchase_price || 0),
    referencia: mov.reference || 'N/A',
    notas: mov.notes || 'N/A'
  }))
}

// ============================================================================
// CLIENTES
// ============================================================================

export async function generateClientsWithDebtReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  // Consultar desde installments para datos mas precisos
  const { data: installments } = await supabase
    .from('installments')
    .select('amount, paid_amount, status, credit_plans!inner(client_id, clients(id, name, phone, address, credit_limit, credit_used))')
    .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])

  if (!installments?.length) {
    // Fallback: consultar clients.credit_used directamente
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .gt('credit_used', 0)
      .eq('active', true)
      .order('credit_used', { ascending: false })

    return (clients || []).map((client: any) => ({
      name: client.name,
      phone: client.phone || 'N/A',
      address: client.address || 'N/A',
      creditLimit: Number(client.credit_limit || 0),
      creditUsed: Number(client.credit_used || 0),
      overdueAmount: 0,
      overdueCount: 0,
      available: Number(client.credit_limit || 0) - Number(client.credit_used || 0),
      utilizationPercent: client.credit_limit > 0
        ? ((Number(client.credit_used) / Number(client.credit_limit)) * 100).toFixed(2) + '%'
        : '0%'
    }))
  }

  // Agrupar por cliente
  const byClient: any = {}
  for (const inst of installments) {
    const client = (inst.credit_plans as any)?.clients
    if (!client) continue
    const id = client.id
    if (!byClient[id]) {
      byClient[id] = {
        name: client.name,
        phone: client.phone || 'N/A',
        address: client.address || 'N/A',
        creditLimit: Number(client.credit_limit || 0),
        pending: 0,
        overdueAmount: 0,
        overdueCount: 0
      }
    }
    const balance = Number(inst.amount) - Number(inst.paid_amount)
    byClient[id].pending += balance
    if (inst.status === 'OVERDUE') {
      byClient[id].overdueAmount += balance
      byClient[id].overdueCount += 1
    }
  }

  return Object.values(byClient).map((c: any) => ({
    name: c.name,
    phone: c.phone,
    address: c.address,
    creditLimit: c.creditLimit,
    creditUsed: c.pending,
    overdueAmount: c.overdueAmount,
    overdueCount: c.overdueCount,
    available: c.creditLimit - c.pending,
    utilizationPercent: c.creditLimit > 0
      ? ((c.pending / c.creditLimit) * 100).toFixed(2) + '%'
      : '0%'
  })).sort((a: any, b: any) => b.creditUsed - a.creditUsed)
}

export async function generateOverdueInstallmentsReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  const { data: installments } = await supabase
    .from('installments')
    .select('*, credit_plans!inner(clients(name, phone))')
    .eq('status', 'OVERDUE')
    .order('due_date', { ascending: true })

  return (installments || []).map((inst: any) => ({
    client: inst.credit_plans?.clients?.name || 'N/A',
    phone: inst.credit_plans?.clients?.phone || 'N/A',
    installmentNumber: inst.installment_number,
    dueDate: new Date(inst.due_date).toLocaleDateString('es-PE', { timeZone: PERU_TZ }),
    amount: Number(inst.amount),
    paidAmount: Number(inst.paid_amount || 0),
    pending: Number(inst.amount) - Number(inst.paid_amount || 0),
    daysOverdue: Math.max(0, Math.floor((Date.now() - new Date(inst.due_date).getTime()) / (1000 * 60 * 60 * 24)))
  }))
}

// ============================================================================
// FINANCIERO
// ============================================================================

export async function generateCollectionEffectivenessReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [{ data: payments }, { data: overdue }] = await Promise.all([
    supabase
      .from('payments')
      .select('amount, payment_date')
      // Excluir pagos importados del sistema anterior — no son cobros del
      // trabajo de cobranza actual, son histórico migrado.
      .or('imported_from_legacy.is.null,imported_from_legacy.eq.false')
      .gte('payment_date', filters.startDate || firstDay.toLocaleDateString('en-CA', { timeZone: PERU_TZ }))
      .lte('payment_date', filters.endDate || lastDay.toLocaleDateString('en-CA', { timeZone: PERU_TZ })),
    supabase
      .from('installments')
      .select('amount, paid_amount, due_date')
      .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
      .lt('due_date', getTodayPeru())
  ])

  const totalCollected = (payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0)
  const totalOverdue = (overdue || []).reduce((s: number, i: any) => s + (Number(i.amount) - Number(i.paid_amount)), 0)
  const effectiveness = totalOverdue > 0
    ? Number(((totalCollected / (totalCollected + totalOverdue)) * 100).toFixed(2))
    : (totalCollected > 0 ? 100 : 0)

  return [
    { concepto: 'Total cobrado (periodo)', monto: totalCollected, transacciones: payments?.length || 0 },
    { concepto: 'Deuda vencida pendiente', monto: totalOverdue, transacciones: overdue?.length || 0 },
    { concepto: 'Efectividad de cobranza %', monto: effectiveness, transacciones: 0 }
  ]
}

export async function generateProfitMarginReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  let profitQuery = supabase
    .from('sale_items')
    .select('id, sale_id, product_id, quantity, unit_price, subtotal, sales!inner(id, created_at, voided, store_id, total), products(name, barcode, purchase_price)')
    .eq('sales.voided', false)
    .gte('sales.created_at', filters.startDate ? toPeruStart(filters.startDate) : firstDay.toISOString())
    .lte('sales.created_at', filters.endDate ? toPeruEnd(filters.endDate) : lastDay.toISOString())
  if (filters.warehouse) profitQuery = profitQuery.eq('sales.store_id', filters.warehouse)
  const { data: items } = await profitQuery
  const returns = await loadReturnsForSales(supabase, (items || []).map((item: any) => item.sale_id))
  const { bySaleItem } = buildReturnMaps(returns)
  const saleItemSubtotals = buildSaleItemSubtotalMap(items || [])

  const byProduct = (items || []).reduce((acc: any, item: any) => {
    const key = item.products?.barcode || 'unknown'
    const net = applyReturnToSaleItem(item, bySaleItem, adjustedItemGrossRevenue(item, saleItemSubtotals))
    if (!acc[key]) {
      acc[key] = {
        barcode: key,
        producto: item.products?.name || 'Desconocido',
        cantidadVendida: 0,
        cantidadDevuelta: 0,
        ingresosBrutos: 0,
        devoluciones: 0,
        ingresos: 0,
        costo: 0
      }
    }
    acc[key].cantidadVendida += net.netQuantity
    acc[key].cantidadDevuelta += net.returnedQuantity
    acc[key].ingresosBrutos += net.grossRevenue
    acc[key].devoluciones += net.returnedAmount
    acc[key].ingresos += net.netRevenue
    acc[key].costo += net.netQuantity * Number(item.products?.purchase_price || 0)
    return acc
  }, {})

  return Object.values(byProduct).map((p: any) => ({
    barcode: p.barcode,
    producto: p.producto,
    cantidadVendida: p.cantidadVendida,
    cantidadDevuelta: p.cantidadDevuelta,
    ingresosBrutos: p.ingresosBrutos,
    devoluciones: p.devoluciones,
    ingresos: p.ingresos,
    costo: p.costo,
    ganancia: p.ingresos - p.costo,
    margenPct: p.ingresos > 0
      ? ((p.ingresos - p.costo) / p.ingresos * 100).toFixed(2) + '%'
      : '0%',
    margenNum: p.ingresos > 0
      ? parseFloat(((p.ingresos - p.costo) / p.ingresos * 100).toFixed(2))
      : 0
  })).sort((a: any, b: any) => b.ganancia - a.ganancia)
}

export async function generateCashFlowReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  let salesQ = supabase
    .from('sales')
    .select('id, total, created_at, sale_type, store_id')
    .eq('voided', false)
    .gte('created_at', filters.startDate ? toPeruStart(filters.startDate) : firstDay.toISOString())
    .lte('created_at', filters.endDate ? toPeruEnd(filters.endDate) : lastDay.toISOString())
  if (filters.warehouse) salesQ = salesQ.eq('store_id', filters.warehouse)

  let cashExpQ = supabase
    .from('cash_expenses')
    .select('amount, category, description, created_at')
    .gte('created_at', filters.startDate ? toPeruStart(filters.startDate) : firstDay.toISOString())
    .lte('created_at', filters.endDate ? toPeruEnd(filters.endDate) : lastDay.toISOString())

  const [{ data: sales }, { data: payments }, { data: expenses }] = await Promise.all([
    salesQ,
    supabase
      .from('payments')
      .select('amount, payment_date')
      // Excluir pagos importados — son del sistema anterior, no flujo de caja real
      .or('imported_from_legacy.is.null,imported_from_legacy.eq.false')
      .gte('payment_date', filters.startDate || firstDay.toLocaleDateString('en-CA', { timeZone: PERU_TZ }))
      .lte('payment_date', filters.endDate || lastDay.toLocaleDateString('en-CA', { timeZone: PERU_TZ })),
    cashExpQ
  ])

  const returns = await loadReturnsForSales(supabase, (sales || []).map((sale: any) => sale.id))
  const { bySale } = buildReturnMaps(returns)
  const salesWithNet = (sales || []).map((sale: any) => ({ ...sale, _net: saleNetFields(sale, bySale) }))

  const cashGross = salesWithNet.filter((s: any) => s.sale_type === 'CONTADO').reduce((a: number, s: any) => a + s._net.gross, 0)
  const cashReturns = salesWithNet.filter((s: any) => s.sale_type === 'CONTADO').reduce((a: number, s: any) => a + s._net.returned, 0)
  const cashSales = money(Math.max(0, cashGross - cashReturns))
  const creditGross = salesWithNet.filter((s: any) => s.sale_type === 'CREDITO').reduce((a: number, s: any) => a + s._net.gross, 0)
  const creditReturns = salesWithNet.filter((s: any) => s.sale_type === 'CREDITO').reduce((a: number, s: any) => a + s._net.returned, 0)
  const creditSales = money(Math.max(0, creditGross - creditReturns))
  const cobros = (payments || []).reduce((a: number, p: any) => a + Number(p.amount), 0)
  const returnExpenses = (expenses || [])
    .filter((e: any) => String(e.category || '').toUpperCase() === 'DEVOLUCION')
    .reduce((a: number, e: any) => a + Number(e.amount), 0)
  const egresos = (expenses || [])
    .filter((e: any) => String(e.category || '').toUpperCase() !== 'DEVOLUCION')
    .reduce((a: number, e: any) => a + Number(e.amount), 0)
  const returnExpensesOutsideFilteredSales = money(Math.max(0, returnExpenses - cashReturns))
  const totalCashEgress = money(egresos + returnExpensesOutsideFilteredSales)

  return [
    { concepto: 'Ventas al contado netas', ingreso: cashSales, egreso: 0, neto: cashSales, bruto: money(cashGross), devoluciones: money(cashReturns) },
    { concepto: 'Cobros de credito', ingreso: cobros, egreso: 0, neto: cobros },
    { concepto: 'Ventas al credito netas (devengado)', ingreso: creditSales, egreso: 0, neto: creditSales, bruto: money(creditGross), devoluciones: money(creditReturns) },
    { concepto: 'Devoluciones descontadas de ventas', ingreso: 0, egreso: 0, neto: 0, bruto: money(cashReturns + creditReturns), devoluciones: money(cashReturns + creditReturns), egresosCajaRegistrados: money(returnExpenses) },
    { concepto: 'Devoluciones de caja fuera del filtro de ventas', ingreso: 0, egreso: returnExpensesOutsideFilteredSales, neto: -returnExpensesOutsideFilteredSales },
    { concepto: 'Otros egresos de caja', ingreso: 0, egreso: egresos, neto: -egresos },
    { concepto: 'FLUJO NETO', ingreso: cashSales + cobros, egreso: totalCashEgress, neto: cashSales + cobros - totalCashEgress }
  ]
}

// ============================================================================
// BACKUP
// ============================================================================

export async function generateDatabaseBackup() {
  const authClient = await createServerClient()
  const service = createServiceClient()

  try {
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return { success: false, error: 'No autorizado' }
    }

    const { data: profile, error: profileError } = await service
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return { success: false, error: 'No se pudo validar el rol admin' }
    }

    const roles: string[] = ((profile as any)?.roles || []).map((role: string) => role.toLowerCase())
    if (!roles.includes('admin')) {
      return { success: false, error: 'Solo administradores pueden generar backup completo' }
    }

    const adminTables = [
      'users', 'audit_logs', 'audit_log'
    ]

    // Tablas de catálogo y configuración
    const catalogTables = [
      'stores', 'lines', 'line_stores', 'categories', 'brands', 'sizes', 'suppliers',
      'supplier_brands', 'colors', 'warehouses', 'system_config'
    ]
    // Tablas de productos e inventario
    const inventoryTables = [
      'products', 'product_images', 'stock', 'movements'
    ]
    // Tablas de ventas
    const salesTables = [
      'sales', 'sale_items', 'returns'
    ]
    // Tablas de CRM y crédito
    const crmTables = [
      'clients', 'client_deactivations', 'client_action_logs', 'client_ratings',
      'credit_plans', 'installments', 'payment_allocations', 'payments',
      'client_visits', 'collection_actions'
    ]
    // Tablas operativas
    const operationsTables = [
      'agenda_reminders', 'agenda_scheduled_visits', 'tasks', 'routes', 'route_stops',
      'legacy_import_batches'
    ]
    // Tablas de caja y auditoría
    const otherTables = [
      'cash_shifts', 'cash_expenses'
    ]

    const allTables = [
      ...adminTables,
      ...catalogTables,
      ...inventoryTables,
      ...salesTables,
      ...crmTables,
      ...operationsTables,
      ...otherTables
    ]

    const backup: any = {
      timestamp: new Date().toISOString(),
      version: '2.0',
      tables: allTables,
      data: {}
    }

    const errors: string[] = []

    for (const table of allTables) {
      try {
        const { data, error } = await service.from(table).select('*')
        if (error) {
          console.warn(`[backup] Table ${table} error:`, error.message)
          errors.push(`${table}: ${error.message}`)
        } else if (data) {
          backup.data[table] = data
        }
      } catch (e) {
        errors.push(`${table}: ${e}`)
      }
    }

    if (errors.length > 0) {
      backup.errors = errors
    }

    return { success: true, data: backup }
  } catch (error) {
    console.error('Error generating backup:', error)
    return { success: false, error: 'Error al generar backup' }
  }
}
