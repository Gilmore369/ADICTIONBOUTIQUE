import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const storeId = searchParams.get('store_id')

  const supabase = await createServerClient()
  
  let query = supabase
    .from('lines')
    .select('*')
    .eq('active', true)
  
  // Si hay filtro de tienda, aplicar JOIN con line_stores
  if (storeId) {
    query = supabase
      .from('lines')
      .select(`
        *,
        line_stores!inner(store_id)
      `)
      .eq('active', true)
      .eq('line_stores.store_id', storeId)
  }
  
  const { data, error } = await query.order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
