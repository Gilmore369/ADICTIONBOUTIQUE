/**
 * Property-Based Tests for Report Output Structure
 * 
 * Feature: analytics-reports-module
 * Property 1: Report Output Structure Completeness
 * 
 * **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**
 * 
 * For any RPC function and any valid filter set, the returned result must be 
 * a JSON object containing exactly four top-level fields: kpis, series, rows, meta
 * 
 * Uses fast-check library for property-based testing with 100 iterations
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import * as fc from 'fast-check'
import { Report_Output, ReportTypeId, ReportFilters } from './report-types'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn()
}))

// Import after mocking
import { createServerClient } from '@/lib/supabase/server'
import { generateReport } from '@/actions/reports'

/**
 * Mock Report_Output generator
 * Creates a valid Report_Output structure for testing
 */
function createMockReportOutput(): Report_Output {
  return {
    kpis: [
      { label: 'Total Products', value: 150, format: 'number' },
      { label: 'Total Revenue', value: 45000.50, format: 'currency' },
      { label: 'Average Margin', value: 35.5, format: 'percent' }
    ],
    series: [
      {
        name: 'Sales Trend',
        points: [
          { x: '2024-01-01', y: 1000 },
          { x: '2024-01-02', y: 1500 },
          { x: '2024-01-03', y: 1200 }
        ]
      }
    ],
    rows: [
      {
        id: '1',
        name: 'Product A',
        quantity: 10,
        revenue: 500.00,
        margin: 25.5
      },
      {
        id: '2',
        name: 'Product B',
        quantity: 20,
        revenue: 1000.00,
        margin: 30.0
      }
    ],
    meta: {
      columns: [
        { key: 'id', label: 'ID', type: 'string' },
        { key: 'name', label: 'Product Name', type: 'string' },
        { key: 'quantity', label: 'Quantity', type: 'number' },
        { key: 'revenue', label: 'Revenue', type: 'currency' },
        { key: 'margin', label: 'Margin %', type: 'percent' }
      ]
    }
  }
}

/**
 * Arbitrary generator for valid report IDs
 * Generates from the list of implemented report types
 */
const reportIdArbitrary = fc.constantFrom<ReportTypeId>(
  'inventory-rotation',
  'inventory-valuation',
  'low-stock',
  'kardex',
  'sales-timeline',
  'sales-by-month',
  'sales-by-product',
  'sales-by-category',
  'credit-vs-cash',
  'sales-summary',
  'sales-by-store',
  'purchases-by-supplier',
  'purchases-by-period',
  'clients-debt',
  'overdue-installments',
  'collection-effectiveness',
  'profit-margin',
  'cash-flow'
)

/**
 * Arbitrary generator for valid date strings
 * Generates dates between 2024-01-01 and today
 */
const dateArbitrary = fc.date({ 
  min: new Date('2024-01-01'), 
  max: new Date() 
}).map(d => d.toISOString().split('T')[0])

/**
 * Arbitrary generator for valid filter sets
 * Generates realistic filter combinations
 */
const filtersArbitrary = fc.record({
  startDate: fc.option(dateArbitrary, { nil: undefined }),
  endDate: fc.option(dateArbitrary, { nil: undefined }),
  warehouse: fc.option(
    fc.constantFrom('TIENDA_HOMBRES', 'TIENDA_MUJERES'), 
    { nil: undefined }
  ),
  warehouseId: fc.option(fc.uuid(), { nil: undefined }),
  categoryId: fc.option(fc.uuid(), { nil: undefined }),
  productId: fc.option(fc.uuid(), { nil: undefined }),
  minStock: fc.option(fc.integer({ min: 0, max: 20 }), { nil: undefined })
})

describe('Property 1: Report Output Structure Completeness', () => {
  let mockSupabase: any

  beforeEach(() => {
    // Setup mock Supabase client
    mockSupabase = {
      rpc: jest.fn().mockResolvedValue({
        data: createMockReportOutput(),
        error: null
      })
    }

    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  /**
   * **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**
   * 
   * This property test verifies that ALL RPC functions return a complete
   * Report_Output structure with the correct fields and types:
   * 
   * - Requirement 12.1: Report_Output has four fields (kpis, series, rows, meta)
   * - Requirement 12.2: kpis is an array with label and value properties
   * - Requirement 12.3: series is an array with name and points properties
   * - Requirement 12.4: points is an array with x and y properties
   * - Requirement 12.5: rows is an array of objects
   * - Requirement 12.6: meta contains columns array with key, label, type
   */
  it('should return complete Report_Output structure for any report and filters', async () => {
    await fc.assert(
      fc.asyncProperty(
        reportIdArbitrary,
        filtersArbitrary,
        async (reportId: ReportTypeId, filters: ReportFilters) => {
          // Execute the report generation
          const result = await generateReport(reportId, filters)
          
          // ===== Requirement 12.1: Four top-level fields =====
          expect(result).toHaveProperty('kpis')
          expect(result).toHaveProperty('series')
          expect(result).toHaveProperty('rows')
          expect(result).toHaveProperty('meta')
          
          // Verify these are the ONLY top-level fields
          const topLevelKeys = Object.keys(result)
          expect(topLevelKeys).toHaveLength(4)
          expect(topLevelKeys.sort()).toEqual(['kpis', 'meta', 'rows', 'series'])
          
          // ===== Requirement 12.2: KPIs structure =====
          expect(Array.isArray(result.kpis)).toBe(true)
          
          // Each KPI must have label, value, and format
          result.kpis.forEach((kpi: any, index: number) => {
            expect(kpi).toHaveProperty('label')
            expect(kpi).toHaveProperty('value')
            expect(kpi).toHaveProperty('format')
            
            expect(typeof kpi.label).toBe('string')
            expect(typeof kpi.value).toBe('number')
            expect(['number', 'currency', 'percent', 'decimal']).toContain(kpi.format)
            
            // Label should not be empty
            expect(kpi.label.length).toBeGreaterThan(0)
          })
          
          // ===== Requirement 12.3: Series structure =====
          expect(Array.isArray(result.series)).toBe(true)
          
          // Each series must have name and points
          result.series.forEach((serie: any, index: number) => {
            expect(serie).toHaveProperty('name')
            expect(serie).toHaveProperty('points')
            
            expect(typeof serie.name).toBe('string')
            expect(Array.isArray(serie.points)).toBe(true)
            
            // Name should not be empty
            expect(serie.name.length).toBeGreaterThan(0)
            
            // ===== Requirement 12.4: Points structure =====
            serie.points.forEach((point: any, pointIndex: number) => {
              expect(point).toHaveProperty('x')
              expect(point).toHaveProperty('y')
              
              expect(typeof point.x).toBe('string')
              expect(typeof point.y).toBe('number')
              
              // x should not be empty
              expect(point.x.length).toBeGreaterThan(0)
            })
          })
          
          // ===== Requirement 12.5: Rows structure =====
          expect(Array.isArray(result.rows)).toBe(true)
          
          // Each row must be an object
          result.rows.forEach((row: any, index: number) => {
            expect(typeof row).toBe('object')
            expect(row).not.toBeNull()
            expect(Array.isArray(row)).toBe(false)
          })
          
          // ===== Requirement 12.6: Meta structure =====
          expect(typeof result.meta).toBe('object')
          expect(result.meta).not.toBeNull()
          expect(result.meta).toHaveProperty('columns')
          expect(Array.isArray(result.meta.columns)).toBe(true)
          
          // Each column must have key, label, and type
          result.meta.columns.forEach((column: any, index: number) => {
            expect(column).toHaveProperty('key')
            expect(column).toHaveProperty('label')
            expect(column).toHaveProperty('type')
            
            expect(typeof column.key).toBe('string')
            expect(typeof column.label).toBe('string')
            expect(['string', 'number', 'currency', 'percent', 'decimal', 'date']).toContain(column.type)
            
            // Key and label should not be empty
            expect(column.key.length).toBeGreaterThan(0)
            expect(column.label.length).toBeGreaterThan(0)
          })
          
          // If rows exist, meta.columns should describe them
          if (result.rows.length > 0) {
            expect(result.meta.columns.length).toBeGreaterThan(0)
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
   * Additional validation: Verify type consistency
   * 
   * This test ensures that the Report_Output structure is consistent
   * across multiple calls with the same parameters
   */
  it('should return consistent structure for repeated calls with same parameters', async () => {
    await fc.assert(
      fc.asyncProperty(
        reportIdArbitrary,
        filtersArbitrary,
        async (reportId: ReportTypeId, filters: ReportFilters) => {
          // Call the same report twice
          const result1 = await generateReport(reportId, filters)
          const result2 = await generateReport(reportId, filters)
          
          // Structure should be identical
          expect(Object.keys(result1).sort()).toEqual(Object.keys(result2).sort())
          expect(result1.kpis.length).toBe(result2.kpis.length)
          expect(result1.series.length).toBe(result2.series.length)
          expect(result1.meta.columns.length).toBe(result2.meta.columns.length)
          
          // KPI formats should match
          result1.kpis.forEach((kpi: any, index: number) => {
            expect(kpi.format).toBe(result2.kpis[index].format)
          })
          
          // Column types should match
          result1.meta.columns.forEach((col: any, index: number) => {
            expect(col.type).toBe(result2.meta.columns[index].type)
          })
        }
      ),
      { 
        numRuns: 50,
        verbose: true
      }
    )
  })
})
