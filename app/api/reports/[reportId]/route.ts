/**
 * API Route Handler for Analytics Reports
 * 
 * Handles POST requests to generate analytics reports by calling
 * the corresponding RPC function in the analytics schema.
 * 
 * @route POST /api/reports/[reportId]
 * @param reportId - The ID of the report to generate
 * @body filters - Optional filters to apply to the report
 * 
 * @returns Report_Output structure with kpis, series, rows, and meta
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 22.1, 22.2, 22.3, 24.1, 24.2, 24.3, 24.4, 24.5
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { ReportFilters, REPORT_CONFIGS } from '@/lib/reports/report-types'
import { z } from 'zod'

// Validation schema for filters using Zod
const FiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  storeId: z.string().optional(),
  warehouseId: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  minStock: z.number().int().positive().optional(),
  maxStock: z.number().int().positive().optional(),
  clientId: z.string().uuid().optional(),
  warehouse: z.string().optional()
})

// List of valid report IDs
const VALID_REPORT_IDS = Object.keys(REPORT_CONFIGS)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const startTime = Date.now()

  try {
    // 1. Authentication - Verify user is authenticated
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 2. Validate reportId against list of valid reports
    const { reportId } = await params
    
    if (!VALID_REPORT_IDS.includes(reportId)) {
      return NextResponse.json(
        { error: 'Invalid report ID', validReports: VALID_REPORT_IDS },
        { status: 400 }
      )
    }
    
    // 3. Parse and validate filters with Zod schema
    const body = await request.json()
    const filtersResult = FiltersSchema.safeParse(body.filters || {})
    
    if (!filtersResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid filters', 
          details: filtersResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }
    
    const filters = filtersResult.data
    
    // 4. Validate date range (start_date < end_date)
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate)
      const end = new Date(filters.endDate)
      
      if (start > end) {
        return NextResponse.json(
          { error: 'Start date must be before end date' },
          { status: 400 }
        )
      }
    }
    
    // 5. Convert reportId to RPC function name
    const reportConfig = REPORT_CONFIGS[reportId]
    const rpcFunction = reportConfig.rpcFunction
    
    // 6. Prepare filters in JSONB format for RPC call
    const jsonFilters = {
      start_date: filters.startDate,
      end_date: filters.endDate,
      store_id: filters.storeId,
      warehouse_id: filters.warehouseId || filters.warehouse,
      category_id: filters.categoryId,
      product_id: filters.productId,
      brand_id: filters.brandId,
      supplier_id: filters.supplierId,
      min_stock: filters.minStock,
      max_stock: filters.maxStock,
      client_id: filters.clientId
    }
    
    // Remove undefined values
    Object.keys(jsonFilters).forEach(key => {
      if (jsonFilters[key as keyof typeof jsonFilters] === undefined) {
        delete jsonFilters[key as keyof typeof jsonFilters]
      }
    })
    
    // 7. Call RPC function with filters
    const { data, error } = await supabase.rpc(rpcFunction as any, { 
      filters: jsonFilters 
    } as any)
    
    // 8. Handle errors and return appropriate HTTP codes
    if (error) {
      console.error('RPC Error:', {
        function: rpcFunction,
        error: error.message,
        details: error.details,
        hint: error.hint
      })
      
      // Log error in analytics.report_executions table
      await supabase
        .schema('analytics')
        .from('report_executions')
        .insert({
          report_id: reportId,
          user_id: user.id,
          filters: jsonFilters,
          execution_time_ms: Date.now() - startTime,
          error_message: error.message
        })
        .select()
        .single()
      
      return NextResponse.json(
        { 
          error: 'Database error', 
          details: error.message,
          hint: error.hint
        },
        { status: 500 }
      )
    }
    
    // 9. Log successful execution in analytics.report_executions
    const executionTime = Date.now() - startTime
    
    await supabase
      .schema('analytics')
      .from('report_executions')
      .insert({
        report_id: reportId,
        user_id: user.id,
        filters: jsonFilters,
        execution_time_ms: executionTime
      })
      .select()
      .single()
    
    // 10. Return result with appropriate cache headers
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=300', // 5 minutes cache
        'X-Execution-Time': executionTime.toString(),
        'X-Report-Id': reportId
      }
    })
    
  } catch (error) {
    console.error('Unexpected error in report API:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
