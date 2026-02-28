/**
 * Client Search API Route
 * 
 * Provides client search functionality with full-text search using ILIKE
 * and gin_trgm_ops index for performance.
 * 
 * Query Parameters:
 * - q: Search query (searches in name and DNI)
 * - limit: Maximum results (default: 50, max: 50)
 * 
 * Requirements: 4.3
 * Task: 9.3 Create client search API route
 * 
 * @example
 * GET /api/clients/search?q=juan&limit=20
 * GET /api/clients/search?q=12345678&limit=50
 */

import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const searchParams = request.nextUrl.searchParams
    
    // Get query parameter
    const query = searchParams.get('q') || ''
    
    // Get limit parameter (default 50, max 50 enforced)
    const limitParam = searchParams.get('limit')
    const requestedLimit = limitParam ? Number(limitParam) : 50
    const limit = Math.min(Math.max(requestedLimit, 1), 50) // Enforce LIMIT 50 max
    
    // If query is empty, return empty results
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ data: [] })
    }
    
    // Search clients by name (ILIKE) or exact DNI match
    // The gin_trgm_ops index on clients.name will optimize the ILIKE search
    const { data, error } = await supabase
      .from('clients')
      .select(`
        id,
        dni,
        name,
        phone,
        email,
        address,
        lat,
        lng,
        credit_limit,
        credit_used,
        active
      `)
      .or(`name.ilike.%${query}%,dni.eq.${query}`)
      .eq('active', true)
      .limit(limit)
      .order('name')
    
    if (error) {
      console.error('Client search error:', error)
      return NextResponse.json(
        { error: 'Failed to search clients', details: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Unexpected error in client search:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
