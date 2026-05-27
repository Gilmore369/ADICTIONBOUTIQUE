import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAllowedStoreNames, getAllowedClientIds } from '@/lib/utils/store-filter'
import { fetchAllRows } from '@/lib/supabase/paginate'

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Store filter — respeta selección de tienda del UI y restricciones del perfil
    const { searchParams } = new URL(request.url)
    const requestedStore = searchParams.get('store')
    const allowedStoreNames = await getAllowedStoreNames(supabase, requestedStore)
    let clientIdFilter: string[] | null = null
    if (allowedStoreNames) {
      clientIdFilter = await getAllowedClientIds(supabase, allowedStoreNames)
    }

    if (clientIdFilter !== null && clientIdFilter.length === 0) {
      return NextResponse.json({ data: [] })
    }
    const data = await fetchAllRows<any>((from, to) => {
      let q = supabase
        .from('clients')
        .select('id, name, phone, address, lat, lng, credit_used, credit_limit, client_photo_url')
        .gt('credit_used', 0)
        .order('credit_used', { ascending: false })
        .range(from, to)
      if (clientIdFilter !== null) q = q.in('id', clientIdFilter) as typeof q
      return q
    })

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
