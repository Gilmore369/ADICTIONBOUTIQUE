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
    const searchParams = request.nextUrl.searchParams
    
    const baseName = searchParams.get('baseName') || ''
    const supplierId = searchParams.get('supplier_id') || ''
    const size = searchParams.get('size') || ''
    const color = searchParams.get('color') || ''
    
    if (!baseName || !supplierId) {
      return NextResponse.json({ data: [] })
    }
    
    // Construir query para buscar productos
    let query = supabase
      .from('products')
      .select(`
        id,
        barcode,
        name,
        line_id,
        category_id,
        brand_id,
        size,
        color,
        price,
        purchase_price,
        image_url,
        lines:line_id(id, name),
        categories:category_id(id, name),
        brands:brand_id(id, name)
      `)
      .eq('supplier_id', supplierId)
      .ilike('name', `%${baseName}%`)
      .eq('active', true)
    
    // Filtrar por talla si se proporciona
    if (size) {
      query = query.eq('size', size)
    }
    
    // Filtrar por color si se proporciona
    if (color) {
      query = query.ilike('color', `%${color}%`)
    }
    
    const { data: products, error } = await query.order('name')
    
    if (error) {
      console.error('Product search error:', error)
      return NextResponse.json(
        { error: 'Failed to search products', details: error.message },
        { status: 500 }
      )
    }
    
    // Agrupar por modelo base (nombre sin talla)
    // Usar nombre + color como clave para agrupar productos idénticos con diferentes códigos
    const models = new Map<string, any>()
    
    if (products) {
      products.forEach(product => {
        // Extraer nombre base (sin la talla al final)
        const nameParts = product.name.split(' - ')
        const baseNameKey = nameParts[0] // Nombre sin talla
        
        // Crear clave única: nombre base + color (para agrupar productos idénticos)
        const modelKey = `${baseNameKey}|${product.color || 'sin-color'}`
        
        if (!models.has(modelKey)) {
          models.set(modelKey, {
            baseName: baseNameKey,
            baseCode: product.barcode?.split('-')[0] || '', // Extraer código base del primer producto
            lineId: product.line_id,
            categoryId: product.category_id,
            brandId: product.brand_id,
            color: product.color,
            imageUrl: product.image_url,
            purchasePrice: product.purchase_price,
            salePrice: product.price,
            variants: []
          })
        }
        
        // Agregar variante (talla)
        const model = models.get(modelKey)
        if (product.size) {
          model.variants.push({
            size: product.size,
            color: product.color,
            barcode: product.barcode,
            productId: product.id
          })
        }
      })
    }
    
    return NextResponse.json({ 
      data: Array.from(models.values())
    })
  } catch (error) {
    console.error('Unexpected error in product search:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
