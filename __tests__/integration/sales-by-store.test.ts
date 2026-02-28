/**
 * Integration Test for analytics.report_sales_by_store
 * 
 * Feature: analytics-reports-module
 * Task: 4.9 Implementar `analytics.report_sales_by_store`
 * 
 * **Validates: Requirements 3.7, 18.1, 18.2**
 * 
 * This test verifies that the report_sales_by_store function:
 * - Groups sales data by store_id
 * - Enables performance comparison between stores
 * - Calculates metrics per store (revenue, cost, profit, margin, avg_ticket, unique_clients)
 * - Uses NULLIF to prevent division by zero
 * - Returns proper Report_Output structure
 */

import { describe, it, expect } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'

// Skip tests if no Supabase credentials are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const describeIfSupabase = supabaseUrl && supabaseKey ? describe : describe.skip

describeIfSupabase('analytics.report_sales_by_store Integration Tests', () => {
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
    
    const { data, error } = await supabase.rpc('report_sales_by_store', { filters })
    
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
    expect(kpiLabels).toContain('Total Tiendas')
    expect(kpiLabels).toContain('Total Ventas')
    expect(kpiLabels).toContain('Ingresos Totales')
    expect(kpiLabels).toContain('Costo Total')
    expect(kpiLabels).toContain('Ganancia Total')
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
  
  it('should group sales by store_id', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_by_store', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(Array.isArray(data.rows)).toBe(true)
    
    // Verify each row has store_id and is unique
    const storeIds = new Set()
    data.rows.forEach((row: any) => {
      expect(row).toHaveProperty('storeId')
      expect(typeof row.storeId).toBe('string')
      
      // Verify no duplicate store_ids
      expect(storeIds.has(row.storeId)).toBe(false)
      storeIds.add(row.storeId)
    })
    
    // Verify Total Tiendas KPI matches number of rows
    const totalStoresKpi = data.kpis.find((kpi: any) => kpi.label === 'Total Tiendas')
    expect(totalStoresKpi).toBeDefined()
    expect(totalStoresKpi.value).toBe(data.rows.length)
  })
  
  it('should calculate metrics per store correctly', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_by_store', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Verify each row has all required fields
    data.rows.forEach((row: any) => {
      expect(row).toHaveProperty('storeId')
      expect(row).toHaveProperty('saleCount')
      expect(row).toHaveProperty('quantitySold')
      expect(row).toHaveProperty('revenue')
      expect(row).toHaveProperty('cost')
      expect(row).toHaveProperty('profit')
      expect(row).toHaveProperty('marginPct')
      expect(row).toHaveProperty('avgTicket')
      expect(row).toHaveProperty('uniqueClients')
      expect(row).toHaveProperty('percentOfTotal')
      
      // Verify all numeric values are valid
      expect(typeof row.saleCount).toBe('number')
      expect(typeof row.quantitySold).toBe('number')
      expect(typeof row.revenue).toBe('number')
      expect(typeof row.cost).toBe('number')
      expect(typeof row.profit).toBe('number')
      expect(typeof row.marginPct).toBe('number')
      expect(typeof row.avgTicket).toBe('number')
      expect(typeof row.uniqueClients).toBe('number')
      expect(typeof row.percentOfTotal).toBe('number')
      
      // Verify no NaN or Infinity values
      expect(isNaN(row.revenue)).toBe(false)
      expect(isNaN(row.cost)).toBe(false)
      expect(isNaN(row.profit)).toBe(false)
      expect(isNaN(row.marginPct)).toBe(false)
      expect(isNaN(row.avgTicket)).toBe(false)
      expect(isNaN(row.percentOfTotal)).toBe(false)
      expect(isFinite(row.revenue)).toBe(true)
      expect(isFinite(row.cost)).toBe(true)
      expect(isFinite(row.profit)).toBe(true)
      expect(isFinite(row.marginPct)).toBe(true)
      expect(isFinite(row.avgTicket)).toBe(true)
      expect(isFinite(row.percentOfTotal)).toBe(true)
      
      // Verify profit calculation
      expect(row.profit).toBeCloseTo(row.revenue - row.cost, 2)
      
      // Verify margin percentage calculation with NULLIF
      if (row.revenue > 0) {
        const expectedMarginPct = ((row.revenue - row.cost) / row.revenue) * 100
        expect(row.marginPct).toBeCloseTo(expectedMarginPct, 2)
      } else {
        expect(row.marginPct).toBe(0)
      }
      
      // Verify avg ticket calculation with NULLIF
      if (row.saleCount > 0) {
        const expectedAvgTicket = row.revenue / row.saleCount
        expect(row.avgTicket).toBeCloseTo(expectedAvgTicket, 2)
      } else {
        expect(row.avgTicket).toBe(0)
      }
    })
  })
  
  it('should calculate percentage of total correctly', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_by_store', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Calculate total revenue from all stores
    const totalRevenue = data.rows.reduce((sum: number, row: any) => sum + row.revenue, 0)
    
    // Verify each store's percentage of total
    data.rows.forEach((row: any) => {
      if (totalRevenue > 0) {
        const expectedPercentage = (row.revenue / totalRevenue) * 100
        expect(row.percentOfTotal).toBeCloseTo(expectedPercentage, 2)
      } else {
        expect(row.percentOfTotal).toBe(0)
      }
    })
    
    // Verify sum of all percentages equals 100 (or 0 if no revenue)
    const sumPercentages = data.rows.reduce((sum: number, row: any) => sum + row.percentOfTotal, 0)
    if (totalRevenue > 0) {
      expect(sumPercentages).toBeCloseTo(100, 1)
    } else {
      expect(sumPercentages).toBe(0)
    }
  })
  
  it('should enable performance comparison between stores', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_by_store', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Verify rows are ordered by revenue descending (for comparison)
    for (let i = 0; i < data.rows.length - 1; i++) {
      expect(data.rows[i].revenue).toBeGreaterThanOrEqual(data.rows[i + 1].revenue)
    }
    
    // Verify series data for comparison charts
    expect(Array.isArray(data.series)).toBe(true)
    expect(data.series.length).toBe(2)
    
    // Verify series names
    const seriesNames = data.series.map((s: any) => s.name)
    expect(seriesNames).toContain('Ingresos por Tienda')
    expect(seriesNames).toContain('Ganancia por Tienda')
    
    // Verify series data structure
    data.series.forEach((series: any) => {
      expect(series).toHaveProperty('name')
      expect(series).toHaveProperty('points')
      expect(Array.isArray(series.points)).toBe(true)
      
      series.points.forEach((point: any) => {
        expect(point).toHaveProperty('x')
        expect(point).toHaveProperty('y')
        expect(typeof point.x).toBe('string')
        expect(typeof point.y).toBe('number')
        expect(isNaN(point.y)).toBe(false)
        expect(isFinite(point.y)).toBe(true)
      })
    })
  })
  
  it('should use NULLIF to prevent division by zero', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_by_store', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Verify all calculated fields handle zero denominators correctly
    data.rows.forEach((row: any) => {
      // margin_pct should be 0 when revenue is 0
      if (row.revenue === 0) {
        expect(row.marginPct).toBe(0)
      }
      
      // avg_ticket should be 0 when sale_count is 0
      if (row.saleCount === 0) {
        expect(row.avgTicket).toBe(0)
      }
      
      // percent_of_total should be 0 when total revenue is 0
      // (verified in previous test)
      
      // All values should be finite numbers, never NaN or Infinity
      expect(isNaN(row.marginPct)).toBe(false)
      expect(isNaN(row.avgTicket)).toBe(false)
      expect(isNaN(row.percentOfTotal)).toBe(false)
      expect(isFinite(row.marginPct)).toBe(true)
      expect(isFinite(row.avgTicket)).toBe(true)
      expect(isFinite(row.percentOfTotal)).toBe(true)
    })
  })
  
  it('should calculate aggregate KPIs correctly', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_by_store', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Calculate expected totals from rows
    const expectedTotalSales = data.rows.reduce((sum: number, row: any) => sum + row.saleCount, 0)
    const expectedTotalRevenue = data.rows.reduce((sum: number, row: any) => sum + row.revenue, 0)
    const expectedTotalCost = data.rows.reduce((sum: number, row: any) => sum + row.cost, 0)
    const expectedTotalProfit = data.rows.reduce((sum: number, row: any) => sum + row.profit, 0)
    
    // Verify KPIs match calculated totals
    const totalSalesKpi = data.kpis.find((kpi: any) => kpi.label === 'Total Ventas')
    const totalRevenueKpi = data.kpis.find((kpi: any) => kpi.label === 'Ingresos Totales')
    const totalCostKpi = data.kpis.find((kpi: any) => kpi.label === 'Costo Total')
    const totalProfitKpi = data.kpis.find((kpi: any) => kpi.label === 'Ganancia Total')
    
    expect(totalSalesKpi.value).toBeCloseTo(expectedTotalSales, 0)
    expect(totalRevenueKpi.value).toBeCloseTo(expectedTotalRevenue, 2)
    expect(totalCostKpi.value).toBeCloseTo(expectedTotalCost, 2)
    expect(totalProfitKpi.value).toBeCloseTo(expectedTotalProfit, 2)
    
    // Verify average margin
    const avgMarginKpi = data.kpis.find((kpi: any) => kpi.label === 'Margen Promedio')
    if (data.rows.length > 0) {
      const expectedAvgMargin = data.rows.reduce((sum: number, row: any) => sum + row.marginPct, 0) / data.rows.length
      expect(avgMarginKpi.value).toBeCloseTo(expectedAvgMargin, 2)
    } else {
      expect(avgMarginKpi.value).toBe(0)
    }
  })
  
  it('should respect store_id filter', async () => {
    // First get all stores
    const allFilters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data: allData, error: allError } = await supabase.rpc('report_sales_by_store', { 
      filters: allFilters 
    })
    
    expect(allError).toBeNull()
    expect(allData).toBeDefined()
    
    if (allData.rows.length > 0) {
      // Get data for specific store
      const specificStoreId = allData.rows[0].storeId
      const storeFilters = {
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        store_id: specificStoreId
      }
      
      const { data: storeData, error: storeError } = await supabase.rpc('report_sales_by_store', { 
        filters: storeFilters 
      })
      
      expect(storeError).toBeNull()
      expect(storeData).toBeDefined()
      
      // Should only have one store in results
      expect(storeData.rows.length).toBe(1)
      expect(storeData.rows[0].storeId).toBe(specificStoreId)
      
      // Verify metrics match the specific store from all data
      expect(storeData.rows[0].revenue).toBeCloseTo(allData.rows[0].revenue, 2)
      expect(storeData.rows[0].saleCount).toBe(allData.rows[0].saleCount)
    }
  })
  
  it('should have correct meta columns definition', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_by_store', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data.meta).toHaveProperty('columns')
    expect(Array.isArray(data.meta.columns)).toBe(true)
    
    // Verify expected columns
    const columnKeys = data.meta.columns.map((col: any) => col.key)
    expect(columnKeys).toContain('storeId')
    expect(columnKeys).toContain('saleCount')
    expect(columnKeys).toContain('quantitySold')
    expect(columnKeys).toContain('revenue')
    expect(columnKeys).toContain('cost')
    expect(columnKeys).toContain('profit')
    expect(columnKeys).toContain('marginPct')
    expect(columnKeys).toContain('avgTicket')
    expect(columnKeys).toContain('uniqueClients')
    expect(columnKeys).toContain('percentOfTotal')
    
    // Verify each column has required properties
    data.meta.columns.forEach((col: any) => {
      expect(col).toHaveProperty('key')
      expect(col).toHaveProperty('label')
      expect(col).toHaveProperty('type')
      expect(typeof col.key).toBe('string')
      expect(typeof col.label).toBe('string')
      expect(typeof col.type).toBe('string')
    })
    
    // Verify column types are correct
    const storeIdCol = data.meta.columns.find((col: any) => col.key === 'storeId')
    const revenueCol = data.meta.columns.find((col: any) => col.key === 'revenue')
    const marginPctCol = data.meta.columns.find((col: any) => col.key === 'marginPct')
    
    expect(storeIdCol.type).toBe('string')
    expect(revenueCol.type).toBe('currency')
    expect(marginPctCol.type).toBe('percent')
  })
  
  it('should handle empty date ranges without errors', async () => {
    // Test with a date range that might have no sales
    const filters = {
      start_date: '2020-01-01',
      end_date: '2020-01-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_by_store', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Even with no sales, all numeric values should be valid (0, not NaN or Infinity)
    data.kpis.forEach((kpi: any) => {
      expect(typeof kpi.value).toBe('number')
      expect(isNaN(kpi.value)).toBe(false)
      expect(isFinite(kpi.value)).toBe(true)
      expect(kpi.value).toBeGreaterThanOrEqual(0)
    })
    
    // Rows might be empty
    expect(Array.isArray(data.rows)).toBe(true)
  })
  
  it('should track unique clients per store', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_sales_by_store', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Verify unique clients field exists and is valid
    data.rows.forEach((row: any) => {
      expect(row).toHaveProperty('uniqueClients')
      expect(typeof row.uniqueClients).toBe('number')
      expect(row.uniqueClients).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(row.uniqueClients)).toBe(true)
      
      // Unique clients should not exceed sale count
      expect(row.uniqueClients).toBeLessThanOrEqual(row.saleCount)
    })
  })
})
