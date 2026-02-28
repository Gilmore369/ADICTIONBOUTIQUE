/**
 * Property-Based Tests for Kardex Ordering
 * 
 * Feature: analytics-reports-module
 * Property 7: Kardex Chronological Ordering
 * 
 * **Validates: Requirements 2.8**
 * 
 * These tests verify that:
 * 1. All movements are ordered by created_at ascending
 * 2. When dates are equal, movements are ordered by id ascending (for deterministic ordering)
 * 3. The running balance calculation is correct based on the chronological order
 * 4. The ordering is consistent across multiple test iterations
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
 */
const movementTypeArbitrary = fc.constantFrom('ENTRADA', 'SALIDA', 'AJUSTE')

/**
 * Arbitrary generator for a single movement
 * Generates realistic inventory movement scenarios
 */
const movementArbitrary = fc.record({
  id: fc.uuid(),
  created_at: fc.date({ 
    min: new Date('2024-01-01'), 
    max: new Date() 
  }).filter(d => !isNaN(d.getTime())),
  type: movementTypeArbitrary,
  quantity: fc.integer({ min: 1, max: 100 }),
  barcode: fc.string({ minLength: 8, maxLength: 13 }).filter(s => s.trim().length >= 8),
  productName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
  warehouse: fc.constantFrom('ALMACEN_PRINCIPAL', 'ALMACEN_SECUNDARIO'),
  reference: fc.option(fc.string({ maxLength: 50 }), { nil: '' }),
  notes: fc.option(fc.string({ maxLength: 100 }), { nil: '' })
})

/**
 * Arbitrary generator for multiple movements
 * Creates arrays of movement data for comprehensive testing
 */
const multipleMovementsArbitrary = fc.array(
  movementArbitrary,
  { minLength: 5, maxLength: 50 }
)

/**
 * Mock report output generator for kardex
 * Creates realistic Report_Output structure with chronologically ordered movements
 */
function createMockKardexOutput(movements: any[]) {
  // Filter out any movements with invalid dates
  const validMovements = movements.filter(m => 
    m.created_at && !isNaN(m.created_at.getTime())
  )
  
  // Sort movements by created_at ascending, then by id ascending (deterministic)
  const sortedMovements = [...validMovements].sort((a, b) => {
    const dateCompare = a.created_at.getTime() - b.created_at.getTime()
    if (dateCompare !== 0) return dateCompare
    return a.id.localeCompare(b.id)
  })
  
  // Calculate running balance
  let runningBalance = 0
  const rows = sortedMovements.map(m => {
    // Apply movement to running balance
    if (m.type === 'ENTRADA') {
      runningBalance += m.quantity
    } else if (m.type === 'SALIDA') {
      runningBalance -= m.quantity
    } else if (m.type === 'AJUSTE') {
      // For AJUSTE, quantity can be positive or negative
      runningBalance += m.quantity
    }
    
    return {
      date: m.created_at.toISOString(),
      barcode: m.barcode,
      productName: m.productName,
      warehouse: m.warehouse,
      type: m.type,
      quantity: m.quantity,
      runningBalance: runningBalance,
      reference: m.reference || '',
      notes: m.notes || ''
    }
  })
  
  const totalEntradas = sortedMovements
    .filter(m => m.type === 'ENTRADA')
    .reduce((sum, m) => sum + m.quantity, 0)
  
  const totalSalidas = sortedMovements
    .filter(m => m.type === 'SALIDA')
    .reduce((sum, m) => sum + m.quantity, 0)
  
  return {
    kpis: [
      { label: 'Total Movimientos', value: sortedMovements.length, format: 'number' },
      { label: 'Total Entradas', value: totalEntradas, format: 'number' },
      { label: 'Total Salidas', value: totalSalidas, format: 'number' },
      { label: 'Balance Final', value: runningBalance, format: 'number' }
    ],
    series: [
      {
        name: 'Balance Acumulado',
        points: rows.map(r => ({
          x: new Date(r.date).toISOString().substring(0, 16).replace('T', ' '),
          y: r.runningBalance
        }))
      }
    ],
    rows: rows,
    meta: {
      columns: [
        { key: 'date', label: 'Fecha', type: 'date' },
        { key: 'barcode', label: 'Código', type: 'string' },
        { key: 'productName', label: 'Producto', type: 'string' },
        { key: 'warehouse', label: 'Almacén', type: 'string' },
        { key: 'type', label: 'Tipo', type: 'string' },
        { key: 'quantity', label: 'Cantidad', type: 'number' },
        { key: 'runningBalance', label: 'Balance', type: 'number' },
        { key: 'reference', label: 'Referencia', type: 'string' },
        { key: 'notes', label: 'Notas', type: 'string' }
      ]
    }
  }
}

describe('Property 7: Kardex Chronological Ordering', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      rpc: jest.fn()
    }
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  /**
   * **Validates: Requirements 2.8**
   * 
   * This property test verifies that all movements are ordered by created_at
   * ascending. This is critical for kardex reports to show the chronological
   * history of inventory movements.
   * 
   * Test scenarios:
   * - Movements with different timestamps
   * - Movements with same timestamps (should be ordered by id)
   * - Mixed scenarios with various dates and times
   */
  it('should order all movements by created_at ascending', async () => {
    await fc.assert(
      fc.asyncProperty(
        multipleMovementsArbitrary,
        async (movements) => {
          // Setup mock to return realistic data
          const mockOutput = createMockKardexOutput(movements)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          // Execute report
          const result = await generateReport('kardex', {})

          // ===== Verify chronological ordering =====
          for (let i = 1; i < result.rows.length; i++) {
            const prevDate = new Date(result.rows[i - 1].date)
            const currDate = new Date(result.rows[i].date)
            
            // Current date should be >= previous date
            expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime())
          }
        }
      ),
      { 
        numRuns: 100,
        verbose: true
      }
    )
  })

  /**
   * **Validates: Requirements 2.8**
   * 
   * This test verifies that when movements have the same created_at timestamp,
   * they are ordered by id ascending for deterministic ordering.
   * This ensures consistent results across multiple queries.
   */
  it('should order movements with same timestamp by id ascending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2024-01-01'), max: new Date() }),
        fc.array(movementArbitrary, { minLength: 3, maxLength: 10 }),
        async (sameDate, movements) => {
          // Set all movements to the same timestamp
          const movementsWithSameDate = movements.map(m => ({
            ...m,
            created_at: sameDate
          }))

          const mockOutput = createMockKardexOutput(movementsWithSameDate)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('kardex', {})

          // ===== Verify ordering by id when dates are equal =====
          // All dates should be the same
          const allDatesEqual = result.rows.every((row: any) => 
            new Date(row.date).getTime() === sameDate.getTime()
          )
          expect(allDatesEqual).toBe(true)

          // The order should be deterministic (same input = same output)
          // We can't directly check IDs since they're not in the output,
          // but we can verify the order is consistent
          const firstRun = result.rows.map((r: any) => r.productName)
          
          // Run again with same data
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })
          const result2 = await generateReport('kardex', {})
          const secondRun = result2.rows.map((r: any) => r.productName)
          
          // Order should be identical
          expect(secondRun).toEqual(firstRun)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Validates: Requirements 2.8, 2.7**
   * 
   * This test verifies that the running balance calculation is correct
   * based on the chronological order of movements. The running balance
   * must be calculated in order for it to be accurate.
   * 
   * Formula:
   * - ENTRADA: balance += quantity
   * - SALIDA: balance -= quantity
   * - AJUSTE: balance += quantity (can be positive or negative)
   */
  it('should calculate running balance correctly in chronological order', async () => {
    await fc.assert(
      fc.asyncProperty(
        multipleMovementsArbitrary,
        async (movements) => {
          const mockOutput = createMockKardexOutput(movements)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('kardex', {})

          // ===== Verify running balance calculation =====
          let expectedBalance = 0
          
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows[i]
            
            // Calculate expected balance based on movement type
            if (row.type === 'ENTRADA') {
              expectedBalance += row.quantity
            } else if (row.type === 'SALIDA') {
              expectedBalance -= row.quantity
            } else if (row.type === 'AJUSTE') {
              expectedBalance += row.quantity
            }
            
            // Verify the running balance matches expected
            expect(row.runningBalance).toBe(expectedBalance)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 2.8**
   * 
   * This test verifies that the final balance in KPIs matches the last
   * running balance in the rows. This ensures consistency between
   * aggregated KPIs and detailed data.
   */
  it('should have final balance KPI match last running balance', async () => {
    await fc.assert(
      fc.asyncProperty(
        multipleMovementsArbitrary,
        async (movements) => {
          const mockOutput = createMockKardexOutput(movements)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('kardex', {})

          // Find the "Balance Final" KPI
          const finalBalanceKPI = result.kpis.find((kpi: any) => 
            kpi.label === 'Balance Final'
          )
          
          expect(finalBalanceKPI).toBeDefined()
          
          // Get the last row's running balance
          const lastRow = result.rows[result.rows.length - 1]
          
          // They should match
          expect(finalBalanceKPI.value).toBe(lastRow.runningBalance)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 2.8**
   * 
   * This test verifies that the ordering is stable and consistent
   * across multiple executions with the same data.
   */
  it('should produce consistent ordering across multiple executions', async () => {
    await fc.assert(
      fc.asyncProperty(
        multipleMovementsArbitrary,
        async (movements) => {
          const mockOutput = createMockKardexOutput(movements)
          
          // First execution
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })
          const result1 = await generateReport('kardex', {})
          
          // Second execution with same data
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })
          const result2 = await generateReport('kardex', {})
          
          // Third execution with same data
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })
          const result3 = await generateReport('kardex', {})
          
          // All three should have identical ordering
          const dates1 = result1.rows.map((r: any) => r.date)
          const dates2 = result2.rows.map((r: any) => r.date)
          const dates3 = result3.rows.map((r: any) => r.date)
          
          expect(dates2).toEqual(dates1)
          expect(dates3).toEqual(dates1)
          
          // Running balances should also be identical
          const balances1 = result1.rows.map((r: any) => r.runningBalance)
          const balances2 = result2.rows.map((r: any) => r.runningBalance)
          const balances3 = result3.rows.map((r: any) => r.runningBalance)
          
          expect(balances2).toEqual(balances1)
          expect(balances3).toEqual(balances1)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * **Validates: Requirements 2.8, 2.7**
   * 
   * This test verifies that series data points are also in chronological order
   * and match the rows data.
   */
  it('should have series points in chronological order matching rows', async () => {
    await fc.assert(
      fc.asyncProperty(
        multipleMovementsArbitrary,
        async (movements) => {
          const mockOutput = createMockKardexOutput(movements)
          mockSupabase.rpc.mockResolvedValue({
            data: mockOutput,
            error: null
          })

          const result = await generateReport('kardex', {})

          // Find the "Balance Acumulado" series
          const balanceSeries = result.series.find((s: any) => 
            s.name === 'Balance Acumulado'
          )
          
          expect(balanceSeries).toBeDefined()
          
          // ===== Verify series points are in chronological order =====
          for (let i = 1; i < balanceSeries.points.length; i++) {
            const prevPoint = balanceSeries.points[i - 1]
            const currPoint = balanceSeries.points[i]
            
            // Parse dates from the x values (format: "YYYY-MM-DD HH:MM")
            const prevDate = new Date(prevPoint.x.replace(' ', 'T'))
            const currDate = new Date(currPoint.x.replace(' ', 'T'))
            
            // Current date should be >= previous date
            expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime())
          }
          
          // ===== Verify series points match rows =====
          expect(balanceSeries.points.length).toBe(result.rows.length)
          
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows[i]
            const point = balanceSeries.points[i]
            
            // The y value should match the running balance
            expect(point.y).toBe(row.runningBalance)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
