import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Store code is required' }, { status: 400 })
  }

  const supabase = await createServerClient()
  
  const { data, error } = await supabase
    .from('stores')
    .select('id, code, name')
    .eq('code', code)
    .eq('active', true)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
