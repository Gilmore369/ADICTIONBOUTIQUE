/**
 * Suppliers API Route
 * 
 * GET /api/catalogs/suppliers
 * Returns all suppliers with LIMIT
 * 
 * Requirements: Performance - LIMIT clause, no bulk loading
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Auth gate — supplier list is internal data
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Trae todos los proveedores activos con RUC (la UI usa SearchableSelect
    // con búsqueda local, así que cargar 1000 ítems es OK).
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name, ruc')
      .eq('active', true)
      .order('name')
      .limit(1000)

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
