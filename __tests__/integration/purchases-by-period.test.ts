/**
 * Integration Test for analytics.report_purchases_by_period
 * 
 * Feature: analytics-reports-module
 * Task: 6.3 Implementar `analytics.report_purchases_by_period`
 * 
 * **Validates: Requirements 4.5**
 * 
 * This test verifies that the report_purchases_by_period function:
 * - Groups purchases by time periods (daily, weekly, monthly)
 * - Calculates purchase trends over time
 * - Returns valid Report_Output structure
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'

// Skip tests if no Supabase credentials are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const describeIfSupabase = supabaseUrl && supabaseKey ? describe : describe.skip

describeIfSupabase('analytics.report_purchases_by_period Integration Tests', () => {
  let supabase: ReturnType<typeof createClient>
  
  beforeAll(() => {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found')
    }
    supabase = createClient(supabaseUrl, supabaseKey)
  })
  
  it('should return valid Report_Output structure', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_period', { filters })
    
    // Verify no error
    expect(error).toBeNull()
    
    // Verify data structure
    expect(data).toBeDefined()
    expect(data).toHaveProperty('kpis')
    expect(data).toHaveProperty('series')
    expect(data).toHaveProperty('rows')
    expect(data).toHaveProperty('meta')
    
    // Verify kpis is an array
    expect(Array.isArray(data.kpis)).toBe(true)
    
    // Verify expected KPIs exist
    const kpiLabels = data.kpis.map((kpi: any) => kpi.label)
    expect(kpiLabels).toContain('Períodos Analizados')
    expect(kpiLabels).toContain('Cantidad Total Comprada')
    expect(kpiLabels).toContain('Costo Total de Compras')
    expect(kpiLabels).toContain('Costo Promedio por Período')
    expect(kpiLabels).toContain('Tendencia')
    
    // Verify all KPIs have valid numeric values
    data.kpis.forEach((kpi: any) => {
      expect(kpi).toHaveProperty('label')
      expect(kpi).toHaveProperty('value')
      expect(kpi).toHaveProperty('format')
      expect(typeof kpi.value).toBe('number')
      expect(isNaN(kpi.value)).toBe(false)
      expect(isFinite(kpi.value)).toBe(true)
    })
  })
  
  it('should group purchases by time periods', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_period', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(Array.isArray(data.rows)).toBe(true)
    
    // Verify each row has period information
    data.rows.forEach((row: any) => {
      expect(row).toHaveProperty('period')
      expect(row).toHaveProperty('periodType')
      expect(typeof row.period).toBe('string')
      expect(typeof row.periodType).toBe('string')
      
      // Period type should be one of: day, week, month
      expect(['day', 'week', 'month']).toContain(row.periodType)
    })
    
    // Verify periods are unique (grouped by period)
    const periods = data.rows.map((row: any) => row.period)
    const uniquePeriods = new Set(periods)
    expect(periods.length).toBe(uniquePeriods.size)
  })
  
  it('should use daily grouping for short date ranges (< 31 days)', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-01-15'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_period', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // If there are rows, they should be grouped by day
    if (data.rows.length > 0) {
      data.rows.forEach((row: any) => {
        expect(row.periodType).toBe('day')
        // Period should be in YYYY-MM-DD format
        expect(row.period).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })
    }
  })
  
  it('should use weekly grouping for medium date ranges (31-180 days)', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-03-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_period', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // If there are rows, they should be grouped by week
    if (data.rows.length > 0) {
      data.rows.forEach((row: any) => {
        expect(row.periodType).toBe('week')
        // Period should be in YYYY-WXX format
        expect(row.period).toMatch(/^\d{4}-W\d{2}$/)
      })
    }
  })
  
  it('should use monthly grouping for long date ranges (> 180 days)', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_period', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // If there are rows, they should be grouped by month
    if (data.rows.length > 0) {
      data.rows.forEach((row: any) => {
        expect(row.periodType).toBe('month')
        // Period should be in YYYY-MM format
        expect(row.period).toMatch(/^\d{4}-\d{2}$/)
      })
    }
  })
  
  it('should calculate purchase metrics correctly', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_period', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Verify each row has the required fields
    data.rows.forEach((row: any) => {
      expect(row).toHaveProperty('period')
      expect(row).toHaveProperty('periodType')
      expect(row).toHaveProperty('totalQuantity')
      expect(row).toHaveProperty('totalCost')
      expect(row).toHaveProperty('productCount')
      expect(row).toHaveProperty('supplierCount')
      expect(row).toHaveProperty('movementCount')
      expect(row).toHaveProperty('avgCostPerUnit')
      
      // Verify all values are numbers
      expect(typeof row.totalQuantity).toBe('number')
      expect(typeof row.totalCost).toBe('number')
      expect(typeof row.productCount).toBe('number')
      expect(typeof row.supplierCount).toBe('number')
      expect(typeof row.movementCount).toBe('number')
      expect(typeof row.avgCostPerUnit).toBe('number')
      
      // Verify no NaN or Infinity values
      expect(isNaN(row.totalQuantity)).toBe(false)
      expect(isNaN(row.totalCost)).toBe(false)
      expect(isNaN(row.avgCostPerUnit)).toBe(false)
      expect(isFinite(row.totalQuantity)).toBe(true)
      expect(isFinite(row.totalCost)).toBe(true)
      expect(isFinite(row.avgCostPerUnit)).toBe(true)
      
      // Verify calculation: avgCostPerUnit = totalCost / totalQuantity
      if (row.totalQuantity > 0) {
        const expectedAvgCost = row.totalCost / row.totalQuantity
        expect(row.avgCostPerUnit).toBeCloseTo(expectedAvgCost, 2)
      } else {
        // When quantity is 0, avgCostPerUnit should be 0 (NULLIF prevents division by zero)
        expect(row.avgCostPerUnit).toBe(0)
      }
      
      // Verify all quantities and costs are non-negative
      expect(row.totalQuantity).toBeGreaterThanOrEqual(0)
      expect(row.totalCost).toBeGreaterThanOrEqual(0)
      expect(row.productCount).toBeGreaterThanOrEqual(0)
      expect(row.supplierCount).toBeGreaterThanOrEqual(0)
      expect(row.movementCount).toBeGreaterThanOrEqual(0)
    })
  })
  
  it('should calculate trend correctly', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_period', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Find the Tendencia KPI
    const trendKpi = data.kpis.find((kpi: any) => kpi.label === 'Tendencia')
    expect(trendKpi).toBeDefined()
    expect(trendKpi.format).toBe('percent')
    
    // Trend should be a valid number (can be positive, negative, or zero)
    expect(typeof trendKpi.value).toBe('number')
    expect(isNaN(trendKpi.value)).toBe(false)
    expect(isFinite(trendKpi.value)).toBe(true)
  })
  
  it('should use NULLIF to prevent division by zero', async () => {
    // Test with a date range that might have no purchases
    const filters = {
      start_date: '2020-01-01',
      end_date: '2020-01-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_period', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Even with no purchases, all numeric values should be valid (0, not NaN or Infinity)
    data.kpis.forEach((kpi: any) => {
      expect(typeof kpi.value).toBe('number')
      expect(isNaN(kpi.value)).toBe(false)
      expect(isFinite(kpi.value)).toBe(true)
    })
    
    // If there are rows, verify avgCostPerUnit is 0 when quantity is 0
    data.rows.forEach((row: any) => {
      if (row.totalQuantity === 0) {
        expect(row.avgCostPerUnit).toBe(0)
      }
    })
  })
  
  it('should generate series data for charts', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_period', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(Array.isArray(data.series)).toBe(true)
    
    // Verify we have at least 2 series (cost and quantity)
    expect(data.series.length).toBeGreaterThanOrEqual(2)
    
    // Verify series structure
    data.series.forEach((series: any) => {
      expect(series).toHaveProperty('name')
      expect(series).toHaveProperty('points')
      expect(Array.isArray(series.points)).toBe(true)
      
      // Verify each point has x and y values
      series.points.forEach((point: any) => {
        expect(point).toHaveProperty('x')
        expect(point).toHaveProperty('y')
        expect(typeof point.x).toBe('string')
        expect(typeof point.y).toBe('number')
        expect(isNaN(point.y)).toBe(false)
        expect(isFinite(point.y)).toBe(true)
      })
    })
    
    // Verify we have expected series
    const seriesNames = data.series.map((s: any) => s.name)
    expect(seriesNames).toContain('Costo de Compras por Período')
    expect(seriesNames).toContain('Cantidad Comprada por Período')
  })
  
  it('should respect supplier_id filter', async () => {
    // Get a supplier_id from the database
    const { data: suppliers } = await supabase.from('suppliers').select('id').limit(1)
    
    if (suppliers && suppliers.length > 0) {
      const supplierId = suppliers[0].id
      
      // Get purchases for specific supplier
      const supplierFilters = {
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        supplier_id: supplierId
      }
      
      const { data: supplierData, error: supplierError } = await supabase.rpc('report_purchases_by_period', { 
        filters: supplierFilters 
      })
      
      expect(supplierError).toBeNull()
      expect(supplierData).toBeDefined()
      
      // Supplier-filtered data should have valid structure
      expect(supplierData).toHaveProperty('kpis')
      expect(supplierData).toHaveProperty('rows')
      expect(Array.isArray(supplierData.rows)).toBe(true)
      
      // All rows should have supplierCount of 1 or less (filtered to one supplier)
      supplierData.rows.forEach((row: any) => {
        expect(row.supplierCount).toBeLessThanOrEqual(1)
      })
    }
  })
  
  it('should have correct meta columns definition', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_period', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data.meta).toHaveProperty('columns')
    expect(Array.isArray(data.meta.columns)).toBe(true)
    
    // Verify expected columns
    const columnKeys = data.meta.columns.map((col: any) => col.key)
    expect(columnKeys).toContain('period')
    expect(columnKeys).toContain('periodType')
    expect(columnKeys).toContain('totalQuantity')
    expect(columnKeys).toContain('totalCost')
    expect(columnKeys).toContain('productCount')
    expect(columnKeys).toContain('supplierCount')
    expect(columnKeys).toContain('movementCount')
    expect(columnKeys).toContain('avgCostPerUnit')
    
    // Verify each column has required properties
    data.meta.columns.forEach((col: any) => {
      expect(col).toHaveProperty('key')
      expect(col).toHaveProperty('label')
      expect(col).toHaveProperty('type')
      expect(typeof col.key).toBe('string')
      expect(typeof col.label).toBe('string')
      expect(typeof col.type).toBe('string')
    })
  })
  
  it('should calculate KPIs correctly', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_period', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Extract KPI values
    const totalPeriodsKpi = data.kpis.find((kpi: any) => kpi.label === 'Períodos Analizados')
    const totalQuantityKpi = data.kpis.find((kpi: any) => kpi.label === 'Cantidad Total Comprada')
    const totalCostKpi = data.kpis.find((kpi: any) => kpi.label === 'Costo Total de Compras')
    const avgCostKpi = data.kpis.find((kpi: any) => kpi.label === 'Costo Promedio por Período')
    
    expect(totalPeriodsKpi).toBeDefined()
    expect(totalQuantityKpi).toBeDefined()
    expect(totalCostKpi).toBeDefined()
    expect(avgCostKpi).toBeDefined()
    
    // Verify Períodos Analizados matches row count
    expect(totalPeriodsKpi.value).toBe(data.rows.length)
    
    // Verify Cantidad Total Comprada is sum of all row quantities
    const sumQuantity = data.rows.reduce((sum: number, row: any) => sum + row.totalQuantity, 0)
    expect(totalQuantityKpi.value).toBeCloseTo(sumQuantity, 2)
    
    // Verify Costo Total de Compras is sum of all row costs
    const sumCost = data.rows.reduce((sum: number, row: any) => sum + row.totalCost, 0)
    expect(totalCostKpi.value).toBeCloseTo(sumCost, 2)
    
    // Verify Costo Promedio por Período
    if (data.rows.length > 0) {
      const expectedAvgCost = sumCost / data.rows.length
      expect(avgCostKpi.value).toBeCloseTo(expectedAvgCost, 2)
    } else {
      expect(avgCostKpi.value).toBe(0)
    }
  })
  
  it('should order periods chronologically', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_period', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Verify rows are ordered by period descending (most recent first)
    if (data.rows.length > 1) {
      for (let i = 0; i < data.rows.length - 1; i++) {
        const currentPeriod = data.rows[i].period
        const nextPeriod = data.rows[i + 1].period
        
        // Current period should be >= next period (descending order)
        expect(currentPeriod >= nextPeriod).toBe(true)
      }
    }
    
    // Verify series points are ordered ascending (for chart display)
    data.series.forEach((series: any) => {
      if (series.points.length > 1) {
        for (let i = 0; i < series.points.length - 1; i++) {
          const currentX = series.points[i].x
          const nextX = series.points[i + 1].x
          
          // Points should be in ascending order for time series
          expect(currentX <= nextX).toBe(true)
        }
      }
    })
  })
})
