/**
 * Sizes API Route
 * 
 * GET /api/catalogs/sizes?category_id=X
 * Returns sizes for a specific category with LIMIT
 * 
 * Requirements: Performance - LIMIT clause, no bulk loading
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('category_id')

    if (!categoryId) {
      return NextResponse.json(
        { error: 'category_id is required' },
        { status: 400 }
      )
    }

    // Query sizes for category with LIMIT
    const { data, error } = await supabase
      .from('sizes')
      .select('id, name, category_id')
      .eq('category_id', categoryId)
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
