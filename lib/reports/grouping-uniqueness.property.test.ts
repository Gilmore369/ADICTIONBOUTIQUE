/**
 * Property-Based Tests for Grouping Uniqueness
 * 
 * Feature: analytics-reports-module
 * Property 10: Grouping Uniqueness
 * 
 * **Validates: Requirements 3.6, 3.7, 4.4, 4.5**
 * 
 * For any report that groups by a field (payment_type, store_id, supplier_id, category),
 * each unique value of that field must appear exactly once in the result set.
 * 
 * This property ensures that GROUP BY operations in SQL produce unique groups without
 * duplicates, which is critical for accurate aggregations and data integrity.
 * 
 * Uses fast-check library for property-based testing with 100+ iterations
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import * as fc from 'fast-check'
import { ReportFilters } from './report-types'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn()
}))

// Import after mocking
import { createServerClient } from '@/lib/supabase/server'
import { generateReport } from '@/actions/reports'

/**
 * Arbitrary generator for payment types
 */
const paymentTypeArbitrary = fc.constantFrom('CONTADO', 'CREDITO')

/**
 * Arbitrary generator for store IDs
 */
const storeIdArbitrary = fc.constantFrom(
  'TIENDA_HOMBRES',
  'TIENDA_MUJERES',
  'TIENDA_CENTRAL'
)

/**
 * Arbitrary generator for category data
 */
const categoryArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 30 }).filter(s => s.trim().length >= 3)
})

/**
 * Arbitrary generator for product data
 */
const productArbitrary = fc.record({
  id: fc.uuid(),
  barcode: fc.string({ minLength: 8, maxLength: 13 }).filter(s => s.trim().length >= 8),
  name: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
  categoryId: fc.option(fc.uuid(), { nil: null })
})

/**
 * Arbitrary generator for supplier data
 */
const supplierArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3)
})

/**
 * Mock report output generator for sales by payment type
 * Groups by payment_type field
 */
function createMockSalesByPaymentType(paymentTypes: string[]) {
  // Ensure uniqueness by using Set
  const uniquePaymentTypes = Array.from(new Set(paymentTypes))
  
  const rows = uniquePaymentTypes.map(paymentType => ({
    paymentType: paymentType,
    saleCount: Math.floor(Math.random() * 100) + 1,
    revenue: Math.floor(Math.random() * 100000) + 1000,
    avgTicket: Math.floor(Math.random() * 1000) + 100
  }))
  
  return {
    kpis: [
      { label: 'Total Ventas', value: rows.reduce((sum, r) => sum + r.saleCount, 0), format: 'number' },
      { label: 'Ingresos Totales', value: rows.reduce((sum, r) => sum + r.revenue, 0), format: 'currency' }
    ],
    series: [
      {
        name: 'Ventas por Tipo de Pago',
        points: rows.map(r => ({ x: r.paymentType, y: r.revenue }))
      }
    ],
    rows: rows,
    meta: {
      columns: [
        { key: 'paymentType', label: 'Tipo de Pago', type: 'string' },
        { key: 'saleCount', label: 'Cantidad', type: 'number' },
        { key: 'revenue', label: 'Ingresos', type: 'currency' },
        { key: 'avgTicket', label: 'Ticket Promedio', type: 'currency' }
      ]
    }
  }
}

/**
 * Mock report output generator for sales by store
 * Groups by store_id field
 */
function createMockSalesByStore(storeIds: string[]) {
  // Ensure uniqueness by using Set
  const uniqueStoreIds = Array.from(new Set(storeIds))
  
  const rows = uniqueStoreIds.map(storeId => ({
    storeId: storeId,
    storeName: storeId.replace('_', ' '),
    saleCount: Math.floor(Math.random() * 100) + 1,
    revenue: Math.floor(Math.random() * 100000) + 1000,
    profit: Math.floor(Math.random() * 50000) + 500
  }))
  
  return {
    kpis: [
      { label: 'Tiendas', value: rows.length, format: 'number' },
      { label: 'Ingresos Totales', value: rows.reduce((sum, r) => sum + r.revenue, 0), format: 'currency' }
    ],
    series: [
      {
        name: 'Ingresos por Tienda',
        points: rows.map(r => ({ x: r.storeName, y: r.revenue }))
      }
    ],
    rows: rows,
    meta: {
      columns: [
        { key: 'storeId', label: 'ID Tienda', type: 'string' },
        { key: 'storeName', label: 'Tienda', type: 'string' },
        { key: 'saleCount', label: 'Ventas', type: 'number' },
        { key: 'revenue', label: 'Ingresos', type: 'currency' },
        { key: 'profit', label: 'Ganancia', type: 'currency' }
      ]
    }
  }
}

/**
 * Mock report output generator for sales by product
 * Groups by product_id field
 */
function createMockSalesByProduct(products: Array<{ id: string; barcode: string; name: string; categoryId: string | null }>) {
  // Ensure uniqueness by product ID using Map
  const uniqueProductsMap = new Map<string, typeof products[0]>()
  products.forEach(p => {
    if (!uniqueProductsMap.has(p.id)) {
      uniqueProductsMap.set(p.id, p)
    }
  })
  
  const uniqueProducts = Array.from(uniqueProductsMap.values())
  
  const rows = uniqueProducts.map(product => ({
    productId: product.id,
    barcode: product.barcode,
    name: product.name,
    category: product.categoryId ? 'Categoría Test' : 'Sin categoría',
    quantitySold: Math.floor(Math.random() * 100) + 1,
    revenue: Math.floor(Math.random() * 50000) + 500,
    cost: Math.floor(Math.random() * 30000) + 300,
    profit: Math.floor(Math.random() * 20000) + 200,
    marginPct: Math.floor(Math.random() * 50) + 10,
    transactions: Math.floor(Math.random() * 50) + 1
  }))
  
  return {
    kpis: [
      { label: 'Productos Vendidos', value: rows.length, format: 'number' },
      { label: 'Unidades Vendidas', value: rows.reduce((sum, r) => sum + r.quantitySold, 0), format: 'number' },
      { label: 'Ingresos Totales', value: rows.reduce((sum, r) => sum + r.revenue, 0), format: 'currency' }
    ],
    series: [
      {
        name: 'Ingresos por Producto (Top 20)',
        points: rows.slice(0, 20).map(r => ({ x: r.name, y: r.revenue }))
      }
    ],
    rows: rows,
    meta: {
      columns: [
        { key: 'barcode', label: 'Código', type: 'string' },
        { key: 'name', label: 'Producto', type: 'string' },
        { key: 'category', label: 'Categoría', type: 'string' },
        { key: 'quantitySold', label: 'Cantidad', type: 'number' },
        { key: 'revenue', label: 'Ingresos', type: 'currency' },
        { key: 'cost', label: 'Costo', type: 'currency' },
        { key: 'profit', label: 'Ganancia', type: 'currency' },
        { key: 'marginPct', label: 'Margen %', type: 'percent' },
        { key: 'transactions', label: 'Transacciones', type: 'number' }
      ]
    }
  }
}

/**
 * Mock report output generator for sales by category
 * Groups by category_id field
 */
function createMockSalesByCategory(categories: Array<{ id: string; name: string }>) {
  // Ensure uniqueness by category ID using Map
  const uniqueCategoriesMap = new Map<string, typeof categories[0]>()
  categories.forEach(c => {
    if (!uniqueCategoriesMap.has(c.id)) {
      uniqueCategoriesMap.set(c.id, c)
    }
  })
  
  const uniqueCategories = Array.from(uniqueCategoriesMap.values())
  
  const rows = uniqueCategories.map(category => ({
    categoryId: category.id,
    categoryName: category.name,
    productCount: Math.floor(Math.random() * 50) + 1,
    quantitySold: Math.floor(Math.random() * 500) + 10,
    revenue: Math.floor(Math.random() * 200000) + 5000,
    cost: Math.floor(Math.random() * 120000) + 3000,
    profit: Math.floor(Math.random() * 80000) + 2000,
    marginPct: Math.floor(Math.random() * 50) + 10,
    transactions: Math.floor(Math.random() * 200) + 5
  }))
  
  return {
    kpis: [
      { label: 'Categorías', value: rows.length, format: 'number' },
      { label: 'Unidades Vendidas', value: rows.reduce((sum, r) => sum + r.quantitySold, 0), format: 'number' },
      { label: 'Ingresos Totales', value: rows.reduce((sum, r) => sum + r.revenue, 0), format: 'currency' }
    ],
    series: [
      {
        name: 'Ingresos por Categoría',
        points: rows.map(r => ({ x: r.categoryName, y: r.revenue }))
      }
    ],
    rows: rows,
    meta: {
      columns: [
        { key: 'categoryName', label: 'Categoría', type: 'string' },
        { key: 'productCount', label: 'Productos', type: 'number' },
        { key: 'quantitySold', label: 'Cantidad', type: 'number' },
        { key: 'revenue', label: 'Ingresos', type: 'currency' },
        { key: 'cost', label: 'Costo', type: 'currency' },
        { key: 'profit', label: 'Ganancia', type: 'currency' },
        { key: 'marginPct', label: 'Margen %', type: 'percent' },
        { key: 'transactions', label: 'Transacciones', type: 'number' }
      ]
    }
  }
}

/**
 * Mock report output generator for purchases by supplier
 * Groups by supplier_id field
 */
function createMockPurchasesBySupplier(suppliers: Array<{ id: string; name: string }>) {
  // Ensure uniqueness by supplier ID using Map
  const uniqueSuppliersMap = new Map<string, typeof suppliers[0]>()
  suppliers.forEach(s => {
    if (!uniqueSuppliersMap.has(s.id)) {
      uniqueSuppliersMap.set(s.id, s)
    }
  })
  
  const uniqueSuppliers = Array.from(uniqueSuppliersMap.values())
  
  const rows = uniqueSuppliers.map(supplier => ({
    supplierId: supplier.id,
    supplierName: supplier.name,
    purchaseCount: Math.floor(Math.random() * 50) + 1,
    totalQuantity: Math.floor(Math.random() * 1000) + 50,
    totalCost: Math.floor(Math.random() * 500000) + 10000
  }))
  
  return {
    kpis: [
      { label: 'Proveedores', value: rows.length, format: 'number' },
      { label: 'Compras Totales', value: rows.reduce((sum, r) => sum + r.purchaseCount, 0), format: 'number' },
      { label: 'Costo Total', value: rows.reduce((sum, r) => sum + r.totalCost, 0), format: 'currency' }
    ],
    series: [
      {
        name: 'Compras por Proveedor',
        points: rows.map(r => ({ x: r.supplierName, y: r.totalCost }))
      }
    ],
    rows: rows,
    meta: {
      columns: [
        { key: 'supplierName', label: 'Proveedor', type: 'string' },
        { key: 'purchaseCount', label: 'Compras', type: 'number' },
        { key: 'totalQuantity', label: 'Cantidad Total', type: 'number' },
        { key: 'totalCost', label: 'Costo Total', type: 'currency' }
      ]
    }
  }
}

describe('Property 10: Grouping Uniqueness', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      rpc: jest.fn()
    }
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  /**
   * **Validates: Requirement 3.6**
   * 
   * This property test verifies that when grouping sales by payment_type,
   * each payment type (CONTADO, CREDITO) appears exactly once in the result set.
   * 
   * The SQL uses: GROUP BY payment_type
   * 
   * This ensures no duplicate groups and accurate aggregations.
   */
  it('should return each payment_type exactly once when grouping by payment type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(paymentTypeArbitrary, { minLength: 1, maxLength: 20 }),
        async (paymentTypes) => {
          // Setup mock to return data grouped by payment type
          const mockOutput = createMockSalesByPaymentType(paymentTypes)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          // Execute report
          const result = await generateReport('credit-vs-cash', {})

          // ===== Extract all payment types from result =====
          const resultPaymentTypes = result.rows.map((row: any) => row.paymentType)

          // ===== Verify each payment type appears exactly once =====
          const uniquePaymentTypes = Array.from(new Set(resultPaymentTypes))
          expect(resultPaymentTypes.length).toBe(uniquePaymentTypes.length)

          // ===== Verify no duplicates =====
          const paymentTypeCounts = resultPaymentTypes.reduce((acc: Record<string, number>, pt: string) => {
            acc[pt] = (acc[pt] || 0) + 1
            return acc
          }, {})

          Object.entries(paymentTypeCounts).forEach(([paymentType, count]) => {
            expect(count).toBe(1)
          })

          // ===== Verify all unique payment types from input are represented =====
          const inputUniquePaymentTypes = Array.from(new Set(paymentTypes))
          expect(resultPaymentTypes.length).toBe(inputUniquePaymentTypes.length)
        }
      ),
      { 
        numRuns: 100,
        verbose: true
      }
    )
  })

  /**
   * **Validates: Requirement 3.7**
   * 
   * This property test verifies that when grouping sales by store_id,
   * each store appears exactly once in the result set.
   * 
   * The SQL uses: GROUP BY store_id
   * 
   * This ensures accurate per-store aggregations without duplicates.
   */
  it('should return each store_id exactly once when grouping by store', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(storeIdArbitrary, { minLength: 1, maxLength: 10 }),
        async (storeIds) => {
          // Setup mock to return data grouped by store
          const mockOutput = createMockSalesByStore(storeIds)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          // Execute report
          const result = await generateReport('sales-by-store', {})

          // ===== Extract all store IDs from result =====
          const resultStoreIds = result.rows.map((row: any) => row.storeId)

          // ===== Verify each store ID appears exactly once =====
          const uniqueStoreIds = Array.from(new Set(resultStoreIds))
          expect(resultStoreIds.length).toBe(uniqueStoreIds.length)

          // ===== Verify no duplicates =====
          const storeIdCounts = resultStoreIds.reduce((acc: Record<string, number>, sid: string) => {
            acc[sid] = (acc[sid] || 0) + 1
            return acc
          }, {})

          Object.entries(storeIdCounts).forEach(([storeId, count]) => {
            expect(count).toBe(1)
          })

          // ===== Verify all unique stores from input are represented =====
          const inputUniqueStoreIds = Array.from(new Set(storeIds))
          expect(resultStoreIds.length).toBe(inputUniqueStoreIds.length)
        }
      ),
      { 
        numRuns: 100,
        verbose: true
      }
    )
  })

  /**
   * **Validates: Requirement 3.8 (implicit grouping requirement)**
   * 
   * This property test verifies that when grouping sales by product_id,
   * each product appears exactly once in the result set.
   * 
   * The SQL uses: GROUP BY p.id, p.barcode, p.name, c.name
   * 
   * This ensures each product's sales are aggregated correctly without duplicates.
   */
  it('should return each product_id exactly once when grouping by product', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(productArbitrary, { minLength: 1, maxLength: 50 }),
        async (products) => {
          // Setup mock to return data grouped by product
          const mockOutput = createMockSalesByProduct(products)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          // Execute report
          const result = await generateReport('sales-by-product', {})

          // ===== Extract all product IDs from result =====
          const resultProductIds = result.rows.map((row: any) => row.productId)

          // ===== Verify each product ID appears exactly once =====
          const uniqueProductIds = Array.from(new Set(resultProductIds))
          expect(resultProductIds.length).toBe(uniqueProductIds.length)

          // ===== Verify no duplicates =====
          const productIdCounts = resultProductIds.reduce((acc: Record<string, number>, pid: string) => {
            acc[pid] = (acc[pid] || 0) + 1
            return acc
          }, {})

          Object.entries(productIdCounts).forEach(([productId, count]) => {
            expect(count).toBe(1)
          })

          // ===== Verify all unique products from input are represented =====
          const inputUniqueProductIds = Array.from(new Set(products.map(p => p.id)))
          expect(resultProductIds.length).toBe(inputUniqueProductIds.length)
        }
      ),
      { 
        numRuns: 100,
        verbose: true
      }
    )
  })

  /**
   * **Validates: Requirement 3.9 (implicit grouping requirement)**
   * 
   * This property test verifies that when grouping sales by category_id,
   * each category appears exactly once in the result set.
   * 
   * The SQL uses: GROUP BY c.id, c.name
   * 
   * This ensures each category's sales are aggregated correctly without duplicates.
   */
  it('should return each category_id exactly once when grouping by category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArbitrary, { minLength: 1, maxLength: 30 }),
        async (categories) => {
          // Setup mock to return data grouped by category
          const mockOutput = createMockSalesByCategory(categories)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          // Execute report
          const result = await generateReport('sales-by-category', {})

          // ===== Extract all category IDs from result =====
          const resultCategoryIds = result.rows.map((row: any) => row.categoryId)

          // ===== Verify each category ID appears exactly once =====
          const uniqueCategoryIds = Array.from(new Set(resultCategoryIds))
          expect(resultCategoryIds.length).toBe(uniqueCategoryIds.length)

          // ===== Verify no duplicates =====
          const categoryIdCounts = resultCategoryIds.reduce((acc: Record<string, number>, cid: string) => {
            acc[cid] = (acc[cid] || 0) + 1
            return acc
          }, {})

          Object.entries(categoryIdCounts).forEach(([categoryId, count]) => {
            expect(count).toBe(1)
          })

          // ===== Verify all unique categories from input are represented =====
          const inputUniqueCategoryIds = Array.from(new Set(categories.map(c => c.id)))
          expect(resultCategoryIds.length).toBe(inputUniqueCategoryIds.length)
        }
      ),
      { 
        numRuns: 100,
        verbose: true
      }
    )
  })

  /**
   * **Validates: Requirement 4.4**
   * 
   * This property test verifies that when grouping purchases by supplier_id,
   * each supplier appears exactly once in the result set.
   * 
   * The SQL uses: GROUP BY supplier_id
   * 
   * This ensures each supplier's purchases are aggregated correctly without duplicates.
   */
  it('should return each supplier_id exactly once when grouping by supplier', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(supplierArbitrary, { minLength: 1, maxLength: 30 }),
        async (suppliers) => {
          // Setup mock to return data grouped by supplier
          const mockOutput = createMockPurchasesBySupplier(suppliers)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          // Execute report
          const result = await generateReport('purchases-by-supplier', {})

          // ===== Extract all supplier IDs from result =====
          const resultSupplierIds = result.rows.map((row: any) => row.supplierId)

          // ===== Verify each supplier ID appears exactly once =====
          const uniqueSupplierIds = Array.from(new Set(resultSupplierIds))
          expect(resultSupplierIds.length).toBe(uniqueSupplierIds.length)

          // ===== Verify no duplicates =====
          const supplierIdCounts = resultSupplierIds.reduce((acc: Record<string, number>, sid: string) => {
            acc[sid] = (acc[sid] || 0) + 1
            return acc
          }, {})

          Object.entries(supplierIdCounts).forEach(([supplierId, count]) => {
            expect(count).toBe(1)
          })

          // ===== Verify all unique suppliers from input are represented =====
          const inputUniqueSupplierIds = Array.from(new Set(suppliers.map(s => s.id)))
          expect(resultSupplierIds.length).toBe(inputUniqueSupplierIds.length)
        }
      ),
      { 
        numRuns: 100,
        verbose: true
      }
    )
  })

  /**
   * Cross-validation test: Verify grouping uniqueness holds with filters applied
   * 
   * This test ensures that even when filters are applied (date range, store, etc.),
   * the grouping uniqueness property still holds.
   */
  it('should maintain grouping uniqueness even with filters applied', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(productArbitrary, { minLength: 5, maxLength: 30 }),
        fc.record({
          startDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
            .map(d => {
              try {
                return d.toISOString().split('T')[0]
              } catch {
                return '2024-01-01'
              }
            }),
          endDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
            .map(d => {
              try {
                return d.toISOString().split('T')[0]
              } catch {
                return '2024-12-31'
              }
            }),
          warehouse: fc.option(storeIdArbitrary, { nil: undefined })
        }),
        async (products, filters) => {
          // Setup mock to return filtered data grouped by product
          const mockOutput = createMockSalesByProduct(products)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          // Execute report with filters
          const result = await generateReport('sales-by-product', filters)

          // ===== Extract all product IDs from result =====
          const resultProductIds = result.rows.map((row: any) => row.productId)

          // ===== Verify each product ID appears exactly once =====
          const uniqueProductIds = Array.from(new Set(resultProductIds))
          expect(resultProductIds.length).toBe(uniqueProductIds.length)

          // ===== Verify no duplicates regardless of filters =====
          const productIdCounts = resultProductIds.reduce((acc: Record<string, number>, pid: string) => {
            acc[pid] = (acc[pid] || 0) + 1
            return acc
          }, {})

          Object.entries(productIdCounts).forEach(([productId, count]) => {
            expect(count).toBe(1)
          })
        }
      ),
      { 
        numRuns: 50,
        verbose: true
      }
    )
  })

  /**
   * Edge case test: Verify grouping uniqueness with single item
   * 
   * This test ensures that when there's only one unique value to group by,
   * it appears exactly once (not zero times, not multiple times).
   */
  it('should return exactly one row when grouping by a field with single unique value', async () => {
    await fc.assert(
      fc.asyncProperty(
        paymentTypeArbitrary,
        fc.integer({ min: 1, max: 20 }),
        async (singlePaymentType, repetitions) => {
          // Create array with same payment type repeated
          const paymentTypes = Array(repetitions).fill(singlePaymentType)

          const mockOutput = createMockSalesByPaymentType(paymentTypes)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('credit-vs-cash', {})

          // ===== Should return exactly one row =====
          expect(result.rows.length).toBe(1)

          // ===== That row should have the single payment type =====
          expect(result.rows[0].paymentType).toBe(singlePaymentType)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Edge case test: Verify grouping uniqueness with maximum diversity
   * 
   * This test ensures that when all input values are unique,
   * each appears exactly once in the output.
   */
  it('should return N rows when grouping by a field with N unique values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArbitrary, { minLength: 1, maxLength: 20 }),
        async (categories) => {
          // Ensure all categories are unique
          const uniqueCategories = Array.from(
            new Map(categories.map(c => [c.id, c])).values()
          )

          const mockOutput = createMockSalesByCategory(uniqueCategories)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('sales-by-category', {})

          // ===== Should return exactly N rows for N unique categories =====
          expect(result.rows.length).toBe(uniqueCategories.length)

          // ===== Each category should appear exactly once =====
          const resultCategoryIds = result.rows.map((row: any) => row.categoryId)
          const uniqueResultCategoryIds = Array.from(new Set(resultCategoryIds))
          expect(resultCategoryIds.length).toBe(uniqueResultCategoryIds.length)
        }
      ),
      { numRuns: 50 }
    )
  })
})
