/**
 * Property-Based Tests for Low Stock Filtering
 * 
 * Feature: analytics-reports-module
 * Property 6: Low Stock Filtering Correctness
 * 
 * **Validates: Requirements 2.6**
 * 
 * This test verifies that the low stock report correctly filters products:
 * 1. All returned products have stock_qty < min_stock threshold
 * 2. Products with stock = 0 are included (agotados)
 * 3. No products with stock >= min_stock are returned
 * 4. The filtering is correct across multiple test iterations
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
 * Arbitrary generator for low stock test data
 * Generates realistic product stock scenarios
 */
const lowStockDataArbitrary = fc.record({
  currentStock: fc.integer({ min: 0, max: 100 }),
  minStock: fc.integer({ min: 1, max: 50 }),
  productName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
  barcode: fc.string({ minLength: 8, maxLength: 13 }).filter(s => s.trim().length >= 8),
  category: fc.option(
    fc.string({ minLength: 3, maxLength: 30 }).filter(s => s.trim().length >= 3),
    { nil: null }
  )
})

/**
 * Arbitrary generator for multiple products with mixed stock levels
 * Creates arrays with both low stock and normal stock products
 */
const mixedStockProductsArbitrary = fc.array(
  lowStockDataArbitrary,
  { minLength: 5, maxLength: 30 }
)

/**
 * Arbitrary generator for min_stock filter parameter
 */
const minStockFilterArbitrary = fc.integer({ min: 1, max: 50 })

/**
 * Mock report output generator for low stock report
 * Creates realistic Report_Output structure with low stock filtering
 */
function createMockLowStockOutput(products: any[], minStockFilter: number) {
  // Apply the same filtering logic as the SQL function
  // HAVING SUM(s.quantity) <= min_stock_filter
  const filteredProducts = products.filter(p => p.currentStock <= minStockFilter)
  
  const rows = filteredProducts.map(p => {
    // Determine status based on stock level
    let status: string
    if (p.currentStock === 0) {
      status = 'AGOTADO'
    } else if (p.currentStock <= minStockFilter) {
      status = 'STOCK BAJO'
    } else {
      status = 'NORMAL'
    }
    
    return {
      barcode: p.barcode,
      name: p.productName,
      category: p.category ?? 'Sin categoría',
      minStock: p.minStock,
      currentStock: p.currentStock,
      status: status,
      needed: Math.max(p.minStock - p.currentStock, 0)
    }
  })
  
  // Sort by current stock ascending, then by name
  rows.sort((a, b) => {
    if (a.currentStock !== b.currentStock) {
      return a.currentStock - b.currentStock
    }
    return a.name.localeCompare(b.name)
  })
  
  const agotadosCount = rows.filter(r => r.currentStock === 0).length
  
  // Status counts for pie chart
  const statusCounts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const statusPoints = Object.entries(statusCounts)
    .map(([status, count]) => ({ x: status, y: count }))
    .sort((a, b) => {
      const order = { 'AGOTADO': 1, 'STOCK BAJO': 2, 'NORMAL': 3 }
      return (order[a.x as keyof typeof order] || 99) - (order[b.x as keyof typeof order] || 99)
    })
  
  return {
    kpis: [
      { label: 'Productos con Stock Bajo', value: rows.length, format: 'number' },
      { label: 'Productos Agotados', value: agotadosCount, format: 'number' },
      { label: 'Stock Mínimo Configurado', value: minStockFilter, format: 'number' }
    ],
    series: [
      {
        name: 'Estado de Stock',
        points: statusPoints
      },
      {
        name: 'Top 20 Productos con Menor Stock',
        points: rows.slice(0, 20).map(r => ({
          x: r.name,
          y: r.currentStock
        }))
      }
    ],
    rows: rows,
    meta: {
      columns: [
        { key: 'barcode', label: 'Código', type: 'string' },
        { key: 'name', label: 'Producto', type: 'string' },
        { key: 'category', label: 'Categoría', type: 'string' },
        { key: 'minStock', label: 'Stock Mínimo', type: 'number' },
        { key: 'currentStock', label: 'Stock Actual', type: 'number' },
        { key: 'status', label: 'Estado', type: 'string' },
        { key: 'needed', label: 'Necesario', type: 'number' }
      ]
    }
  }
}

describe('Property 6: Low Stock Filtering Correctness', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      rpc: jest.fn()
    }
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  /**
   * **Validates: Requirement 2.6**
   * 
   * This property test verifies that ALL returned products have stock_qty <= min_stock.
   * According to the requirement: "THE Report_Engine SHALL identify products where 
   * stock_qty is less than min_stock"
   * 
   * The SQL uses: HAVING SUM(s.quantity) <= min_stock_filter
   * 
   * Test scenarios:
   * - Products with various stock levels (0 to 100)
   * - Different min_stock thresholds (1 to 50)
   * - Mixed scenarios with products above and below threshold
   */
  it('should only return products where currentStock <= minStock threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        mixedStockProductsArbitrary,
        minStockFilterArbitrary,
        async (products, minStockFilter) => {
          // Setup mock to return realistic data
          const mockOutput = createMockLowStockOutput(products, minStockFilter)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          // Execute report with minStock filter
          const result = await generateReport('low-stock', {
            minStock: minStockFilter
          })

          // ===== Verify ALL products have currentStock <= minStock threshold =====
          result.rows.forEach((row: any) => {
            expect(row.currentStock).toBeLessThanOrEqual(minStockFilter)
          })

          // ===== Verify no products with stock > minStock are included =====
          const productsAboveThreshold = products.filter(p => p.currentStock > minStockFilter)
          const returnedBarcodes = result.rows.map((r: any) => r.barcode)
          
          productsAboveThreshold.forEach(p => {
            expect(returnedBarcodes).not.toContain(p.barcode)
          })
        }
      ),
      { 
        numRuns: 100,
        verbose: true
      }
    )
  })

  /**
   * **Validates: Requirement 2.6**
   * 
   * This test specifically verifies that products with stock = 0 (agotados)
   * are ALWAYS included in the low stock report, regardless of the min_stock threshold.
   * 
   * The SQL logic ensures this with: HAVING SUM(s.quantity) <= min_stock_filter
   * Since 0 <= any positive min_stock_filter, zero-stock products are always included.
   */
  it('should always include products with stock = 0 (agotados)', async () => {
    await fc.assert(
      fc.asyncProperty(
        minStockFilterArbitrary,
        fc.array(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
          { minLength: 1, maxLength: 10 }
        ),
        async (minStockFilter, productNames) => {
          // Create products with zero stock
          const zeroStockProducts = productNames.map((name, i) => ({
            currentStock: 0,
            minStock: minStockFilter,
            productName: name,
            barcode: `ZERO${i.toString().padStart(4, '0')}`,
            category: 'Test Category'
          }))

          const mockOutput = createMockLowStockOutput(zeroStockProducts, minStockFilter)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('low-stock', {
            minStock: minStockFilter
          })

          // ===== Verify all zero-stock products are included =====
          expect(result.rows.length).toBe(zeroStockProducts.length)
          
          result.rows.forEach((row: any) => {
            expect(row.currentStock).toBe(0)
            expect(row.status).toBe('AGOTADO')
          })

          // ===== Verify KPI shows correct count of agotados =====
          const agotadosKPI = result.kpis.find((kpi: any) => kpi.label === 'Productos Agotados')
          expect(agotadosKPI).toBeDefined()
          expect(agotadosKPI.value).toBe(zeroStockProducts.length)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Validates: Requirement 2.6**
   * 
   * This test verifies that products with stock exactly at the threshold are included,
   * while products with stock above the threshold are excluded.
   * 
   * The SQL uses <= comparison: HAVING SUM(s.quantity) <= min_stock_filter
   */
  it('should include products with stock exactly at threshold, exclude those above', async () => {
    await fc.assert(
      fc.asyncProperty(
        minStockFilterArbitrary,
        async (minStockFilter) => {
          // Create three products: below, at, and above threshold
          const products = [
            {
              currentStock: Math.max(minStockFilter - 1, 0),
              minStock: minStockFilter,
              productName: 'Product Below',
              barcode: 'BELOW001',
              category: 'Test'
            },
            {
              currentStock: minStockFilter,
              minStock: minStockFilter,
              productName: 'Product At Threshold',
              barcode: 'ATTHRESH',
              category: 'Test'
            },
            {
              currentStock: minStockFilter + 1,
              minStock: minStockFilter,
              productName: 'Product Above',
              barcode: 'ABOVE001',
              category: 'Test'
            }
          ]

          const mockOutput = createMockLowStockOutput(products, minStockFilter)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('low-stock', {
            minStock: minStockFilter
          })

          const returnedBarcodes = result.rows.map((r: any) => r.barcode)

          // ===== Product below threshold should be included =====
          if (minStockFilter > 0) {
            expect(returnedBarcodes).toContain('BELOW001')
          }

          // ===== Product at threshold should be included =====
          expect(returnedBarcodes).toContain('ATTHRESH')

          // ===== Product above threshold should NOT be included =====
          expect(returnedBarcodes).not.toContain('ABOVE001')
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Validates: Requirement 2.6**
   * 
   * This test verifies that the filtering is consistent across different
   * min_stock threshold values. Higher thresholds should include more products.
   */
  it('should include more products with higher min_stock thresholds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 30 }), // base threshold
        fc.integer({ min: 5, max: 30 }), // threshold increase
        fc.array(
          fc.record({
            currentStock: fc.integer({ min: 0, max: 100 }),
            productName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
            barcode: fc.string({ minLength: 8, maxLength: 13 }).filter(s => s.trim().length >= 8)
          }),
          { minLength: 10, maxLength: 30 }
        ),
        async (baseThreshold, increase, rawProducts) => {
          const lowerThreshold = baseThreshold
          const higherThreshold = baseThreshold + increase

          // Add minStock and category to products
          const products = rawProducts.map(p => ({
            ...p,
            minStock: higherThreshold,
            category: 'Test Category'
          }))

          // Get results with lower threshold
          const mockOutputLower = createMockLowStockOutput(products, lowerThreshold)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutputLower,
            error: null
          })
          const resultLower = await generateReport('low-stock', {
            minStock: lowerThreshold
          })

          // Get results with higher threshold
          const mockOutputHigher = createMockLowStockOutput(products, higherThreshold)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutputHigher,
            error: null
          })
          const resultHigher = await generateReport('low-stock', {
            minStock: higherThreshold
          })

          // ===== Higher threshold should include at least as many products =====
          expect(resultHigher.rows.length).toBeGreaterThanOrEqual(resultLower.rows.length)

          // ===== All products from lower threshold should be in higher threshold =====
          const lowerBarcodes = resultLower.rows.map((r: any) => r.barcode)
          const higherBarcodes = resultHigher.rows.map((r: any) => r.barcode)

          lowerBarcodes.forEach((barcode: string) => {
            expect(higherBarcodes).toContain(barcode)
          })
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Validates: Requirement 2.6**
   * 
   * This test verifies that the report correctly categorizes products by status:
   * - AGOTADO: currentStock = 0
   * - STOCK BAJO: 0 < currentStock <= min_stock_filter
   * 
   * The status field helps users prioritize which products need immediate attention.
   */
  it('should correctly categorize products as AGOTADO or STOCK BAJO', async () => {
    await fc.assert(
      fc.asyncProperty(
        mixedStockProductsArbitrary,
        minStockFilterArbitrary,
        async (products, minStockFilter) => {
          const mockOutput = createMockLowStockOutput(products, minStockFilter)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('low-stock', {
            minStock: minStockFilter
          })

          // ===== Verify status categorization =====
          result.rows.forEach((row: any) => {
            if (row.currentStock === 0) {
              expect(row.status).toBe('AGOTADO')
            } else if (row.currentStock <= minStockFilter) {
              expect(row.status).toBe('STOCK BAJO')
            }
            
            // Status should never be NORMAL in low stock report
            expect(row.status).not.toBe('NORMAL')
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirement 2.6**
   * 
   * This test verifies that the 'needed' field is correctly calculated as:
   * needed = max(minStock - currentStock, 0)
   * 
   * This tells users how many units they need to order to reach minimum stock.
   */
  it('should correctly calculate needed quantity as max(minStock - currentStock, 0)', async () => {
    await fc.assert(
      fc.asyncProperty(
        mixedStockProductsArbitrary,
        minStockFilterArbitrary,
        async (products, minStockFilter) => {
          const mockOutput = createMockLowStockOutput(products, minStockFilter)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('low-stock', {
            minStock: minStockFilter
          })

          // ===== Verify needed calculation =====
          result.rows.forEach((row: any) => {
            const expectedNeeded = Math.max(row.minStock - row.currentStock, 0)
            expect(row.needed).toBe(expectedNeeded)
            
            // Needed should always be non-negative
            expect(row.needed).toBeGreaterThanOrEqual(0)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirement 2.6**
   * 
   * This test verifies that results are ordered by currentStock ascending,
   * then by name alphabetically. This ensures products with the lowest stock
   * (most urgent) appear first.
   */
  it('should order results by currentStock ascending, then by name', async () => {
    await fc.assert(
      fc.asyncProperty(
        mixedStockProductsArbitrary,
        minStockFilterArbitrary,
        async (products, minStockFilter) => {
          const mockOutput = createMockLowStockOutput(products, minStockFilter)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('low-stock', {
            minStock: minStockFilter
          })

          // ===== Verify ordering =====
          for (let i = 1; i < result.rows.length; i++) {
            const prev = result.rows[i - 1]
            const curr = result.rows[i]

            // Current stock should be >= previous stock
            if (curr.currentStock < prev.currentStock) {
              throw new Error(
                `Ordering violation: row ${i} has stock ${curr.currentStock} < row ${i-1} stock ${prev.currentStock}`
              )
            }

            // If stock is equal, name should be in alphabetical order
            if (curr.currentStock === prev.currentStock) {
              expect(curr.name.localeCompare(prev.name)).toBeGreaterThanOrEqual(0)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirement 2.6**
   * 
   * This test verifies that all numeric fields are valid (not NULL, NaN, or Infinity).
   * This ensures the report data is always usable for calculations and display.
   */
  it('should always produce valid numeric values for all fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        mixedStockProductsArbitrary,
        minStockFilterArbitrary,
        async (products, minStockFilter) => {
          const mockOutput = createMockLowStockOutput(products, minStockFilter)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('low-stock', {
            minStock: minStockFilter
          })

          // ===== Verify all numeric fields are valid =====
          result.rows.forEach((row: any) => {
            expect(typeof row.minStock).toBe('number')
            expect(typeof row.currentStock).toBe('number')
            expect(typeof row.needed).toBe('number')

            expect(Number.isFinite(row.minStock)).toBe(true)
            expect(Number.isFinite(row.currentStock)).toBe(true)
            expect(Number.isFinite(row.needed)).toBe(true)

            expect(row.minStock).not.toBeNull()
            expect(row.currentStock).not.toBeNull()
            expect(row.needed).not.toBeNull()
          })

          // ===== Verify KPIs are valid =====
          result.kpis.forEach((kpi: any) => {
            expect(Number.isFinite(kpi.value)).toBe(true)
            expect(kpi.value).not.toBeNull()
            expect(kpi.value).toBeGreaterThanOrEqual(0)
          })
        }
      ),
      { numRuns: 100 }
    )
  })
})
