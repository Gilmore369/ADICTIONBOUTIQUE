/**
 * Integration Test for analytics.report_sales_summary
 * 
 * Feature: analytics-reports-module
 * Task: 4.8 Implementar `analytics.report_sales_summary`
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * This test verifies that the report_sales_summary function:
 * - Provides a general summary with main KPIs
 * - Calculates total sales, average ticket, and top products sold
 * - Uses NULLIF to prevent division by zero
 * - Returns top 20 best-selling products
 */

import { describe, it, expect } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'

// Skip tests if no Supabase credentials are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const describeIfSupabase = supabaseUrl && supabaseKey ? describe : describe.skip

describeIfSupabase('analytics.report_sales_summary Integration Tests', () => {
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
    
    const { data, error } = await supabase.rpc('report_sales_summary', { filters })
    
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
    expect(kpiLabels).toContain('Ticket Promedio')
    expect(kpiLabels).toContain('Unidades Vendidas')
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
  
  it('should calculate total sales correctly', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_summary', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Find the Total Ventas KPI
    const totalSalesKpi = data.kpis.find((kpi: any) => kpi.label === 'Total Ventas')
    expect(totalSalesKpi).toBeDefined()
    expect(totalSalesKpi.format).toBe('number')
    expect(totalSalesKpi.value).toBeGreaterThanOrEqual(0)
    expect(typeof totalSalesKpi.value).toBe('number')
  })
  
  it('should calculate average ticket using NULLIF', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_summary', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Find the Ticket Promedio KPI
    const avgTicketKpi = data.kpis.find((kpi: any) => kpi.label === 'Ticket Promedio')
    expect(avgTicketKpi).toBeDefined()
    expect(avgTicketKpi.format).toBe('currency')
    expect(typeof avgTicketKpi.value).toBe('number')
    expect(isNaN(avgTicketKpi.value)).toBe(false)
    expect(isFinite(avgTicketKpi.value)).toBe(true)
    expect(avgTicketKpi.value).toBeGreaterThanOrEqual(0)
    
    // Verify calculation: avg_ticket = total_revenue / total_sales
    const totalRevenueKpi = data.kpis.find((kpi: any) => kpi.label === 'Ingresos Totales')
    const totalSalesKpi = data.kpis.find((kpi: any) => kpi.label === 'Total Ventas')
    
    if (totalSalesKpi.value > 0) {
      const expectedAvgTicket = totalRevenueKpi.value / totalSalesKpi.value
      expect(avgTicketKpi.value).toBeCloseTo(expectedAvgTicket, 2)
    } else {
      // When there are no sales, avg_ticket should be 0 (NULLIF prevents division by zero)
      expect(avgTicketKpi.value).toBe(0)
    }
  })
  
  it('should return top 20 best-selling products', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_summary', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(Array.isArray(data.rows)).toBe(true)
    
    // Verify we have at most 20 products
    expect(data.rows.length).toBeLessThanOrEqual(20)
    
    // Verify each row has the required fields
    data.rows.forEach((row: any) => {
      expect(row).toHaveProperty('barcode')
      expect(row).toHaveProperty('name')
      expect(row).toHaveProperty('category')
      expect(row).toHaveProperty('quantitySold')
      expect(row).toHaveProperty('revenue')
      expect(row).toHaveProperty('transactions')
      
      // Verify all values are valid
      expect(typeof row.name).toBe('string')
      expect(typeof row.quantitySold).toBe('number')
      expect(typeof row.revenue).toBe('number')
      expect(typeof row.transactions).toBe('number')
      expect(row.quantitySold).toBeGreaterThan(0)
      expect(row.revenue).toBeGreaterThan(0)
    })
    
    // Verify products are ordered by quantity sold (descending)
    for (let i = 0; i < data.rows.length - 1; i++) {
      expect(data.rows[i].quantitySold).toBeGreaterThanOrEqual(data.rows[i + 1].quantitySold)
    }
  })
  
  it('should calculate gross margin and margin percentage correctly', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_summary', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Find the relevant KPIs
    const totalRevenueKpi = data.kpis.find((kpi: any) => kpi.label === 'Ingresos Totales')
    const grossMarginKpi = data.kpis.find((kpi: any) => kpi.label === 'Ganancia Bruta')
    const marginPctKpi = data.kpis.find((kpi: any) => kpi.label === 'Margen Promedio')
    
    expect(totalRevenueKpi).toBeDefined()
    expect(grossMarginKpi).toBeDefined()
    expect(marginPctKpi).toBeDefined()
    
    // Verify all values are valid numbers
    expect(typeof grossMarginKpi.value).toBe('number')
    expect(typeof marginPctKpi.value).toBe('number')
    expect(isNaN(grossMarginKpi.value)).toBe(false)
    expect(isNaN(marginPctKpi.value)).toBe(false)
    expect(isFinite(grossMarginKpi.value)).toBe(true)
    expect(isFinite(marginPctKpi.value)).toBe(true)
    
    // Verify margin percentage calculation with NULLIF
    if (totalRevenueKpi.value > 0) {
      const expectedMarginPct = (grossMarginKpi.value / totalRevenueKpi.value) * 100
      expect(marginPctKpi.value).toBeCloseTo(expectedMarginPct, 1)
    } else {
      // When revenue is 0, margin_pct should be 0 (NULLIF prevents division by zero)
      expect(marginPctKpi.value).toBe(0)
    }
  })
  
  it('should generate series data for charts', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_summary', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(Array.isArray(data.series)).toBe(true)
    
    // Verify we have 2 series (top products by quantity and by revenue)
    expect(data.series.length).toBe(2)
    
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
        expect(point.y).toBeGreaterThan(0)
      })
    })
    
    // Verify we have the expected series
    const seriesNames = data.series.map((s: any) => s.name)
    expect(seriesNames).toContain('Top 20 Productos Más Vendidos')
    expect(seriesNames).toContain('Top 20 Productos por Ingresos')
  })
  
  it('should respect store_id filter', async () => {
    // Get a store_id from the database
    const { data: stores } = await supabase.from('stores').select('id').limit(1)
    
    if (stores && stores.length > 0) {
      const storeId = stores[0].id
      
      // Get sales summary for specific store
      const storeFilters = {
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        store_id: storeId
      }
      
      const { data: storeData, error: storeError } = await supabase.rpc('report_sales_summary', { 
        filters: storeFilters 
      })
      
      expect(storeError).toBeNull()
      expect(storeData).toBeDefined()
      
      // Store-filtered data should have valid structure
      expect(storeData).toHaveProperty('kpis')
      expect(storeData).toHaveProperty('rows')
      expect(Array.isArray(storeData.rows)).toBe(true)
      
      // All KPIs should be valid numbers
      storeData.kpis.forEach((kpi: any) => {
        expect(typeof kpi.value).toBe('number')
        expect(isNaN(kpi.value)).toBe(false)
        expect(isFinite(kpi.value)).toBe(true)
      })
    }
  })
  
  it('should have correct meta columns definition', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_summary', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data.meta).toHaveProperty('columns')
    expect(Array.isArray(data.meta.columns)).toBe(true)
    
    // Verify expected columns
    const columnKeys = data.meta.columns.map((col: any) => col.key)
    expect(columnKeys).toContain('barcode')
    expect(columnKeys).toContain('name')
    expect(columnKeys).toContain('category')
    expect(columnKeys).toContain('quantitySold')
    expect(columnKeys).toContain('revenue')
    expect(columnKeys).toContain('transactions')
    
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
  
  it('should handle empty date ranges without errors', async () => {
    // Test with a date range that might have no sales
    const filters = {
      start_date: '2020-01-01',
      end_date: '2020-01-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_summary', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Even with no sales, all numeric values should be valid (0, not NaN or Infinity)
    data.kpis.forEach((kpi: any) => {
      expect(typeof kpi.value).toBe('number')
      expect(isNaN(kpi.value)).toBe(false)
      expect(isFinite(kpi.value)).toBe(true)
      expect(kpi.value).toBeGreaterThanOrEqual(0)
    })
    
    // Rows might be empty or have valid data
    expect(Array.isArray(data.rows)).toBe(true)
  })
  
  it('should calculate units sold correctly', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_summary', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Find the Unidades Vendidas KPI
    const unitsKpi = data.kpis.find((kpi: any) => kpi.label === 'Unidades Vendidas')
    expect(unitsKpi).toBeDefined()
    expect(unitsKpi.format).toBe('number')
    expect(typeof unitsKpi.value).toBe('number')
    expect(unitsKpi.value).toBeGreaterThanOrEqual(0)
    
    // Verify units sold equals sum of quantitySold in rows
    if (data.rows.length > 0) {
      const sumQuantitySold = data.rows.reduce((sum: number, row: any) => sum + row.quantitySold, 0)
      // The KPI should be >= sum of top 20 products (there might be more products)
      expect(unitsKpi.value).toBeGreaterThanOrEqual(sumQuantitySold)
    }
  })
})
