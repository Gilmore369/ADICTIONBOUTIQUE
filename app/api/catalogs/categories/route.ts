import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/catalogs/categories
 * 
 * Fetches all active categories for catalog selection
 */
export async function GET() {
  try {
    const supabase = await createServerClient()

    // Auth gate — catalog data is internal, do not expose to anonymous callers
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error} = await supabase
      .from('categories')
      .select('id, name, line_id')
      .eq('active', true)
      .order('name')
      .limit(50)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
