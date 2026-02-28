/**
 * API Route: Get Suppliers by Brand
 * 
 * Returns suppliers that sell a specific brand
 * Used in bulk-entry to filter suppliers based on selected brand
 * 
 * Query params:
 * - brand_id: UUID of the brand
 * 
 * Returns: Array of suppliers that sell the specified brand
 */

import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brandId = searchParams.get('brand_id')

    if (!brandId) {
      return NextResponse.json(
        { error: 'brand_id parameter is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Get suppliers that sell this brand through supplier_brands junction table
    const { data, error } = await supabase
      .from('supplier_brands')
      .select(`
        supplier_id,
        suppliers:supplier_id (
          id,
          name,
          contact_name,
          phone,
          email,
          active
        )
      `)
      .eq('brand_id', brandId)
      .eq('active', true)
      .eq('suppliers.active', true)

    if (error) {
      console.error('[API] Error fetching suppliers by brand:', error)
      return NextResponse.json(
        { error: 'Failed to fetch suppliers', details: error.message },
        { status: 500 }
      )
    }

    // Extract suppliers from the nested structure
    const suppliers = data
      ?.map(item => item.suppliers)
      .filter(Boolean) || []

    return NextResponse.json({
      success: true,
      data: suppliers,
      count: suppliers.length
    })

  } catch (error) {
    console.error('[API] Unexpected error in suppliers/by-brand:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

