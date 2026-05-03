/**
 * Next Code Generator API Route
 *
 * GET /api/catalogs/next-code?category_id=xxx[&brand_id=yyy]
 *
 * Formato del código:
 *   - Si hay brand_id:      {MARCA}-{CATEGORIA}-{NUMBER}   ej: NIK-BIL-001
 *   - Si no hay brand_id:   {CATEGORIA}-{NUMBER}           ej: BIL-001
 *
 * El correlativo es por (categoría + prefix), garantizado atómico por la
 * función SQL generate_next_product_code (pg_advisory_xact_lock).
 *
 * Diseño 2026-05-02: incluir la marca lo hace identificable de un vistazo.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Prefijos especiales por categoría (overrides cuando las primeras 3 letras
// son ambiguas o poco descriptivas).
const CATEGORY_PREFIXES: Record<string, string> = {
  'blusas': 'BLS',
  'zapatos': 'ZAP',
  'pantalones': 'PAN',
  'vestidos': 'VES',
  'camisas': 'CAM',
  'faldas': 'FAL',
  'chaquetas': 'CHA',
  'accesorios': 'ACC',
  'billeteras': 'BIL',
  'polos': 'POL',
  'casacas': 'CAS',
  'jeans': 'JEN',
  'shorts': 'SHO',
  'medias': 'MED',
  'gorras': 'GOR',
  'mochilas': 'MOC',
  'cinturones': 'CIN',
  'perfumes': 'PER',
}

/**
 * Extrae un prefijo corto y limpio de un nombre.
 * - Quita tildes
 * - Toma primeras 3 letras alfabéticas
 * - Convierte a mayúsculas
 */
function shortPrefix(name: string, length = 3): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin tildes
    .replace(/[^a-zA-Z]/g, '')                        // solo letras
    .toUpperCase()
    .substring(0, length) || 'XXX'
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const searchParams = request.nextUrl.searchParams
    const categoryId = searchParams.get('category_id')
    const brandId    = searchParams.get('brand_id')  // OPCIONAL

    if (!categoryId) {
      return NextResponse.json(
        { error: 'category_id is required' },
        { status: 400 }
      )
    }

    // 1. Cargar categoría y marca (si fue provista)
    const [categoryRes, brandRes] = await Promise.all([
      supabase.from('categories').select('name').eq('id', categoryId).single(),
      brandId
        ? supabase.from('brands').select('name').eq('id', brandId).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ])

    if (categoryRes.error || !categoryRes.data) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    const category = categoryRes.data
    const brand = brandRes?.data

    // 2. Calcular prefijo de categoría (con override + fallback a primeras 3 letras)
    const categoryNameLower = category.name.toLowerCase()
    let categoryPrefix = ''

    for (const [key, value] of Object.entries(CATEGORY_PREFIXES)) {
      if (categoryNameLower.includes(key)) { categoryPrefix = value; break }
    }
    if (!categoryPrefix) categoryPrefix = shortPrefix(category.name, 3)

    // 3. Construir prefix final: con o sin marca
    //    Con marca:    NIK-BIL  (Nike Billetera)
    //    Sin marca:    BIL
    const brandPrefix = brand?.name ? shortPrefix(brand.name, 3) : null
    const prefix = brandPrefix ? `${brandPrefix}-${categoryPrefix}` : categoryPrefix

    // 4. Generar el siguiente código de forma ATÓMICA usando función SQL.
    // Esto evita race conditions cuando dos usuarios crean productos simultáneos.
    const { data: nextCode, error: rpcError } = await supabase.rpc(
      'generate_next_product_code',
      { p_category_id: categoryId, p_prefix: prefix }
    )

    if (rpcError || !nextCode) {
      return NextResponse.json(
        { error: rpcError?.message || 'No se pudo generar el código' },
        { status: 500 }
      )
    }

    // Extraer número del código generado para mantener compatibilidad con frontend
    const numberMatch = String(nextCode).match(/-(\d+)$/)
    const nextNumber = numberMatch ? parseInt(numberMatch[1], 10) : 1

    return NextResponse.json({
      data: {
        prefix,
        number: nextNumber,
        code: nextCode,
        category: category.name
      }
    })
  } catch (error) {
    console.error('Error generating next code:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
