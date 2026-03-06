/**
 * Clients with Debt API Route
 * 
 * GET /api/clients/with-debt
 * Returns clients with credit_used > 0 and valid coordinates
 * 
 * Requirements: Performance - LIMIT clause, only necessary data
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Query clients with debt and valid coordinates
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, phone, address, lat, lng, credit_used, credit_limit, client_photo_url')
      .gt('credit_used', 0)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('credit_used', { ascending: false })
      .limit(100)

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
