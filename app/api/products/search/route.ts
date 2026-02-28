/**
 * Product Search API Route
 * 
 * Provides product search functionality with full-text search using ILIKE
 * and gin_trgm_ops index for performance.
 * 
 * Query Parameters:
 * - q: Search query (searches in name and barcode)
 * - limit: Maximum results (default: 50, max: 50)
 * 
 * Requirements: 4.3, 9.3
 * Task: 8.5 Create product search API route
 * 
 * @example
 * GET /api/products/search?q=camisa&limit=20
 */

import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const searchParams = request.nextUrl.searchParams
    
    // Get query parameter
    const query = searchParams.get('q') || ''
    
    // Get warehouse parameter (default Tienda Mujeres)
    const warehouse = searchParams.get('warehouse') || 'Tienda Mujeres'
    
    // Get limit parameter (default 50, max 50 enforced)
    const limitParam = searchParams.get('limit')
    const requestedLimit = limitParam ? Number(limitParam) : 50
    const limit = Math.min(Math.max(requestedLimit, 1), 50) // Enforce LIMIT 50 max
    
    // If query is empty, return empty results
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ data: [] })
    }
    
    // Search products by name (ILIKE) or exact barcode match
    // The gin_trgm_ops index on products.name will optimize the ILIKE search
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        barcode,
        name,
        description,
        size,
        color,
        price,
        min_stock,
        active,
        lines:line_id (
          id,
          name
        ),
        categories:category_id (
          id,
          name
        ),
        brands:brand_id (
          id,
          name
        )
      `)
      .or(`name.ilike.%${query}%,barcode.eq.${query}`)
      .eq('active', true)
      .limit(limit)
      .order('name')
    
    if (error) {
      console.error('Product search error:', error)
      return NextResponse.json(
        { error: 'Failed to search products', details: error.message },
        { status: 500 }
      )
    }

    // Get stock for each product from the specified warehouse.
    // stock.warehouse_id is a TEXT field ('Tienda Mujeres' or 'Tienda Hombres').
    // Use case-insensitive match to be robust against casing differences.
    // Only fetch rows with quantity > 0 — products without stock in this
    // store are excluded from results (strict store isolation).
    const { data: stockData } = await supabase
      .from('stock')
      .select('product_id, quantity')
      .ilike('warehouse_id', warehouse)
      .gt('quantity', 0)

    // Build product_id → quantity map for the selected warehouse
    const stockMap = new Map<string, number>()
    if (stockData) {
      stockData.forEach(s => {
        const current = stockMap.get(s.product_id) || 0
        stockMap.set(s.product_id, current + s.quantity)
      })
    }

    // Return only products that have stock in the selected warehouse
    const data = (products || [])
      .filter(product => stockMap.has(product.id))
      .map(product => ({
        ...product,
        stock: { quantity: stockMap.get(product.id) || 0 }
      }))
    
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Unexpected error in product search:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
