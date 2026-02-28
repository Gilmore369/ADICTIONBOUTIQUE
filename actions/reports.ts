'use server'

import { createServerClient } from '@/lib/supabase/server'
import { ReportFilters, ReportTypeId } from '@/lib/reports/report-types'

/**
 * Funcion unificada para generar reportes.
 * Enruta cada reportId a su funcion de consulta directa correspondiente.
 */
export async function generateReport(reportId: ReportTypeId, filters: ReportFilters) {
  try {
    if (filters.startDate && filters.endDate) {
      if (new Date(filters.startDate) > new Date(filters.endDate)) {
        return { success: false, error: 'La fecha de inicio debe ser anterior a la fecha fin', data: null }
      }
    }

    let data: any[] = []

    switch (reportId) {
      // Inventario
      case 'inventory-rotation':
      case 'stock-rotation':            // legacy alias
        data = await generateStockRotationReport(filters); break
      case 'inventory-valuation':
      case 'stock-valuation':           // legacy alias
        data = await generateStockValuationReport(filters); break
      case 'low-stock':
        data = await generateLowStockReport(filters); break
      case 'kardex':
        data = await generateKardexReport(filters); break

      // Ventas
      case 'sales-timeline':
      case 'sales-by-period':           // legacy alias
        data = await generateSalesByPeriodReport(filters); break
      case 'sales-by-month':
        data = await generateSalesByMonthReport(filters); break
      case 'sales-summary':
        data = await generateSalesSummaryReport(filters); break
      case 'sales-by-product':
        data = await generateSalesByProductReport(filters); break
      case 'sales-by-category':
        data = await generateSalesByCategoryReport(filters); break
      case 'credit-vs-cash':
        data = await generateCreditVsCashReport(filters); break
      case 'sales-by-store':
        data = await generateSalesByStoreReport(filters); break

      // Compras
      case 'purchases-by-supplier':
        data = await generatePurchasesBySupplierReport(filters); break
      case 'purchases-by-period':
        data = await generatePurchasesByPeriodReport(filters); break

      // Clientes
      case 'clients-debt':
      case 'clients-with-debt':         // legacy alias
        data = await generateClientsWithDebtReport(filters); break
      case 'overdue-installments':
        data = await generateOverdueInstallmentsReport(filters); break
      case 'collection-effectiveness':
        data = await generateCollectionEffectivenessReport(filters); break

      // Financiero
      case 'profit-margin':
        data = await generateProfitMarginReport(filters); break
      case 'cash-flow':
        data = await generateCashFlowReport(filters); break

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

  const { data: movements } = await supabase
    .from('movements')
    .select('*, products(id, name, barcode, purchase_price, price)')
    .eq('type', 'SALIDA')
    .gte('created_at', filters.startDate || ninetyAgo.toISOString())
    .lte('created_at', filters.endDate || new Date().toISOString())

  const productSales = movements?.reduce((acc: any, mov: any) => {
    const productId = mov.product_id
    if (!acc[productId]) {
      acc[productId] = { product: mov.products, totalSold: 0, transactions: 0 }
    }
    acc[productId].totalSold += Math.abs(mov.quantity)
    acc[productId].transactions += 1
    return acc
  }, {}) || {}

  const { data: stock } = await supabase.from('stock').select('product_id, quantity')
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
    .select('quantity, products(id, name, barcode, purchase_price, price, categories(name), lines(name))')
    .gt('quantity', 0)

  if (filters.categoryId) {
    query = query.eq('products.category_id', filters.categoryId)
  }

  const { data: stock } = await query

  return (stock || []).map((item: any) => ({
    barcode: item.products?.barcode || 'N/A',
    name: item.products?.name || 'N/A',
    category: item.products?.categories?.name || 'Sin categoria',
    line: item.products?.lines?.name || 'Sin linea',
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

  const { data: stock } = await supabase
    .from('stock')
    .select('quantity, products(name, barcode, purchase_price, price, categories(name))')
    .lte('quantity', minStock)
    .order('quantity', { ascending: true })

  return (stock || []).map((item: any) => ({
    barcode: item.products?.barcode || 'N/A',
    name: item.products?.name || 'N/A',
    category: item.products?.categories?.name || 'Sin categoria',
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

  if (filters.startDate) query = query.gte('created_at', filters.startDate)
  if (filters.endDate) query = query.lte('created_at', filters.endDate)
  if (filters.productId) query = query.eq('product_id', filters.productId)
  if (filters.warehouseId) query = query.eq('warehouse_id', filters.warehouseId)

  const { data: movements } = await query

  return (movements || []).map((mov: any) => ({
    date: new Date(mov.created_at).toLocaleDateString('es-PE'),
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

  query = query.gte('created_at', filters.startDate || firstDay.toISOString())
  query = query.lte('created_at', filters.endDate || lastDay.toISOString())
  if (filters.warehouse) query = query.eq('store_id', filters.warehouse)

  const { data: sales } = await query

  return (sales || []).map((sale: any) => ({
    fecha: new Date(sale.created_at).toLocaleDateString('es-PE'),
    numeroVenta: sale.sale_number,
    tienda: sale.store_id === 'Tienda Hombres' ? 'Tienda Hombres' : 'Tienda Mujeres',
    tipo: sale.sale_type === 'CREDITO' ? 'Credito' : 'Contado',
    metodoPago: sale.payment_type || 'N/A',
    subtotal: Number(sale.subtotal),
    descuento: Number(sale.discount || 0),
    total: Number(sale.total)
  }))
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

  query = query.gte('created_at', filters.startDate || defaultStart.toISOString())
  query = query.lte('created_at', filters.endDate || now.toISOString())

  const { data: sales } = await query

  // Agrupar por MES (YYYY-MM)
  const salesByMonth = (sales || []).reduce((acc: any, sale: any) => {
    const d = new Date(sale.created_at)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = d.toLocaleDateString('es-PE', { year: 'numeric', month: 'short' })

    if (!acc[monthKey]) {
      acc[monthKey] = {
        mes: monthLabel,
        mesKey: monthKey,
        cantidadVentas: 0,
        totalContado: 0,
        totalCredito: 0,
        total: 0
      }
    }
    acc[monthKey].cantidadVentas += 1
    if (sale.sale_type === 'CONTADO') {
      acc[monthKey].totalContado += Number(sale.total)
    } else {
      acc[monthKey].totalCredito += Number(sale.total)
    }
    acc[monthKey].total += Number(sale.total)
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
  query = query.gte('created_at', filters.startDate || firstDay.toISOString())
  query = query.lte('created_at', filters.endDate || lastDay.toISOString())

  const { data: sales } = await query

  const totalSales = sales?.length || 0
  const totalRevenue = sales?.reduce((s: number, r: any) => s + Number(r.total), 0) || 0
  const totalCash = sales?.filter((s: any) => s.sale_type === 'CONTADO').reduce((s: number, r: any) => s + Number(r.total), 0) || 0
  const totalCredit = sales?.filter((s: any) => s.sale_type === 'CREDITO').reduce((s: number, r: any) => s + Number(r.total), 0) || 0
  const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0

  return [
    { concepto: 'Total Ventas', valor: totalSales, monto: totalRevenue },
    { concepto: 'Ventas al Contado', valor: sales?.filter((s: any) => s.sale_type === 'CONTADO').length || 0, monto: totalCash },
    { concepto: 'Ventas al Credito', valor: sales?.filter((s: any) => s.sale_type === 'CREDITO').length || 0, monto: totalCredit },
    { concepto: 'Promedio por Venta', valor: 1, monto: avgSale }
  ]
}

export async function generateSalesByProductReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  let query = supabase
    .from('sale_items')
    .select('quantity, unit_price, subtotal, sales!inner(created_at, voided, store_id), products(name, barcode, purchase_price)')
    .eq('sales.voided', false)

  if (filters.startDate) query = query.gte('sales.created_at', filters.startDate)
  if (filters.endDate) query = query.lte('sales.created_at', filters.endDate)
  if (filters.warehouse) query = query.eq('sales.store_id', filters.warehouse)

  const { data: items } = await query

  const productSales = (items || []).reduce((acc: any, item: any) => {
    const barcode = item.products?.barcode || 'N/A'
    if (!acc[barcode]) {
      acc[barcode] = {
        barcode,
        name: item.products?.name || 'N/A',
        quantitySold: 0,
        totalRevenue: 0,
        totalCost: 0,
        transactions: 0
      }
    }
    acc[barcode].quantitySold += item.quantity
    acc[barcode].totalRevenue += Number(item.subtotal)
    acc[barcode].totalCost += item.quantity * Number(item.products?.purchase_price || 0)
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
    .select('quantity, unit_price, subtotal, sales!inner(created_at, voided, store_id), products!inner(name, barcode, purchase_price, categories(name))')
    .eq('sales.voided', false)

  query = query.gte('sales.created_at', filters.startDate || firstDay.toISOString())
  query = query.lte('sales.created_at', filters.endDate || lastDay.toISOString())
  if (filters.warehouse) query = query.eq('sales.store_id', filters.warehouse)

  const { data: items } = await query

  const categoryData = (items || []).reduce((acc: any, item: any) => {
    const category = item.products?.categories?.name || 'Sin categoria'
    if (!acc[category]) {
      acc[category] = {
        categoria: category,
        cantidadVendida: 0,
        totalIngresos: 0,
        numeroTransacciones: 0,
        productos: new Set()
      }
    }
    acc[category].cantidadVendida += item.quantity
    acc[category].totalIngresos += Number(item.subtotal)
    acc[category].numeroTransacciones += 1
    acc[category].productos.add(item.products?.name)
    return acc
  }, {})

  return Object.values(categoryData).map((cat: any) => ({
    categoria: cat.categoria,
    cantidadVendida: cat.cantidadVendida,
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
  query = query.gte('created_at', filters.startDate || firstDay.toISOString())
  query = query.lte('created_at', filters.endDate || lastDay.toISOString())

  const { data: sales } = await query
  const cashSales = (sales || []).filter((s: any) => s.sale_type === 'CONTADO')
  const creditSales = (sales || []).filter((s: any) => s.sale_type === 'CREDITO')

  return [
    {
      tipo: 'Contado',
      cantidad: cashSales.length,
      total: cashSales.reduce((s: number, r: any) => s + Number(r.total), 0),
      porcentaje: sales?.length ? ((cashSales.length / sales.length) * 100).toFixed(2) + '%' : '0%'
    },
    {
      tipo: 'Credito',
      cantidad: creditSales.length,
      total: creditSales.reduce((s: number, r: any) => s + Number(r.total), 0),
      porcentaje: sales?.length ? ((creditSales.length / sales.length) * 100).toFixed(2) + '%' : '0%'
    }
  ]
}

export async function generateSalesByStoreReport(filters: ReportFilters) {
  const supabase = await createServerClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  let query = supabase.from('sales').select('*').eq('voided', false)
  query = query.gte('created_at', filters.startDate || firstDay.toISOString())
  query = query.lte('created_at', filters.endDate || lastDay.toISOString())

  const { data: sales } = await query

  const storeData = (sales || []).reduce((acc: any, sale: any) => {
    const store = sale.store_id || 'Sin tienda'
    const storeName = store

    if (!acc[storeName]) {
      acc[storeName] = { tienda: storeName, cantidadVentas: 0, totalContado: 0, totalCredito: 0, total: 0 }
    }
    acc[storeName].cantidadVentas += 1
    if (sale.sale_type === 'CONTADO') acc[storeName].totalContado += Number(sale.total)
    else acc[storeName].totalCredito += Number(sale.total)
    acc[storeName].total += Number(sale.total)
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

  query = query.gte('created_at', filters.startDate || ninetyAgo.toISOString())
  query = query.lte('created_at', filters.endDate || new Date().toISOString())

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

  query = query.gte('created_at', filters.startDate || ninetyAgo.toISOString())
  query = query.lte('created_at', filters.endDate || new Date().toISOString())

  const { data: movements } = await query

  return (movements || []).map((mov: any) => ({
    fecha: new Date(mov.created_at).toLocaleDateString('es-PE'),
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
    dueDate: new Date(inst.due_date).toLocaleDateString('es-PE'),
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
      .gte('payment_date', filters.startDate || firstDay.toISOString().split('T')[0])
      .lte('payment_date', filters.endDate || lastDay.toISOString().split('T')[0]),
    supabase
      .from('installments')
      .select('amount, paid_amount, due_date')
      .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
      .lt('due_date', new Date().toISOString().split('T')[0])
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

  const { data: items } = await supabase
    .from('sale_items')
    .select('quantity, unit_price, subtotal, sales!inner(created_at, voided), products(name, barcode, purchase_price)')
    .eq('sales.voided', false)
    .gte('sales.created_at', filters.startDate || firstDay.toISOString())
    .lte('sales.created_at', filters.endDate || lastDay.toISOString())

  const byProduct = (items || []).reduce((acc: any, item: any) => {
    const key = item.products?.barcode || 'unknown'
    if (!acc[key]) {
      acc[key] = {
        barcode: key,
        producto: item.products?.name || 'Desconocido',
        cantidadVendida: 0,
        ingresos: 0,
        costo: 0
      }
    }
    acc[key].cantidadVendida += item.quantity
    acc[key].ingresos += Number(item.subtotal)
    acc[key].costo += item.quantity * Number(item.products?.purchase_price || 0)
    return acc
  }, {})

  return Object.values(byProduct).map((p: any) => ({
    barcode: p.barcode,
    producto: p.producto,
    cantidadVendida: p.cantidadVendida,
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

  const [{ data: sales }, { data: payments }, { data: expenses }] = await Promise.all([
    supabase
      .from('sales')
      .select('total, created_at, sale_type')
      .eq('voided', false)
      .gte('created_at', filters.startDate || firstDay.toISOString())
      .lte('created_at', filters.endDate || lastDay.toISOString()),
    supabase
      .from('payments')
      .select('amount, payment_date')
      .gte('payment_date', filters.startDate || firstDay.toISOString().split('T')[0])
      .lte('payment_date', filters.endDate || lastDay.toISOString().split('T')[0]),
    supabase
      .from('cash_expenses')
      .select('amount, description, created_at')
      .gte('created_at', filters.startDate || firstDay.toISOString())
      .lte('created_at', filters.endDate || lastDay.toISOString())
  ])

  const cashSales = (sales || []).filter((s: any) => s.sale_type === 'CONTADO').reduce((a: number, s: any) => a + Number(s.total), 0)
  const creditSales = (sales || []).filter((s: any) => s.sale_type === 'CREDITO').reduce((a: number, s: any) => a + Number(s.total), 0)
  const cobros = (payments || []).reduce((a: number, p: any) => a + Number(p.amount), 0)
  const egresos = (expenses || []).reduce((a: number, e: any) => a + Number(e.amount), 0)

  return [
    { concepto: 'Ventas al contado', ingreso: cashSales, egreso: 0, neto: cashSales },
    { concepto: 'Cobros de credito', ingreso: cobros, egreso: 0, neto: cobros },
    { concepto: 'Ventas al credito (devengado)', ingreso: creditSales, egreso: 0, neto: creditSales },
    { concepto: 'Egresos de caja', ingreso: 0, egreso: egresos, neto: -egresos },
    { concepto: 'FLUJO NETO', ingreso: cashSales + cobros, egreso: egresos, neto: cashSales + cobros - egresos }
  ]
}

// ============================================================================
// BACKUP
// ============================================================================

export async function generateDatabaseBackup() {
  const supabase = await createServerClient()

  try {
    const tables = ['products', 'categories', 'brands', 'lines', 'sizes', 'suppliers',
      'warehouses', 'stock', 'movements', 'sales', 'sale_items',
      'clients', 'credit_plans', 'installments', 'payments']

    const backup: any = { timestamp: new Date().toISOString(), version: '1.0', data: {} }

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*')
      if (!error && data) backup.data[table] = data
    }

    return { success: true, data: backup }
  } catch (error) {
    console.error('Error generating backup:', error)
    return { success: false, error: 'Error al generar backup' }
  }
}
