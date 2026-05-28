/**
 * Brands API Route
 *
 * GET /api/catalogs/brands
 *   - sin params  → todas las marcas activas (ordenadas por nombre)
 *   - ?supplier_id=UUID → solo las marcas asociadas a ese proveedor
 *     (vía supplier_brands M2M). Usado al crear productos para filtrar
 *     las marcas que comercializa el proveedor seleccionado.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Auth gate — catalog data is internal, do not expose to anonymous callers
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supplierId = request.nextUrl.searchParams.get('supplier_id')

    // ── Filtrado por proveedor (supplier_brands) ──────────────────────────────
    if (supplierId) {
      const { data, error } = await supabase
        .from('supplier_brands')
        .select('brand_id, brands!inner(id, name, active)')
        .eq('supplier_id', supplierId)
        .eq('active', true)
        .eq('brands.active', true)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const brands = (data || [])
        .map((row: any) => {
          const b = Array.isArray(row.brands) ? row.brands[0] : row.brands
          return b ? { id: b.id, name: b.name } : null
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.name.localeCompare(b.name))

      return NextResponse.json({ data: brands })
    }

    // ── Todas las marcas activas (sin límite — hay ~400) ──────────────────────
    const { data, error } = await supabase
      .from('brands')
      .select('id, name')
      .eq('active', true)
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
