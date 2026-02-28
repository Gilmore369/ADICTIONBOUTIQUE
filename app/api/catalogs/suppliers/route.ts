/**
 * Suppliers API Route
 * 
 * GET /api/catalogs/suppliers
 * Returns all suppliers with LIMIT
 * 
 * Requirements: Performance - LIMIT clause, no bulk loading
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerClient()

    // Query suppliers with LIMIT (reduced for performance)
    const { data, error } = await supabase
      .from('suppliers')
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
