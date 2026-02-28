/**
 * All Clients API Route
 *
 * GET /api/clients/all
 * Returns ALL active clients with valid coordinates.
 * Used for "Activación" routing — visiting clients who don't yet have
 * credit or have never purchased, to offer products or credit plans.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('clients')
      .select('id, name, phone, address, lat, lng, credit_used, credit_limit, rating')
      .eq('active', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('name', { ascending: true })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
