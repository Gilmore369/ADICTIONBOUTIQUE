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

    // Auth gate — catalog data is internal, do not expose to anonymous callers
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
