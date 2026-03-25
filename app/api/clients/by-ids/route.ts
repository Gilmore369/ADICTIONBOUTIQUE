/**
 * GET /api/clients/by-ids?ids=uuid1,uuid2,...
 * Returns clients with coordinates for map display
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const idsParam = searchParams.get('ids') || ''
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)

  if (ids.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, phone, address, lat, lng, credit_used, credit_limit')
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
