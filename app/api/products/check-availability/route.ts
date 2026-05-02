/**
 * Check Product Availability API Route
 *
 * GET /api/products/check-availability?barcode=...
 * GET /api/products/check-availability?base_code=...&supplier_id=...&size=...&color=...
 * POST /api/products/check-availability  (body: { barcodes: string[] })
 *
 * Permite al frontend verificar SI un producto/variante ya existe ANTES de enviar el form.
 * Devuelve información clara para mostrar al usuario:
 *   - "available": no existe, se puede crear
 *   - "exists": ya existe, devuelve datos del producto existente
 *   - "similar": hay productos parecidos (advertencia)
 *
 * Endpoint creado por la auditoría de productos (Fase 5).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

interface AvailabilityResult {
  status: 'available' | 'exists' | 'similar'
  existing?: {
    id: string
    barcode: string
    name: string
    base_code?: string | null
    size?: string | null
    color?: string | null
  }
  similar?: Array<{
    id: string
    barcode: string
    name: string
  }>
  message: string
}

async function checkSingle(
  supabase: any,
  params: { barcode?: string; base_code?: string; supplier_id?: string; size?: string; color?: string }
): Promise<AvailabilityResult> {
  // 1. Buscar match exacto por barcode (si se proporciona)
  if (params.barcode) {
    const { data: byBarcode } = await supabase
      .from('products')
      .select('id, barcode, name, base_code, size, color')
      .eq('barcode', params.barcode)
      .maybeSingle()

    if (byBarcode) {
      return {
        status: 'exists',
        existing: byBarcode,
        message: `Ya existe un producto con el código "${params.barcode}": ${byBarcode.name}`
      }
    }
  }

  // 2. Buscar match exacto por (base_code + supplier + size + color)
  if (params.base_code && params.supplier_id) {
    const { data: byVariant } = await supabase
      .from('products')
      .select('id, barcode, name, base_code, size, color')
      .eq('base_code', params.base_code)
      .eq('supplier_id', params.supplier_id)
      .eq('size', params.size || null)
      .eq('color', params.color || null)
      .maybeSingle()

    if (byVariant) {
      return {
        status: 'exists',
        existing: byVariant,
        message: `Ya existe esta variante (modelo "${params.base_code}", talla "${params.size || 'sin talla'}", color "${params.color || 'sin color'}")`
      }
    }
  }

  // 3. Buscar productos SIMILARES (mismo base_code o nombre similar) - solo advertencia
  if (params.base_code) {
    const { data: similar } = await supabase
      .from('products')
      .select('id, barcode, name')
      .eq('base_code', params.base_code)
      .limit(5)

    if (similar && similar.length > 0) {
      return {
        status: 'similar',
        similar,
        message: `Hay ${similar.length} producto(s) con el mismo código base "${params.base_code}". Verifica que estés creando una variante distinta.`
      }
    }
  }

  return {
    status: 'available',
    message: 'Disponible para crear'
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const sp = request.nextUrl.searchParams
    const result = await checkSingle(supabase, {
      barcode: sp.get('barcode') || undefined,
      base_code: sp.get('base_code') || undefined,
      supplier_id: sp.get('supplier_id') || undefined,
      size: sp.get('size') || undefined,
      color: sp.get('color') || undefined,
    })

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[check-availability] Error:', error)
    return NextResponse.json(
      { error: 'Error al verificar disponibilidad' },
      { status: 500 }
    )
  }
}

/**
 * POST: chequeo masivo. Recibe array de barcodes y retorna mapa con status de cada uno.
 * Útil para previsualización del ingreso masivo.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const barcodes: string[] = Array.isArray(body.barcodes) ? body.barcodes : []

    if (barcodes.length === 0) {
      return NextResponse.json({ data: {} })
    }

    if (barcodes.length > 500) {
      return NextResponse.json(
        { error: 'Máximo 500 códigos por consulta' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from('products')
      .select('id, barcode, name, base_code, size, color')
      .in('barcode', barcodes)

    // Map<barcode, productData>
    const existingMap: Record<string, any> = {}
    for (const p of existing || []) {
      existingMap[p.barcode] = p
    }

    return NextResponse.json({ data: existingMap })
  } catch (error) {
    console.error('[check-availability POST] Error:', error)
    return NextResponse.json(
      { error: 'Error al verificar disponibilidad masiva' },
      { status: 500 }
    )
  }
}
