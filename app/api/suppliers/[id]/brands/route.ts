/**
 * API Route: Get Brands for Supplier
 * 
 * Returns all brands associated with a specific supplier
 * Supports multibrand suppliers through supplier_brands junction table
 */

import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id: supplierId } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!supplierId || !uuidRegex.test(supplierId)) {
      console.error('[API] Invalid supplier ID:', supplierId)
      return NextResponse.json(
        { success: false, error: 'Invalid supplier ID format' },
        { status: 400 }
      )
    }

    console.log('[API] Fetching brands for supplier:', supplierId)

    // Get brands for this supplier through junction table
    const { data, error } = await supabase
      .from('supplier_brands')
      .select(`
        brand_id,
        brands:brand_id (
          id,
          name,
          description,
          active
        )
      `)
      .eq('supplier_id', supplierId)

    if (error) {
      console.error('[API] Error fetching supplier brands:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Extract brands from nested structure
    const brands = data
      ?.map(item => item.brands)
      .filter(brand => brand && brand.active)
      .filter((brand, index, self) => 
        // Remove duplicates by id
        index === self.findIndex(b => b?.id === brand?.id)
      ) || []

    console.log('[API] Found brands:', brands.length)

    return NextResponse.json({
      success: true,
      data: brands
    })
  } catch (error) {
    console.error('[API] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
