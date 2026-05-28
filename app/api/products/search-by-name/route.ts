/**
 * Search Products by Base Name API
 * 
 * Busca productos existentes por nombre base, talla, color y proveedor
 * Retorna los datos del modelo para pre-llenar el formulario
 * 
 * Query Parameters:
 * - baseName: Nombre base del producto a buscar
 * - supplier_id: ID del proveedor
 * - size: Talla (opcional)
 * - color: Color (opcional)
 */

import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams

    const baseName = searchParams.get('baseName') || ''
    const supplierId = searchParams.get('supplier_id') || ''
    const size = searchParams.get('size') || ''
    const color = searchParams.get('color') || ''
    
    if (!baseName) {
      return NextResponse.json({ data: [] })
    }

    // Construir query para buscar productos.
    // Se busca en name, base_name, base_code Y barcode (por prefijo) para detectar
    // productos legacy cuyo base_code es NULL pero el barcode empieza con el código buscado.
    let query = supabase
      .from('products')
      .select(`
        id,
        barcode,
        name,
        base_code,
        base_name,
        line_id,
        category_id,
        brand_id,
        supplier_id,
        size,
        color,
        price,
        purchase_price,
        image_url,
        lines:line_id(id, name),
        categories:category_id(id, name),
        brands:brand_id(id, name)
      `)
      .or(
        `name.ilike.%${baseName}%,` +
        `base_name.ilike.%${baseName}%,` +
        `base_code.ilike.%${baseName}%,` +
        `barcode.ilike.%${baseName}%,` + // ← match de código de barras exacto/parcial
        `barcode.ilike.${baseName}-%`    // ← detecta CIN-001-M si buscamos CIN-001
      )
      .eq('active', true)
      .limit(200)

    // Filtrar por proveedor solo si se especifica
    if (supplierId) {
      query = query.eq('supplier_id', supplierId) as typeof query
    }

    if (size) query = query.eq('size', size)
    if (color) query = query.ilike('color', `%${color}%`)

    const { data: products, error } = await query.order('name')

    if (error) {
      console.error('Product search error:', error)
      return NextResponse.json(
        { error: 'Failed to search products', details: error.message },
        { status: 500 }
      )
    }

    // ── Agrupar por base_code (clave canónica) ─────────────────────────────
    // Si base_code es null (productos viejos), intentar derivarlo del barcode
    // (quitando el último segmento separado por guion, ej: CIN-001-M → CIN-001).
    // Si tampoco hay barcode, usar base_name o name como fallback.
    const models = new Map<string, any>()

    if (products) {
      for (const product of products as any[]) {
        const derivedFromBarcode = product.barcode
          ? product.barcode.replace(/-[^-]+$/, '')
          : null
        const groupKey =
          product.base_code ||
          derivedFromBarcode ||
          product.base_name ||
          product.name.split(' - ')[0]

        if (!models.has(groupKey)) {
          models.set(groupKey, {
            baseCode: product.base_code || groupKey,
            baseName: product.base_name || product.name.split(' - ')[0],
            lineId: product.line_id,
            categoryId: product.category_id,
            brandId: product.brand_id,
            brandName: Array.isArray(product.brands) ? product.brands[0]?.name : product.brands?.name,
            supplierId: product.supplier_id,
            imageUrl: product.image_url,
            purchasePrice: product.purchase_price,
            salePrice: product.price,
            // Lista completa de variantes existentes para que el usuario las VEA
            variants: [],
            // Listas únicas para preview rápido
            sizes: new Set<string>(),
            colors: new Set<string>(),
          })
        }

        const model = models.get(groupKey)
        model.variants.push({
          productId: product.id,
          barcode: product.barcode,
          size: product.size,
          color: product.color,
          price: product.price,
          purchase_price: product.purchase_price,
        })
        if (product.size) model.sizes.add(product.size)
        if (product.color) model.colors.add(product.color)
      }
    }

    // Convertir Sets a arrays para JSON
    const result = Array.from(models.values()).map(m => ({
      ...m,
      sizes: Array.from(m.sizes),
      colors: Array.from(m.colors),
    }))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Unexpected error in product search:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
