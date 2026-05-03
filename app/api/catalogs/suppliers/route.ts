/**
 * Suppliers API Route
 * 
 * GET /api/catalogs/suppliers
 * Returns all suppliers with LIMIT
 * 
 * Requirements: Performance - LIMIT clause, no bulk loading
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerClient()

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
