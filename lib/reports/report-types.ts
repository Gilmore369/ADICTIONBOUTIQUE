/**
 * Tipos de reportes disponibles
 */

export const REPORT_TYPES = {
  // Reportes de Inventario
  INVENTORY_ROTATION: {
    id: 'inventory-rotation',
    name: 'Rotación de Inventario',
    category: 'inventory',
    description: 'Análisis de rotación de inventario por producto'
  },
  INVENTORY_VALUATION: {
    id: 'inventory-valuation',
    name: 'Valorización de Inventario',
    category: 'inventory',
    description: 'Valor total del inventario por producto y categoría'
  },
  STOCK_ROTATION: {
    id: 'stock-rotation',
    name: 'Rotación de Stock (Legacy)',
    category: 'inventory',
    description: 'Análisis de rotación de inventario por producto'
  },
  STOCK_VALUATION: {
    id: 'stock-valuation',
    name: 'Valorización de Stock (Legacy)',
    category: 'inventory',
    description: 'Valor total del inventario por producto y categoría'
  },
  LOW_STOCK: {
    id: 'low-stock',
    name: 'Stock Bajo',
    category: 'inventory',
    description: 'Productos con stock bajo o agotado'
  },
  KARDEX: {
    id: 'kardex',
    name: 'Kardex de Movimientos',
    category: 'inventory',
    description: 'Historial completo de movimientos de inventario'
  },
  
  // Reportes de Ventas
  SALES_TIMELINE: {
    id: 'sales-timeline',
    name: 'Timeline de Ventas',
    category: 'sales',
    description: 'Análisis temporal de ventas con tendencias'
  },
  SALES_BY_PRODUCT: {
    id: 'sales-by-product',
    name: 'Ventas por Producto',
    category: 'sales',
    description: 'Productos más vendidos y su rendimiento'
  },
  SALES_BY_CATEGORY: {
    id: 'sales-by-category',
    name: 'Ventas por Categoría',
    category: 'sales',
    description: 'Análisis de ventas por categoría de producto'
  },
  SALES_BY_PERIOD: {
    id: 'sales-by-period',
    name: 'Ventas por Período (Legacy)',
    category: 'sales',
    description: 'Resumen de ventas por día, semana o mes'
  },
  SALES_BY_MONTH: {
    id: 'sales-by-month',
    name: 'Ventas por Mes',
    category: 'sales',
    description: 'Análisis completo de ventas mensuales con estadísticas'
  },
  CREDIT_VS_CASH: {
    id: 'credit-vs-cash',
    name: 'Crédito vs Contado',
    category: 'sales',
    description: 'Comparación entre ventas al crédito y contado'
  },
  SALES_SUMMARY: {
    id: 'sales-summary',
    name: 'Resumen de Ventas',
    category: 'sales',
    description: 'Resumen general con totales y promedios'
  },
  SALES_BY_STORE: {
    id: 'sales-by-store',
    name: 'Ventas por Tienda',
    category: 'sales',
    description: 'Comparación de ventas entre tienda de hombres y mujeres'
  },
  
  // Reportes de Compras
  PURCHASES_BY_SUPPLIER: {
    id: 'purchases-by-supplier',
    name: 'Compras por Proveedor',
    category: 'purchases',
    description: 'Análisis de compras realizadas a cada proveedor'
  },
  PURCHASES_BY_PERIOD: {
    id: 'purchases-by-period',
    name: 'Compras por Período',
    category: 'purchases',
    description: 'Historial de compras en el tiempo'
  },
  
  // Reportes de Clientes
  CLIENTS_DEBT: {
    id: 'clients-debt',
    name: 'Deuda de Clientes',
    category: 'clients',
    description: 'Análisis detallado de cartera de crédito'
  },
  CLIENTS_WITH_DEBT: {
    id: 'clients-with-debt',
    name: 'Clientes con Deuda (Legacy)',
    category: 'clients',
    description: 'Listado de clientes con saldo pendiente'
  },
  OVERDUE_INSTALLMENTS: {
    id: 'overdue-installments',
    name: 'Cuotas Vencidas',
    category: 'clients',
    description: 'Cuotas vencidas por cliente'
  },
  COLLECTION_EFFECTIVENESS: {
    id: 'collection-effectiveness',
    name: 'Efectividad de Cobranza',
    category: 'clients',
    description: 'Análisis de efectividad en gestión de cobranza'
  },
  
  // Reportes Financieros
  PROFIT_MARGIN: {
    id: 'profit-margin',
    name: 'Margen de Ganancia',
    category: 'financial',
    description: 'Análisis de márgenes de ganancia por producto'
  },
  CASH_FLOW: {
    id: 'cash-flow',
    name: 'Flujo de Caja',
    category: 'financial',
    description: 'Ingresos y egresos en el período'
  }
} as const

export type ReportTypeId = typeof REPORT_TYPES[keyof typeof REPORT_TYPES]['id']
export type ReportCategory = 'inventory' | 'sales' | 'purchases' | 'clients' | 'financial'

export interface ReportFilters {
  startDate?: string
  endDate?: string
  productId?: string
  categoryId?: string
  supplierId?: string
  clientId?: string
  warehouse?: string
  warehouseId?: string
  minStock?: number
  maxStock?: number
}

/**
 * Report Output Structure
 * All RPC functions must return this structure
 */
export interface Report_Output {
  kpis: KPI[]
  series: Series[]
  rows: Row[]
  meta: Meta
}

export interface KPI {
  label: string
  value: number
  format: 'number' | 'currency' | 'percent' | 'decimal'
}

export interface Series {
  name: string
  points: Point[]
}

export interface Point {
  x: string  // Can be date, category, product name
  y: number
}

export type Row = Record<string, any>  // Flexible structure depending on report

export interface Meta {
  columns: Column[]
}

export interface Column {
  key: string
  label: string
  type: 'string' | 'number' | 'currency' | 'percent' | 'decimal' | 'date'
}

/**
 * Report Configuration
 * Defines the structure and behavior of each report type
 */
export interface ReportConfig {
  id: ReportTypeId
  name: string
  description: string
  category: ReportCategory
  rpcFunction: string
  availableFilters: Array<keyof ReportFilters>
  defaultFilters?: Partial<ReportFilters>
}

/**
 * Report Configurations
 * Central configuration for all available reports
 */
export const REPORT_CONFIGS: Record<string, ReportConfig> = {
  // Inventory Reports
  'inventory-rotation': {
    id: 'inventory-rotation',
    name: 'Rotación de Inventario',
    description: 'Análisis de rotación de inventario por producto',
    category: 'inventory',
    rpcFunction: 'report_inventory_rotation',
    availableFilters: ['startDate', 'endDate', 'warehouseId', 'categoryId', 'productId'],
    defaultFilters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  'inventory-valuation': {
    id: 'inventory-valuation',
    name: 'Valorización de Inventario',
    description: 'Valor total del inventario por producto y categoría',
    category: 'inventory',
    rpcFunction: 'report_inventory_valuation',
    availableFilters: ['warehouseId', 'categoryId', 'productId'],
    defaultFilters: {}
  },
  'low-stock': {
    id: 'low-stock',
    name: 'Stock Bajo',
    description: 'Productos con stock bajo o agotado',
    category: 'inventory',
    rpcFunction: 'report_low_stock',
    availableFilters: ['warehouseId', 'categoryId', 'minStock'],
    defaultFilters: {
      minStock: 5
    }
  },
  'kardex': {
    id: 'kardex',
    name: 'Kardex de Movimientos',
    description: 'Historial completo de movimientos de inventario',
    category: 'inventory',
    rpcFunction: 'report_kardex',
    availableFilters: ['startDate', 'endDate', 'productId', 'warehouseId'],
    defaultFilters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  
  // Sales Reports
  'sales-timeline': {
    id: 'sales-timeline',
    name: 'Timeline de Ventas',
    description: 'Análisis temporal de ventas con tendencias',
    category: 'sales',
    rpcFunction: 'report_sales_timeline',
    availableFilters: ['startDate', 'endDate'],
    defaultFilters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  'sales-by-month': {
    id: 'sales-by-month',
    name: 'Ventas por Mes',
    description: 'Análisis completo de ventas mensuales con estadísticas',
    category: 'sales',
    rpcFunction: 'report_sales_by_month',
    availableFilters: ['startDate', 'endDate'],
    defaultFilters: {
      startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  'sales-by-product': {
    id: 'sales-by-product',
    name: 'Ventas por Producto',
    description: 'Productos más vendidos y su rendimiento',
    category: 'sales',
    rpcFunction: 'report_sales_by_product',
    availableFilters: ['startDate', 'endDate', 'categoryId', 'productId'],
    defaultFilters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  'sales-by-category': {
    id: 'sales-by-category',
    name: 'Ventas por Categoría',
    description: 'Análisis de ventas por categoría de producto',
    category: 'sales',
    rpcFunction: 'report_sales_by_category',
    availableFilters: ['startDate', 'endDate', 'categoryId'],
    defaultFilters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  'credit-vs-cash': {
    id: 'credit-vs-cash',
    name: 'Crédito vs Contado',
    description: 'Comparación entre ventas al crédito y contado',
    category: 'sales',
    rpcFunction: 'report_credit_vs_cash',
    availableFilters: ['startDate', 'endDate'],
    defaultFilters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  'sales-summary': {
    id: 'sales-summary',
    name: 'Resumen de Ventas',
    description: 'Resumen general con totales y promedios',
    category: 'sales',
    rpcFunction: 'report_sales_summary',
    availableFilters: ['startDate', 'endDate'],
    defaultFilters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  'sales-by-store': {
    id: 'sales-by-store',
    name: 'Ventas por Tienda',
    description: 'Comparación de ventas entre tienda de hombres y mujeres',
    category: 'sales',
    rpcFunction: 'report_sales_by_store',
    availableFilters: ['startDate', 'endDate'],
    defaultFilters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  
  // Purchase Reports
  'purchases-by-supplier': {
    id: 'purchases-by-supplier',
    name: 'Compras por Proveedor',
    description: 'Análisis de compras realizadas a cada proveedor',
    category: 'purchases',
    rpcFunction: 'report_purchases_by_supplier',
    availableFilters: ['startDate', 'endDate', 'supplierId'],
    defaultFilters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  'purchases-by-period': {
    id: 'purchases-by-period',
    name: 'Compras por Período',
    description: 'Historial de compras en el tiempo',
    category: 'purchases',
    rpcFunction: 'report_purchases_by_period',
    availableFilters: ['startDate', 'endDate', 'supplierId'],
    defaultFilters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  
  // Client Reports
  'clients-debt': {
    id: 'clients-debt',
    name: 'Deuda de Clientes',
    description: 'Análisis detallado de cartera de crédito',
    category: 'clients',
    rpcFunction: 'report_clients_debt',
    availableFilters: ['clientId'],
    defaultFilters: {}
  },
  'overdue-installments': {
    id: 'overdue-installments',
    name: 'Cuotas Vencidas',
    description: 'Cuotas vencidas por cliente',
    category: 'clients',
    rpcFunction: 'report_overdue_installments',
    availableFilters: ['clientId'],
    defaultFilters: {}
  },
  'collection-effectiveness': {
    id: 'collection-effectiveness',
    name: 'Efectividad de Cobranza',
    description: 'Análisis de efectividad en gestión de cobranza',
    category: 'clients',
    rpcFunction: 'report_collection_effectiveness',
    availableFilters: ['startDate', 'endDate'],
    defaultFilters: {
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  
  // Financial Reports
  'profit-margin': {
    id: 'profit-margin',
    name: 'Margen de Ganancia',
    description: 'Análisis de márgenes de ganancia por producto',
    category: 'financial',
    rpcFunction: 'report_profit_margin',
    availableFilters: ['startDate', 'endDate', 'categoryId', 'productId'],
    defaultFilters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  'cash-flow': {
    id: 'cash-flow',
    name: 'Flujo de Caja',
    description: 'Ingresos y egresos en el período',
    category: 'financial',
    rpcFunction: 'report_cash_flow',
    availableFilters: ['startDate', 'endDate'],
    defaultFilters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  }
}
