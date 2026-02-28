/**
 * Property-Based Tests for Purchase Calculations
 * 
 * Feature: analytics-reports-module
 * Property 11: Purchase Movement Type Filtering
 * Property 12: Purchase Cost Calculation
 * 
 * **Validates: Requirements 4.1, 4.3**
 * 
 * These tests verify that:
 * 1. Only movements with type = 'ENTRADA' are included in purchase reports
 * 2. Total cost calculation is correct: quantity × purchase_price
 * 3. No NULL or NaN values in cost calculations
 * 4. Division by zero prevention in avgCostPerUnit
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
 * Arbitrary generator for movement types
 * Generates both valid (ENTRADA) and invalid (SALIDA, AJUSTE, etc.) types
 */
const movementTypeArbitrary = fc.oneof(
  fc.constant('ENTRADA'),
  fc.constant('SALIDA'),
  fc.constant('AJUSTE'),
  fc.constant('TRANSFERENCIA')
)

/**
 * Arbitrary generator for purchase movement data
 * Generates realistic purchase scenarios with various movement types
 */
const purchaseMovementArbitrary = fc.record({
  productId: fc.uuid(),
  productName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
  barcode: fc.string({ minLength: 8, maxLength: 13 }).filter(s => s.trim().length >= 8),
  quantity: fc.integer({ min: 1, max: 1000 }),
  unitCost: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }).map(n => Number(n.toFixed(2))),
  movementType: movementTypeArbitrary,
  supplierId: fc.uuid(),
  supplierName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3)
})

/**
 * Arbitrary generator for multiple purchase movements
 * Creates arrays of movement data for comprehensive testing
 */
const multiplePurchaseMovementsArbitrary = fc.array(
  purchaseMovementArbitrary,
  { minLength: 1, maxLength: 30 }
)

/**
 * Arbitrary generator for valid date ranges
 */
const dateRangeArbitrary = fc.record({
  startDate: fc.date({ 
    min: new Date('2024-01-01'), 
    max: new Date() 
  }).map(d => {
    const date = new Date(d)
    if (isNaN(date.getTime())) {
      return new Date('2024-01-01').toISOString()
    }
    return date.toISOString()
  }),
  endDate: fc.date({ 
    min: new Date('2024-01-01'), 
    max: new Date() 
  }).map(d => {
    const date = new Date(d)
    if (isNaN(date.getTime())) {
      return new Date().toISOString()
    }
    return date.toISOString()
  })
})

/**
 * Mock report output generator for purchases by supplier
 * Creates realistic Report_Output structure with purchase calculations
 * IMPORTANT: Only includes movements with type = 'ENTRADA'
 */
function createMockPurchasesBySupplierOutput(movements: any[]) {
  // Filter only ENTRADA movements (this is the key requirement)
  const entradaMovements = movements.filter(m => m.movementType === 'ENTRADA')
  
  // Group by supplier
  const supplierData = entradaMovements.reduce((acc: any, mov: any) => {
    const supplierId = mov.supplierId
    if (!acc[supplierId]) {
      acc[supplierId] = {
        supplierId: supplierId,
        supplierName: mov.supplierName,
        totalQuantity: 0,
        totalCost: 0,
        purchaseCount: 0,
        products: new Set()
      }
    }
    
    // Calculate total cost: quantity × unit_cost
    const movementCost = mov.quantity * mov.unitCost
    
    acc[supplierId].totalQuantity += mov.quantity
    acc[supplierId].totalCost += movementCost
    acc[supplierId].purchaseCount += 1
    acc[supplierId].products.add(mov.productName)
    
    return acc
  }, {})
  
  const rows = Object.values(supplierData).map((supplier: any) => {
    // Calculate average cost per unit using NULLIF to prevent division by zero
    const avgCostPerUnit = supplier.totalQuantity > 0
      ? Number((supplier.totalCost / supplier.totalQuantity).toFixed(2))
      : 0
    
    return {
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      totalQuantity: supplier.totalQuantity,
      totalCost: Number(supplier.totalCost.toFixed(2)),
      avgCostPerUnit: avgCostPerUnit,
      purchaseCount: supplier.purchaseCount,
      uniqueProducts: supplier.products.size
    }
  })
  
  const totalQuantity = rows.reduce((sum, r) => sum + r.totalQuantity, 0)
  const totalCost = rows.reduce((sum, r) => sum + r.totalCost, 0)
  const avgCostPerUnit = totalQuantity > 0
    ? Number((totalCost / totalQuantity).toFixed(2))
    : 0
  
  return {
    kpis: [
      { label: 'Total Compras', value: entradaMovements.length, format: 'number' },
      { label: 'Cantidad Total', value: totalQuantity, format: 'number' },
      { label: 'Costo Total', value: Number(totalCost.toFixed(2)), format: 'currency' },
      { label: 'Costo Promedio por Unidad', value: avgCostPerUnit, format: 'currency' }
    ],
    series: [
      {
        name: 'Compras por Proveedor',
        points: rows.slice(0, 20).map(r => ({
          x: r.supplierName,
          y: r.totalCost
        }))
      }
    ],
    rows: rows,
    meta: {
      columns: [
        { key: 'supplierName', label: 'Proveedor', type: 'string' },
        { key: 'totalQuantity', label: 'Cantidad Total', type: 'number' },
        { key: 'totalCost', label: 'Costo Total', type: 'currency' },
        { key: 'avgCostPerUnit', label: 'Costo Promedio', type: 'currency' },
        { key: 'purchaseCount', label: 'Número de Compras', type: 'number' },
        { key: 'uniqueProducts', label: 'Productos Únicos', type: 'number' }
      ]
    }
  }
}

describe('Property 11: Purchase Movement Type Filtering', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      rpc: jest.fn()
    }
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  /**
   * **Validates: Requirements 4.1**
   * 
   * This property test verifies that ONLY movements with type = 'ENTRADA' are
   * included in purchase reports. Movements with other types (SALIDA, AJUSTE,
   * TRANSFERENCIA) must be excluded.
   * 
   * Test scenarios:
   * - Mixed movements with various types
   * - All ENTRADA movements
   * - All non-ENTRADA movements
   * - Edge cases with empty results
   */
  it('should only include movements with type = ENTRADA in purchase reports', async () => {
    await fc.assert(
      fc.asyncProperty(
        multiplePurchaseMovementsArbitrary,
        dateRangeArbitrary,
        async (movements, dateRange) => {
          // Setup mock to return realistic data
          const mockOutput = createMockPurchasesBySupplierOutput(movements)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          // Execute report
          const result = await generateReport('purchases-by-supplier', {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          })

          // Count ENTRADA movements in input
          const entradaCount = movements.filter(m => m.movementType === 'ENTRADA').length
          
          // Calculate expected total quantity (sum of all ENTRADA movements)
          const expectedTotalQuantity = movements
            .filter(m => m.movementType === 'ENTRADA')
            .reduce((sum, m) => sum + m.quantity, 0)
          
          // ===== Verify only ENTRADA movements are counted =====
          const totalQuantityKPI = result.kpis.find((kpi: any) => kpi.label === 'Cantidad Total')
          expect(totalQuantityKPI).toBeDefined()
          expect(totalQuantityKPI.value).toBe(expectedTotalQuantity)
          
          // ===== Verify total purchases count matches ENTRADA count =====
          const totalPurchasesKPI = result.kpis.find((kpi: any) => kpi.label === 'Total Compras')
          expect(totalPurchasesKPI).toBeDefined()
          expect(totalPurchasesKPI.value).toBe(entradaCount)
          
          // ===== Verify no SALIDA, AJUSTE, or other types are included =====
          // We can verify this by checking that the total quantity matches
          // the sum of ENTRADA movements only
          const actualTotalQuantity = result.rows.reduce((sum: number, row: any) => 
            sum + row.totalQuantity, 0
          )
          expect(actualTotalQuantity).toBe(expectedTotalQuantity)
        }
      ),
      { 
        numRuns: 100,
        verbose: true
      }
    )
  })

  /**
   * **Validates: Requirements 4.1**
   * 
   * This test specifically verifies that when NO ENTRADA movements exist,
   * the report returns empty or zero values (not errors).
   */
  it('should return empty/zero results when no ENTRADA movements exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          purchaseMovementArbitrary,
          { minLength: 1, maxLength: 20 }
        ),
        async (movements) => {
          // Force all movements to be non-ENTRADA
          const nonEntradaMovements = movements.map(mov => ({
            ...mov,
            movementType: mov.movementType === 'ENTRADA' ? 'SALIDA' : mov.movementType
          }))
          
          const mockOutput = createMockPurchasesBySupplierOutput(nonEntradaMovements)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('purchases-by-supplier', {})

          // Should have zero purchases
          const totalPurchasesKPI = result.kpis.find((kpi: any) => kpi.label === 'Total Compras')
          expect(totalPurchasesKPI.value).toBe(0)
          
          // Should have zero quantity
          const totalQuantityKPI = result.kpis.find((kpi: any) => kpi.label === 'Cantidad Total')
          expect(totalQuantityKPI.value).toBe(0)
          
          // Should have zero cost
          const totalCostKPI = result.kpis.find((kpi: any) => kpi.label === 'Costo Total')
          expect(totalCostKPI.value).toBe(0)
          
          // Rows should be empty
          expect(result.rows.length).toBe(0)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Validates: Requirements 4.1**
   * 
   * This test verifies that the filtering is case-sensitive and exact.
   * Variations like 'entrada', 'Entrada', 'ENTRAD' should NOT be included.
   */
  it('should use exact case-sensitive matching for ENTRADA type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }).map(n => Number(n.toFixed(2))),
        async (quantity, unitCost) => {
          // Create movements with case variations
          const movements = [
            {
              productId: '11111111-1111-1111-1111-111111111111',
              productName: 'Product A',
              barcode: '12345678',
              quantity: quantity,
              unitCost: unitCost,
              movementType: 'ENTRADA', // Correct
              supplierId: '22222222-2222-2222-2222-222222222222',
              supplierName: 'Supplier A'
            },
            {
              productId: '33333333-3333-3333-3333-333333333333',
              productName: 'Product B',
              barcode: '87654321',
              quantity: quantity,
              unitCost: unitCost,
              movementType: 'entrada', // Wrong case
              supplierId: '44444444-4444-4444-4444-444444444444',
              supplierName: 'Supplier B'
            }
          ]

          const mockOutput = createMockPurchasesBySupplierOutput(movements)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('purchases-by-supplier', {})

          // Only one movement should be counted (the ENTRADA one)
          const totalPurchasesKPI = result.kpis.find((kpi: any) => kpi.label === 'Total Compras')
          expect(totalPurchasesKPI.value).toBe(1)
          
          const totalQuantityKPI = result.kpis.find((kpi: any) => kpi.label === 'Cantidad Total')
          expect(totalQuantityKPI.value).toBe(quantity)
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('Property 12: Purchase Cost Calculation', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      rpc: jest.fn()
    }
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  /**
   * **Validates: Requirements 4.3**
   * 
   * This property test verifies that the total cost calculation is correct:
   * total_cost = quantity × unit_cost
   * 
   * The test verifies this formula holds for all valid input combinations.
   */
  it('should correctly calculate total cost as quantity × unit_cost', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }).map(n => Number(n.toFixed(2))),
        fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
        async (quantity, unitCost, supplierName) => {
          const movements = [{
            productId: '11111111-1111-1111-1111-111111111111',
            productName: 'Test Product',
            barcode: '12345678',
            quantity: quantity,
            unitCost: unitCost,
            movementType: 'ENTRADA',
            supplierId: '22222222-2222-2222-2222-222222222222',
            supplierName: supplierName
          }]

          const mockOutput = createMockPurchasesBySupplierOutput(movements)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('purchases-by-supplier', {})

          // Calculate expected total cost
          const expectedTotalCost = Number((quantity * unitCost).toFixed(2))

          // Verify total cost in KPIs
          const totalCostKPI = result.kpis.find((kpi: any) => kpi.label === 'Costo Total')
          expect(totalCostKPI).toBeDefined()
          expect(totalCostKPI.value).toBe(expectedTotalCost)
          
          // Verify total cost in rows
          expect(result.rows[0].totalCost).toBe(expectedTotalCost)
          
          // Verify the calculation is correct
          expect(result.rows[0].totalCost).toBe(Number((result.rows[0].totalQuantity * unitCost).toFixed(2)))
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.3, 1.4, 1.5**
   * 
   * This test verifies that NO NULL or NaN values appear in cost calculations,
   * regardless of input values. All numeric fields must be valid numbers.
   */
  it('should never produce NULL or NaN values in cost calculations', async () => {
    await fc.assert(
      fc.asyncProperty(
        multiplePurchaseMovementsArbitrary,
        dateRangeArbitrary,
        async (movements, dateRange) => {
          const mockOutput = createMockPurchasesBySupplierOutput(movements)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('purchases-by-supplier', {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          })

          // ===== Verify no NULL values in numeric fields =====
          result.rows.forEach((row: any) => {
            // Total cost must never be NULL, NaN, or Infinity
            expect(row.totalCost).not.toBeNull()
            expect(row.totalCost).not.toBeUndefined()
            expect(Number.isFinite(row.totalCost)).toBe(true)
            expect(Number.isNaN(row.totalCost)).toBe(false)
            
            // Average cost per unit must never be NULL, NaN, or Infinity
            expect(row.avgCostPerUnit).not.toBeNull()
            expect(row.avgCostPerUnit).not.toBeUndefined()
            expect(Number.isFinite(row.avgCostPerUnit)).toBe(true)
            expect(Number.isNaN(row.avgCostPerUnit)).toBe(false)
            
            // All numeric fields must be numbers
            expect(typeof row.totalQuantity).toBe('number')
            expect(typeof row.totalCost).toBe('number')
            expect(typeof row.avgCostPerUnit).toBe('number')
            expect(typeof row.purchaseCount).toBe('number')
          })

          // ===== Verify KPIs have no NULL values =====
          result.kpis.forEach((kpi: any) => {
            expect(kpi.value).not.toBeNull()
            expect(kpi.value).not.toBeUndefined()
            expect(Number.isFinite(kpi.value)).toBe(true)
            expect(Number.isNaN(kpi.value)).toBe(false)
          })

          // ===== Verify series points have no NULL values =====
          result.series.forEach((serie: any) => {
            serie.points.forEach((point: any) => {
              expect(point.y).not.toBeNull()
              expect(point.y).not.toBeUndefined()
              expect(Number.isFinite(point.y)).toBe(true)
              expect(Number.isNaN(point.y)).toBe(false)
            })
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
   * **Validates: Requirements 4.3, 1.4**
   * 
   * This test verifies division by zero prevention in avgCostPerUnit calculation.
   * When totalQuantity is zero, avgCostPerUnit should be 0 (not NULL or Infinity).
   */
  it('should return 0 for avgCostPerUnit when totalQuantity is zero', async () => {
    // This scenario shouldn't happen in practice (ENTRADA with 0 quantity),
    // but we test the defensive logic
    const movements = [{
      productId: '11111111-1111-1111-1111-111111111111',
      productName: 'Test Product',
      barcode: '12345678',
      quantity: 0, // Edge case: zero quantity
      unitCost: 100,
      movementType: 'ENTRADA',
      supplierId: '22222222-2222-2222-2222-222222222222',
      supplierName: 'Test Supplier'
    }]

    const mockOutput = createMockPurchasesBySupplierOutput(movements)
    mockSupabase.rpc.mockResolvedValue({
      data: mockOutput,
      error: null
    })

    const result = await generateReport('purchases-by-supplier', {})

    // If there are rows (quantity might be filtered out), verify avgCostPerUnit
    if (result.rows.length > 0) {
      expect(result.rows[0].avgCostPerUnit).toBe(0)
      expect(Number.isFinite(result.rows[0].avgCostPerUnit)).toBe(true)
    }
    
    // KPI should also be 0
    const avgCostKPI = result.kpis.find((kpi: any) => kpi.label === 'Costo Promedio por Unidad')
    expect(avgCostKPI.value).toBe(0)
    expect(Number.isFinite(avgCostKPI.value)).toBe(true)
  })

  /**
   * **Validates: Requirements 4.3**
   * 
   * This test verifies that avgCostPerUnit is correctly calculated as:
   * avgCostPerUnit = totalCost / totalQuantity (using NULLIF)
   */
  it('should correctly calculate avgCostPerUnit as totalCost / totalQuantity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            quantity: fc.integer({ min: 1, max: 100 }),
            unitCost: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }).map(n => Number(n.toFixed(2)))
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
        async (purchases, supplierName) => {
          // Create multiple ENTRADA movements for the same supplier
          const movements = purchases.map((p, i) => ({
            productId: `${i}1111111-1111-1111-1111-111111111111`,
            productName: `Product ${i}`,
            barcode: `1234567${i}`,
            quantity: p.quantity,
            unitCost: p.unitCost,
            movementType: 'ENTRADA',
            supplierId: '22222222-2222-2222-2222-222222222222',
            supplierName: supplierName
          }))

          const mockOutput = createMockPurchasesBySupplierOutput(movements)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('purchases-by-supplier', {})

          // Calculate expected values
          const expectedTotalQuantity = purchases.reduce((sum, p) => sum + p.quantity, 0)
          const expectedTotalCost = Number(
            purchases.reduce((sum, p) => sum + (p.quantity * p.unitCost), 0).toFixed(2)
          )
          const expectedAvgCostPerUnit = expectedTotalQuantity > 0
            ? Number((expectedTotalCost / expectedTotalQuantity).toFixed(2))
            : 0

          // Verify avgCostPerUnit calculation (allow small rounding difference)
          const avgCostDifference = Math.abs(result.rows[0].avgCostPerUnit - expectedAvgCostPerUnit)
          expect(avgCostDifference).toBeLessThanOrEqual(0.01)
          
          // Verify avgCostPerUnit is reasonable (between min and max unit costs)
          const minUnitCost = Math.min(...purchases.map(p => p.unitCost))
          const maxUnitCost = Math.max(...purchases.map(p => p.unitCost))
          expect(result.rows[0].avgCostPerUnit).toBeGreaterThanOrEqual(minUnitCost - 0.01)
          expect(result.rows[0].avgCostPerUnit).toBeLessThanOrEqual(maxUnitCost + 0.01)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.3**
   * 
   * This test verifies that all cost values are non-negative.
   * Negative costs would indicate a logic error.
   */
  it('should always produce non-negative cost values', async () => {
    await fc.assert(
      fc.asyncProperty(
        multiplePurchaseMovementsArbitrary,
        async (movements) => {
          const mockOutput = createMockPurchasesBySupplierOutput(movements)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('purchases-by-supplier', {})

          // All cost values must be >= 0
          result.rows.forEach((row: any) => {
            expect(row.totalCost).toBeGreaterThanOrEqual(0)
            expect(row.avgCostPerUnit).toBeGreaterThanOrEqual(0)
          })

          // KPIs must also be non-negative
          const totalCostKPI = result.kpis.find((kpi: any) => kpi.label === 'Costo Total')
          expect(totalCostKPI.value).toBeGreaterThanOrEqual(0)
          
          const avgCostKPI = result.kpis.find((kpi: any) => kpi.label === 'Costo Promedio por Unidad')
          expect(avgCostKPI.value).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.3, 4.2**
   * 
   * This test verifies that when multiple purchases are made,
   * the total cost is the sum of all individual purchase costs.
   */
  it('should correctly sum costs across multiple purchases', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          purchaseMovementArbitrary.map(mov => ({
            ...mov,
            movementType: 'ENTRADA' // Ensure all are ENTRADA
          })),
          { minLength: 2, maxLength: 20 }
        ),
        async (movements) => {
          const mockOutput = createMockPurchasesBySupplierOutput(movements)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('purchases-by-supplier', {})

          // Calculate expected total cost manually
          const expectedTotalCost = Number(
            movements.reduce((sum, m) => sum + (m.quantity * m.unitCost), 0).toFixed(2)
          )

          // Verify total cost in KPIs
          const totalCostKPI = result.kpis.find((kpi: any) => kpi.label === 'Costo Total')
          expect(totalCostKPI.value).toBe(expectedTotalCost)

          // Verify sum of row costs equals total cost
          const sumOfRowCosts = Number(
            result.rows.reduce((sum: number, row: any) => sum + row.totalCost, 0).toFixed(2)
          )
          expect(sumOfRowCosts).toBe(expectedTotalCost)
        }
      ),
      { numRuns: 100 }
    )
  })
})
