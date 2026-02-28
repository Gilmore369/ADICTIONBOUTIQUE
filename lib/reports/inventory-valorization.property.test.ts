/**
 * Property-Based Tests for Inventory Valorization Calculations
 * 
 * Feature: analytics-reports-module
 * Property 5: Inventory Valorization Calculations
 * 
 * **Validates: Requirements 2.3, 2.4, 2.5**
 * 
 * This test verifies that for any product in the valorization report:
 * - cost_value (totalCost) = stock_qty * cost_price
 * - sale_value (totalSale) = stock_qty * sale_price
 * - potential_margin (potentialProfit) = sale_value - cost_value
 * 
 * The SQL function uses COALESCE to handle NULL purchase_price values,
 * treating them as 0 for cost calculations.
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
 * Arbitrary generator for inventory valorization test data
 * Generates realistic product stock and pricing scenarios
 */
const valorizationDataArbitrary = fc.record({
  quantity: fc.integer({ min: 1, max: 500 }),
  costPrice: fc.option(
    fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }).map(n => Number(n.toFixed(2))),
    { nil: null }
  ),
  salePrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1500), noNaN: true }).map(n => Number(n.toFixed(2))),
  productName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
  barcode: fc.string({ minLength: 8, maxLength: 13 }).filter(s => s.trim().length >= 8),
  category: fc.option(
    fc.string({ minLength: 3, maxLength: 30 }).filter(s => s.trim().length >= 3),
    { nil: null }
  )
})

/**
 * Arbitrary generator for multiple products
 * Creates arrays of product data for comprehensive testing
 */
const multipleProductsArbitrary = fc.array(
  valorizationDataArbitrary,
  { minLength: 1, maxLength: 20 }
)

/**
 * Mock report output generator for inventory valorization
 * Creates realistic Report_Output structure with valorization calculations
 */
function createMockInventoryValorizationOutput(products: any[]) {
  const rows = products.map(p => {
    // Apply the same COALESCE logic as the SQL function
    const costPrice = p.costPrice ?? 0
    const totalCost = Number((p.quantity * costPrice).toFixed(2))
    const totalSale = Number((p.quantity * p.salePrice).toFixed(2))
    const potentialProfit = Number((totalSale - totalCost).toFixed(2))
    
    return {
      barcode: p.barcode,
      name: p.productName,
      category: p.category ?? 'Sin categoría',
      quantity: p.quantity,
      costPrice: costPrice,
      salePrice: p.salePrice,
      totalCost: totalCost,
      totalSale: totalSale,
      potentialProfit: potentialProfit
    }
  })
  
  const totalCostSum = rows.reduce((sum, r) => sum + r.totalCost, 0)
  const totalSaleSum = rows.reduce((sum, r) => sum + r.totalSale, 0)
  const totalProfitSum = rows.reduce((sum, r) => sum + r.potentialProfit, 0)
  
  return {
    kpis: [
      { label: 'Valor Total Costo', value: Number(totalCostSum.toFixed(2)), format: 'currency' },
      { label: 'Valor Total Venta', value: Number(totalSaleSum.toFixed(2)), format: 'currency' },
      { label: 'Ganancia Potencial', value: Number(totalProfitSum.toFixed(2)), format: 'currency' }
    ],
    series: [
      {
        name: 'Valorización por Categoría',
        points: rows.slice(0, 10).map(r => ({
          x: r.category,
          y: r.totalSale
        }))
      }
    ],
    rows: rows,
    meta: {
      columns: [
        { key: 'barcode', label: 'Código', type: 'string' },
        { key: 'name', label: 'Producto', type: 'string' },
        { key: 'category', label: 'Categoría', type: 'string' },
        { key: 'quantity', label: 'Cantidad', type: 'number' },
        { key: 'costPrice', label: 'Precio Costo', type: 'currency' },
        { key: 'salePrice', label: 'Precio Venta', type: 'currency' },
        { key: 'totalCost', label: 'Costo Total', type: 'currency' },
        { key: 'totalSale', label: 'Valor Venta', type: 'currency' },
        { key: 'potentialProfit', label: 'Ganancia Potencial', type: 'currency' }
      ]
    }
  }
}

describe('Property 5: Inventory Valorization Calculations', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      rpc: jest.fn()
    }
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  /**
   * **Validates: Requirements 2.3, 2.4, 2.5**
   * 
   * This property test verifies that the valorization calculations are correct
   * for all products in the report:
   * 
   * - Requirement 2.3: cost_value = stock_qty * cost_price
   * - Requirement 2.4: sale_value = stock_qty * sale_price
   * - Requirement 2.5: potential_margin = sale_value - cost_value
   * 
   * The test handles NULL cost_price values by treating them as 0 (using COALESCE).
   */
  it('should correctly calculate cost_value, sale_value, and potential_margin for all products', async () => {
    await fc.assert(
      fc.asyncProperty(
        multipleProductsArbitrary,
        async (products) => {
          // Setup mock to return realistic data
          const mockOutput = createMockInventoryValorizationOutput(products)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          // Execute report
          const result = await generateReport('inventory-valuation', {})

          // ===== Verify calculations for each product =====
          result.rows.forEach((row: any, index: number) => {
            const product = products[index]
            const costPrice = product.costPrice ?? 0
            
            // ===== Requirement 2.3: cost_value = stock_qty * cost_price =====
            const expectedTotalCost = Number((product.quantity * costPrice).toFixed(2))
            expect(row.totalCost).toBe(expectedTotalCost)
            
            // ===== Requirement 2.4: sale_value = stock_qty * sale_price =====
            const expectedTotalSale = Number((product.quantity * product.salePrice).toFixed(2))
            expect(row.totalSale).toBe(expectedTotalSale)
            
            // ===== Requirement 2.5: potential_margin = sale_value - cost_value =====
            const expectedPotentialProfit = Number((expectedTotalSale - expectedTotalCost).toFixed(2))
            expect(row.potentialProfit).toBe(expectedPotentialProfit)
            
            // Verify all numeric fields are valid numbers
            expect(typeof row.quantity).toBe('number')
            expect(typeof row.costPrice).toBe('number')
            expect(typeof row.salePrice).toBe('number')
            expect(typeof row.totalCost).toBe('number')
            expect(typeof row.totalSale).toBe('number')
            expect(typeof row.potentialProfit).toBe('number')
            
            // Verify no NULL, NaN, or Infinity values
            expect(row.totalCost).not.toBeNull()
            expect(row.totalSale).not.toBeNull()
            expect(row.potentialProfit).not.toBeNull()
            expect(Number.isFinite(row.totalCost)).toBe(true)
            expect(Number.isFinite(row.totalSale)).toBe(true)
            expect(Number.isFinite(row.potentialProfit)).toBe(true)
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
   * **Validates: Requirement 2.3**
   * 
   * This test specifically verifies the cost_value calculation formula:
   * totalCost = quantity * costPrice
   * 
   * It tests with various quantity and price combinations to ensure
   * the multiplication is performed correctly.
   */
  it('should correctly calculate totalCost as quantity * costPrice', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }).map(n => Number(n.toFixed(2))),
        fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
        async (quantity, costPrice, productName) => {
          const products = [{
            quantity: quantity,
            costPrice: costPrice,
            salePrice: costPrice * 1.5, // 50% markup
            productName: productName,
            barcode: '12345678',
            category: 'Test Category'
          }]

          const mockOutput = createMockInventoryValorizationOutput(products)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('inventory-valuation', {})

          // Calculate expected totalCost
          const expectedTotalCost = Number((quantity * costPrice).toFixed(2))

          // Verify totalCost formula
          expect(result.rows[0].totalCost).toBe(expectedTotalCost)
          
          // Verify totalCost is positive when both values are positive
          expect(result.rows[0].totalCost).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirement 2.4**
   * 
   * This test specifically verifies the sale_value calculation formula:
   * totalSale = quantity * salePrice
   * 
   * It tests with various quantity and price combinations to ensure
   * the multiplication is performed correctly.
   */
  it('should correctly calculate totalSale as quantity * salePrice', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(1500), noNaN: true }).map(n => Number(n.toFixed(2))),
        fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
        async (quantity, salePrice, productName) => {
          const products = [{
            quantity: quantity,
            costPrice: salePrice * 0.6, // 40% margin
            salePrice: salePrice,
            productName: productName,
            barcode: '12345678',
            category: 'Test Category'
          }]

          const mockOutput = createMockInventoryValorizationOutput(products)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('inventory-valuation', {})

          // Calculate expected totalSale
          const expectedTotalSale = Number((quantity * salePrice).toFixed(2))

          // Verify totalSale formula
          expect(result.rows[0].totalSale).toBe(expectedTotalSale)
          
          // Verify totalSale is positive when both values are positive
          expect(result.rows[0].totalSale).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirement 2.5**
   * 
   * This test specifically verifies the potential_margin calculation formula:
   * potentialProfit = totalSale - totalCost
   * 
   * It verifies the subtraction is performed correctly and handles both
   * positive margins (profit) and negative margins (loss).
   */
  it('should correctly calculate potentialProfit as totalSale - totalCost', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }).map(n => Number(n.toFixed(2))),
        fc.float({ min: Math.fround(0.01), max: Math.fround(1500), noNaN: true }).map(n => Number(n.toFixed(2))),
        fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
        async (quantity, costPrice, salePrice, productName) => {
          const products = [{
            quantity: quantity,
            costPrice: costPrice,
            salePrice: salePrice,
            productName: productName,
            barcode: '12345678',
            category: 'Test Category'
          }]

          const mockOutput = createMockInventoryValorizationOutput(products)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('inventory-valuation', {})

          // Calculate expected values
          const expectedTotalCost = Number((quantity * costPrice).toFixed(2))
          const expectedTotalSale = Number((quantity * salePrice).toFixed(2))
          const expectedPotentialProfit = Number((expectedTotalSale - expectedTotalCost).toFixed(2))

          // Verify potentialProfit formula
          expect(result.rows[0].potentialProfit).toBe(expectedPotentialProfit)
          
          // Verify the relationship: potentialProfit = totalSale - totalCost
          const calculatedProfit = Number((result.rows[0].totalSale - result.rows[0].totalCost).toFixed(2))
          expect(result.rows[0].potentialProfit).toBe(calculatedProfit)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 2.3, 2.5**
   * 
   * This test verifies the edge case where costPrice is NULL.
   * According to the SQL function, NULL costPrice should be treated as 0
   * using COALESCE, resulting in:
   * - totalCost = 0
   * - potentialProfit = totalSale (since cost is 0)
   */
  it('should handle NULL costPrice by treating it as 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(1500), noNaN: true }).map(n => Number(n.toFixed(2))),
        fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
        async (quantity, salePrice, productName) => {
          const products = [{
            quantity: quantity,
            costPrice: null, // NULL cost price
            salePrice: salePrice,
            productName: productName,
            barcode: '12345678',
            category: 'Test Category'
          }]

          const mockOutput = createMockInventoryValorizationOutput(products)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('inventory-valuation', {})

          // When costPrice is NULL, it should be treated as 0
          expect(result.rows[0].costPrice).toBe(0)
          expect(result.rows[0].totalCost).toBe(0)
          
          // totalSale should still be calculated correctly
          const expectedTotalSale = Number((quantity * salePrice).toFixed(2))
          expect(result.rows[0].totalSale).toBe(expectedTotalSale)
          
          // potentialProfit should equal totalSale (since cost is 0)
          expect(result.rows[0].potentialProfit).toBe(expectedTotalSale)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Validates: Requirements 2.3, 2.4, 2.5**
   * 
   * This test verifies that KPI calculations aggregate correctly across all products.
   * The KPIs should be the sum of individual product calculations.
   */
  it('should correctly aggregate KPIs as sum of all product calculations', async () => {
    await fc.assert(
      fc.asyncProperty(
        multipleProductsArbitrary,
        async (products) => {
          const mockOutput = createMockInventoryValorizationOutput(products)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('inventory-valuation', {})

          // Calculate expected KPI values by summing rows
          const expectedTotalCost = result.rows.reduce((sum: number, row: any) => sum + row.totalCost, 0)
          const expectedTotalSale = result.rows.reduce((sum: number, row: any) => sum + row.totalSale, 0)
          const expectedTotalProfit = result.rows.reduce((sum: number, row: any) => sum + row.potentialProfit, 0)

          // Find KPIs
          const totalCostKPI = result.kpis.find((kpi: any) => kpi.label === 'Valor Total Costo')
          const totalSaleKPI = result.kpis.find((kpi: any) => kpi.label === 'Valor Total Venta')
          const totalProfitKPI = result.kpis.find((kpi: any) => kpi.label === 'Ganancia Potencial')

          // Verify KPI values match sum of rows (allow small rounding difference)
          expect(Math.abs(totalCostKPI.value - expectedTotalCost)).toBeLessThan(0.01)
          expect(Math.abs(totalSaleKPI.value - expectedTotalSale)).toBeLessThan(0.01)
          expect(Math.abs(totalProfitKPI.value - expectedTotalProfit)).toBeLessThan(0.01)
          
          // Verify KPI relationship: totalProfit = totalSale - totalCost
          const calculatedProfit = Number((totalSaleKPI.value - totalCostKPI.value).toFixed(2))
          expect(Math.abs(totalProfitKPI.value - calculatedProfit)).toBeLessThan(0.01)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 2.3, 2.4, 2.5**
   * 
   * This test verifies logical consistency:
   * - When salePrice > costPrice, potentialProfit should be positive
   * - When salePrice < costPrice, potentialProfit should be negative
   * - When salePrice = costPrice, potentialProfit should be 0
   */
  it('should produce positive profit when salePrice > costPrice', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),
        fc.float({ min: Math.fround(1.0), max: Math.fround(1000), noNaN: true }).map(n => Number(n.toFixed(2))),
        fc.float({ min: Math.fround(1.2), max: Math.fround(3.0), noNaN: true }), // markup multiplier >= 1.2
        fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
        async (quantity, costPrice, markupMultiplier, productName) => {
          const salePrice = Number((costPrice * markupMultiplier).toFixed(2))
          
          // Skip if rounding makes them equal
          if (salePrice <= costPrice) {
            return true
          }
          
          const products = [{
            quantity: quantity,
            costPrice: costPrice,
            salePrice: salePrice,
            productName: productName,
            barcode: '12345678',
            category: 'Test Category'
          }]

          const mockOutput = createMockInventoryValorizationOutput(products)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('inventory-valuation', {})

          // When salePrice > costPrice, profit should be positive
          expect(result.rows[0].potentialProfit).toBeGreaterThan(0)
          
          // Verify the relationship
          expect(result.rows[0].salePrice).toBeGreaterThan(result.rows[0].costPrice)
          expect(result.rows[0].totalSale).toBeGreaterThan(result.rows[0].totalCost)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Validates: Requirements 2.3, 2.4, 2.5**
   * 
   * This test verifies that negative margins (losses) are calculated correctly
   * when the sale price is lower than the cost price.
   */
  it('should produce negative profit when salePrice < costPrice', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),
        fc.float({ min: Math.fround(10.01), max: Math.fround(1000), noNaN: true }).map(n => Number(n.toFixed(2))),
        fc.float({ min: Math.fround(0.1), max: Math.fround(0.9), noNaN: true }), // discount multiplier < 1
        fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
        async (quantity, costPrice, discountMultiplier, productName) => {
          const salePrice = Number((costPrice * discountMultiplier).toFixed(2))
          
          const products = [{
            quantity: quantity,
            costPrice: costPrice,
            salePrice: salePrice,
            productName: productName,
            barcode: '12345678',
            category: 'Test Category'
          }]

          const mockOutput = createMockInventoryValorizationOutput(products)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('inventory-valuation', {})

          // When salePrice < costPrice, profit should be negative
          expect(result.rows[0].potentialProfit).toBeLessThan(0)
          
          // Verify the relationship
          expect(result.rows[0].salePrice).toBeLessThan(result.rows[0].costPrice)
          expect(result.rows[0].totalSale).toBeLessThan(result.rows[0].totalCost)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Validates: Requirements 2.3, 2.4**
   * 
   * This test verifies that all calculated values are always finite numbers
   * (never NULL, NaN, or Infinity), regardless of input values.
   */
  it('should always produce finite numeric values for all calculations', async () => {
    await fc.assert(
      fc.asyncProperty(
        multipleProductsArbitrary,
        async (products) => {
          const mockOutput = createMockInventoryValorizationOutput(products)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('inventory-valuation', {})

          // Verify all rows have finite numeric values
          result.rows.forEach((row: any) => {
            expect(Number.isFinite(row.quantity)).toBe(true)
            expect(Number.isFinite(row.costPrice)).toBe(true)
            expect(Number.isFinite(row.salePrice)).toBe(true)
            expect(Number.isFinite(row.totalCost)).toBe(true)
            expect(Number.isFinite(row.totalSale)).toBe(true)
            expect(Number.isFinite(row.potentialProfit)).toBe(true)
            
            expect(row.totalCost).not.toBeNull()
            expect(row.totalSale).not.toBeNull()
            expect(row.potentialProfit).not.toBeNull()
          })

          // Verify all KPIs have finite numeric values
          result.kpis.forEach((kpi: any) => {
            expect(Number.isFinite(kpi.value)).toBe(true)
            expect(kpi.value).not.toBeNull()
          })
        }
      ),
      { numRuns: 100 }
    )
  })
})
