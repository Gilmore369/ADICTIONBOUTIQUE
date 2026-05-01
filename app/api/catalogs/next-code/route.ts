/**
 * Next Code Generator API Route
 * 
 * GET /api/catalogs/next-code?category_id=xxx
 * Genera el siguiente código correlativo para una categoría
 * 
 * Formato: {PREFIX}-{NUMBER}
 * Ejemplo: BLS-001, BLS-002, ZAP-001, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Prefijos por categoría (puedes ajustar según tus necesidades)
const CATEGORY_PREFIXES: Record<string, string> = {
  // Estos son ejemplos, ajusta según tus categorías reales
  'blusas': 'BLS',
  'zapatos': 'ZAP',
  'pantalones': 'PAN',
  'vestidos': 'VES',
  'camisas': 'CAM',
  'faldas': 'FAL',
  'chaquetas': 'CHA',
  'accesorios': 'ACC',
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const searchParams = request.nextUrl.searchParams
    const categoryId = searchParams.get('category_id')

    if (!categoryId) {
      return NextResponse.json(
        { error: 'category_id is required' },
        { status: 400 }
      )
    }

    // 1. Get category name to determine prefix
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('name')
      .eq('id', categoryId)
      .single()

    if (categoryError || !category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // 2. Determine prefix based on category name
    const categoryNameLower = category.name.toLowerCase()
    let prefix = 'PRD' // Default prefix

    // Try to match category name with predefined prefixes
    for (const [key, value] of Object.entries(CATEGORY_PREFIXES)) {
      if (categoryNameLower.includes(key)) {
        prefix = value
        break
      }
    }

    // If no match, use first 3 letters of category name
    if (prefix === 'PRD' && category.name.length >= 3) {
      prefix = category.name.substring(0, 3).toUpperCase()
    }

    // 3. Generar el siguiente código de forma ATÓMICA usando función SQL.
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
