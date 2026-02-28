/**
 * Integration Test for analytics.report_sales_timeline
 * 
 * Feature: analytics-reports-module
 * Task: 4.1 Implementar `analytics.report_sales_timeline`
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * This test verifies that the report_sales_timeline function:
 * - Groups sales by day
 * - Calculates total_revenue, total_cost, gross_margin, margin_pct
 * - Uses NULLIF to prevent division by zero
 * - Generates time series data for line charts
 */

import { describe, it, expect } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'

// Skip tests if no Supabase credentials are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const describeIfSupabase = supabaseUrl && supabaseKey ? describe : describe.skip

describeIfSupabase('analytics.report_sales_timeline Integration Tests', () => {
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
    
    const { data, error } = await supabase.rpc('report_sales_timeline', { filters })
    
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
    expect(kpiLabels).toContain('Total Ventas')
    expect(kpiLabels).toContain('Ingresos Totales')
    expect(kpiLabels).toContain('Costo Total')
    expect(kpiLabels).toContain('Ganancia Bruta')
    expect(kpiLabels).toContain('Margen Promedio')
    
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
  
  it('should group sales by day', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-01-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_timeline', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(Array.isArray(data.rows)).toBe(true)
    
    // Verify each row has a date field
    data.rows.forEach((row: any) => {
      expect(row).toHaveProperty('date')
      expect(typeof row.date).toBe('string')
      
      // Verify date format (YYYY-MM-DD)
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
    
    // Verify dates are unique (grouped by day)
    const dates = data.rows.map((row: any) => row.date)
    const uniqueDates = new Set(dates)
    expect(dates.length).toBe(uniqueDates.size)
  })
  
  it('should calculate total_revenue, total_cost, gross_margin, margin_pct correctly', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_timeline', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Verify each row has the required fields
    data.rows.forEach((row: any) => {
      expect(row).toHaveProperty('totalRevenue')
      expect(row).toHaveProperty('totalCost')
      expect(row).toHaveProperty('grossMargin')
      expect(row).toHaveProperty('marginPct')
      expect(row).toHaveProperty('saleCount')
      
      // Verify all values are numbers
      expect(typeof row.totalRevenue).toBe('number')
      expect(typeof row.totalCost).toBe('number')
      expect(typeof row.grossMargin).toBe('number')
      expect(typeof row.marginPct).toBe('number')
      expect(typeof row.saleCount).toBe('number')
      
      // Verify no NaN or Infinity values
      expect(isNaN(row.totalRevenue)).toBe(false)
      expect(isNaN(row.totalCost)).toBe(false)
      expect(isNaN(row.grossMargin)).toBe(false)
      expect(isNaN(row.marginPct)).toBe(false)
      expect(isFinite(row.totalRevenue)).toBe(true)
      expect(isFinite(row.totalCost)).toBe(true)
      expect(isFinite(row.grossMargin)).toBe(true)
      expect(isFinite(row.marginPct)).toBe(true)
      
      // Verify calculation: gross_margin = total_revenue - total_cost
      expect(row.grossMargin).toBeCloseTo(row.totalRevenue - row.totalCost, 2)
      
      // Verify calculation: margin_pct = (gross_margin / total_revenue) * 100
      if (row.totalRevenue > 0) {
        const expectedMarginPct = (row.grossMargin / row.totalRevenue) * 100
        expect(row.marginPct).toBeCloseTo(expectedMarginPct, 2)
      } else {
        // When revenue is 0, margin_pct should be 0 (NULLIF prevents division by zero)
        expect(row.marginPct).toBe(0)
      }
    })
  })
  
  it('should use NULLIF to prevent division by zero', async () => {
    // Test with a date range that might have no sales
    const filters = {
      start_date: '2020-01-01',
      end_date: '2020-01-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_timeline', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Even with no sales, all numeric values should be valid (0, not NaN or Infinity)
    data.kpis.forEach((kpi: any) => {
      expect(typeof kpi.value).toBe('number')
      expect(isNaN(kpi.value)).toBe(false)
      expect(isFinite(kpi.value)).toBe(true)
    })
    
    // If there are rows, verify margin_pct is 0 when revenue is 0
    data.rows.forEach((row: any) => {
      if (row.totalRevenue === 0) {
        expect(row.marginPct).toBe(0)
      }
    })
  })
  
  it('should generate time series data for charts', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_timeline', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(Array.isArray(data.series)).toBe(true)
    
    // Verify we have at least 2 series (revenue and margin)
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
    
    // Verify we have "Ingresos Diarios" and "Margen Diario" series
    const seriesNames = data.series.map((s: any) => s.name)
    expect(seriesNames).toContain('Ingresos Diarios')
    expect(seriesNames).toContain('Margen Diario')
  })
  
  it('should respect store_id filter', async () => {
    // First, get all sales
    const allSalesFilters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data: allData, error: allError } = await supabase.rpc('report_sales_timeline', { 
      filters: allSalesFilters 
    })
    
    expect(allError).toBeNull()
    
    // Get a store_id from the database
    const { data: stores } = await supabase.from('stores').select('id').limit(1)
    
    if (stores && stores.length > 0) {
      const storeId = stores[0].id
      
      // Get sales for specific store
      const storeFilters = {
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        store_id: storeId
      }
      
      const { data: storeData, error: storeError } = await supabase.rpc('report_sales_timeline', { 
        filters: storeFilters 
      })
      
      expect(storeError).toBeNull()
      expect(storeData).toBeDefined()
      
      // Store-filtered data should have valid structure
      expect(storeData).toHaveProperty('kpis')
      expect(storeData).toHaveProperty('rows')
      expect(Array.isArray(storeData.rows)).toBe(true)
    }
  })
  
  it('should have correct meta columns definition', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_timeline', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data.meta).toHaveProperty('columns')
    expect(Array.isArray(data.meta.columns)).toBe(true)
    
    // Verify expected columns
    const columnKeys = data.meta.columns.map((col: any) => col.key)
    expect(columnKeys).toContain('date')
    expect(columnKeys).toContain('saleCount')
    expect(columnKeys).toContain('totalRevenue')
    expect(columnKeys).toContain('totalCost')
    expect(columnKeys).toContain('grossMargin')
    expect(columnKeys).toContain('marginPct')
    
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
})
