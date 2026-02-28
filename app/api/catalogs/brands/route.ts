/**
 * Brands API Route
 * 
 * GET /api/catalogs/brands
 * Returns all brands with LIMIT
 * 
 * Requirements: Performance - LIMIT clause, no bulk loading
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerClient()

    // Query brands with LIMIT (reduced for performance)
    const { data, error } = await supabase
      .from('brands')
      .select('id, name')
      .eq('active', true)
      .order('name')
      .limit(50)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
