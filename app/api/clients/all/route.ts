import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAllowedStoreNames, getAllowedClientIds } from '@/lib/utils/store-filter'

export async function GET() {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Store filter — for activation view, also scope to store's clients
    const allowedStoreNames = await getAllowedStoreNames(supabase)
    let clientIdFilter: string[] | null = null
    if (allowedStoreNames) {
      clientIdFilter = await getAllowedClientIds(supabase, allowedStoreNames)
    }

    let query = supabase
      .from('clients')
      .select('id, name, phone, address, lat, lng, credit_used, credit_limit, rating, client_photo_url')
      .eq('active', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('name', { ascending: true })
      .limit(200)

    if (clientIdFilter !== null) {
      if (clientIdFilter.length === 0) return NextResponse.json({ data: [] })
      query = query.in('id', clientIdFilter) as typeof query
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
