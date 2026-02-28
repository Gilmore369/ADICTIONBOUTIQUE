/**
 * Integration Test for analytics.report_purchases_by_supplier
 * 
 * Feature: analytics-reports-module
 * Task: 6.1 Implementar `analytics.report_purchases_by_supplier`
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 * 
 * This test verifies that the report_purchases_by_supplier function:
 * - Filters movements where type = 'ENTRADA'
 * - Groups by supplier_id
 * - Calculates total_quantity and total_cost
 * - Returns valid Report_Output structure
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'

// Skip tests if no Supabase credentials are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const describeIfSupabase = supabaseUrl && supabaseKey ? describe : describe.skip

describeIfSupabase('analytics.report_purchases_by_supplier Integration Tests', () => {
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
    
    const { data, error } = await supabase.rpc('report_purchases_by_supplier', { filters })
    
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
    expect(kpiLabels).toContain('Total Proveedores')
    expect(kpiLabels).toContain('Cantidad Total Comprada')
    expect(kpiLabels).toContain('Costo Total de Compras')
    expect(kpiLabels).toContain('Costo Promedio por Proveedor')
    
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
  
  it('should filter movements where type = ENTRADA', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_supplier', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Verify that we only get purchase movements (ENTRADA)
    // This is implicit in the function logic, but we can verify the data makes sense
    expect(Array.isArray(data.rows)).toBe(true)
    
    // All rows should have positive quantities (purchases add to inventory)
    data.rows.forEach((row: any) => {
      expect(row.totalQuantity).toBeGreaterThanOrEqual(0)
      expect(row.totalCost).toBeGreaterThanOrEqual(0)
    })
  })
  
  it('should group by supplier_id', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_supplier', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(Array.isArray(data.rows)).toBe(true)
    
    // Verify each row has a supplier name
    data.rows.forEach((row: any) => {
      expect(row).toHaveProperty('supplierName')
      expect(typeof row.supplierName).toBe('string')
    })
    
    // Verify supplier names are unique (grouped by supplier)
    const supplierNames = data.rows.map((row: any) => row.supplierName)
    const uniqueSuppliers = new Set(supplierNames)
    expect(supplierNames.length).toBe(uniqueSuppliers.size)
  })
  
  it('should calculate total_quantity and total_cost correctly', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_supplier', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Verify each row has the required fields
    data.rows.forEach((row: any) => {
      expect(row).toHaveProperty('supplierName')
      expect(row).toHaveProperty('productCount')
      expect(row).toHaveProperty('totalQuantity')
      expect(row).toHaveProperty('totalCost')
      expect(row).toHaveProperty('movementCount')
      expect(row).toHaveProperty('avgCostPerUnit')
      expect(row).toHaveProperty('percentOfTotal')
      
      // Verify all values are numbers
      expect(typeof row.productCount).toBe('number')
      expect(typeof row.totalQuantity).toBe('number')
      expect(typeof row.totalCost).toBe('number')
      expect(typeof row.movementCount).toBe('number')
      expect(typeof row.avgCostPerUnit).toBe('number')
      expect(typeof row.percentOfTotal).toBe('number')
      
      // Verify no NaN or Infinity values
      expect(isNaN(row.totalQuantity)).toBe(false)
      expect(isNaN(row.totalCost)).toBe(false)
      expect(isNaN(row.avgCostPerUnit)).toBe(false)
      expect(isNaN(row.percentOfTotal)).toBe(false)
      expect(isFinite(row.totalQuantity)).toBe(true)
      expect(isFinite(row.totalCost)).toBe(true)
      expect(isFinite(row.avgCostPerUnit)).toBe(true)
      expect(isFinite(row.percentOfTotal)).toBe(true)
      
      // Verify calculation: avgCostPerUnit = totalCost / totalQuantity
      if (row.totalQuantity > 0) {
        const expectedAvgCost = row.totalCost / row.totalQuantity
        expect(row.avgCostPerUnit).toBeCloseTo(expectedAvgCost, 2)
      } else {
        // When quantity is 0, avgCostPerUnit should be 0 (NULLIF prevents division by zero)
        expect(row.avgCostPerUnit).toBe(0)
      }
      
      // Verify percentOfTotal is between 0 and 100
      expect(row.percentOfTotal).toBeGreaterThanOrEqual(0)
      expect(row.percentOfTotal).toBeLessThanOrEqual(100)
    })
  })
  
  it('should use NULLIF to prevent division by zero', async () => {
    // Test with a date range that might have no purchases
    const filters = {
      start_date: '2020-01-01',
      end_date: '2020-01-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_supplier', { filters })
    
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
    
    const { data, error } = await supabase.rpc('report_purchases_by_supplier', { filters })
    
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
    expect(seriesNames).toContain('Costo de Compras por Proveedor')
    expect(seriesNames).toContain('Cantidad Comprada por Proveedor')
  })
  
  it('should respect supplier_id filter', async () => {
    // First, get all purchases
    const allPurchasesFilters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data: allData, error: allError } = await supabase.rpc('report_purchases_by_supplier', { 
      filters: allPurchasesFilters 
    })
    
    expect(allError).toBeNull()
    
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
      
      const { data: supplierData, error: supplierError } = await supabase.rpc('report_purchases_by_supplier', { 
        filters: supplierFilters 
      })
      
      expect(supplierError).toBeNull()
      expect(supplierData).toBeDefined()
      
      // Supplier-filtered data should have valid structure
      expect(supplierData).toHaveProperty('kpis')
      expect(supplierData).toHaveProperty('rows')
      expect(Array.isArray(supplierData.rows)).toBe(true)
      
      // Should have at most 1 row (the filtered supplier)
      expect(supplierData.rows.length).toBeLessThanOrEqual(1)
    }
  })
  
  it('should have correct meta columns definition', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_supplier', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data.meta).toHaveProperty('columns')
    expect(Array.isArray(data.meta.columns)).toBe(true)
    
    // Verify expected columns
    const columnKeys = data.meta.columns.map((col: any) => col.key)
    expect(columnKeys).toContain('supplierName')
    expect(columnKeys).toContain('productCount')
    expect(columnKeys).toContain('totalQuantity')
    expect(columnKeys).toContain('totalCost')
    expect(columnKeys).toContain('movementCount')
    expect(columnKeys).toContain('avgCostPerUnit')
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
  })
  
  it('should calculate KPIs correctly', async () => {
    const filters = {
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
    
    const { data, error } = await supabase.rpc('report_purchases_by_supplier', { filters })
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
    
    // Extract KPI values
    const totalSuppliersKpi = data.kpis.find((kpi: any) => kpi.label === 'Total Proveedores')
    const totalQuantityKpi = data.kpis.find((kpi: any) => kpi.label === 'Cantidad Total Comprada')
    const totalCostKpi = data.kpis.find((kpi: any) => kpi.label === 'Costo Total de Compras')
    const avgCostKpi = data.kpis.find((kpi: any) => kpi.label === 'Costo Promedio por Proveedor')
    
    expect(totalSuppliersKpi).toBeDefined()
    expect(totalQuantityKpi).toBeDefined()
    expect(totalCostKpi).toBeDefined()
    expect(avgCostKpi).toBeDefined()
    
    // Verify Total Proveedores matches row count
    expect(totalSuppliersKpi.value).toBe(data.rows.length)
    
    // Verify Cantidad Total Comprada is sum of all row quantities
    const sumQuantity = data.rows.reduce((sum: number, row: any) => sum + row.totalQuantity, 0)
    expect(totalQuantityKpi.value).toBeCloseTo(sumQuantity, 2)
    
    // Verify Costo Total de Compras is sum of all row costs
    const sumCost = data.rows.reduce((sum: number, row: any) => sum + row.totalCost, 0)
    expect(totalCostKpi.value).toBeCloseTo(sumCost, 2)
    
    // Verify Costo Promedio por Proveedor
    if (data.rows.length > 0) {
      const expectedAvgCost = sumCost / data.rows.length
      expect(avgCostKpi.value).toBeCloseTo(expectedAvgCost, 2)
    } else {
      expect(avgCostKpi.value).toBe(0)
    }
  })
})
