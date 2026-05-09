/**
 * Deactivate Product Variant API
 *
 * Soft-deletes a single product variant (sets active = false).
 * Used from Carga Masiva when the user spots a legacy/wrong variant
 * (e.g. old "M"/"L" sizes that predate the curated sizes table).
 *
 * PATCH /api/products/deactivate-variant
 * Body: { product_id: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { product_id } = body

    if (!product_id) {
      return NextResponse.json({ error: 'product_id requerido' }, { status: 400 })
    }

    // Use service client so RLS on products doesn't block the update
    const service = createServiceClient()

    // Fetch variant info first so we can return it in the response
    const { data: product, error: fetchErr } = await service
      .from('products')
      .select('id, base_code, name, size, color, active')
      .eq('id', product_id)
      .single()

    if (fetchErr || !product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    if (!product.active) {
      return NextResponse.json({ error: 'El producto ya estaba inactivo' }, { status: 409 })
    }

    const { error: updateErr } = await service
      .from('products')
      .update({ active: false })
      .eq('id', product_id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Audit log
    await service.from('audit_log').insert({
      user_id: user.id,
      operation: 'UPDATE',
      entity_type: 'products',
      entity_id: product_id,
      new_values: { active: false, reason: 'Desactivado manualmente desde Carga Masiva' },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      data: { product_id, name: product.name, size: product.size, color: product.color },
    })
  } catch (e) {
    console.error('[deactivate-variant]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
