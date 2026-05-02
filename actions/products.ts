/**
 * Products Server Actions
 * 
 * Server actions for product operations including:
 * - Bulk product creation with stock
 * - Product updates
 * - Product deletion
 * 
 * Requirements: 3.2, 3.3, 9.7
 */

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkPermission } from '@/lib/auth/check-permission'
import { Permission } from '@/lib/auth/permissions'
import { getTodayPeru } from '@/lib/utils/timezone'
import { translateProductError } from '@/lib/errors/product-errors'

/**
 * Standard response type for server actions
 */
type ActionResponse<T = any> = {
  success: boolean
  data?: T
  error?: string | Record<string, string[]>
}

interface BulkProductInput {
  barcode: string
  name: string
  base_code?: string   // Código base del modelo (ej: "CHA"), compartido por todas las tallas
  base_name?: string   // Nombre base del modelo (ej: "Chaleco Army"), sin sufijo de talla
  description?: string
  line_id: string
  category_id: string
  brand_id?: string
  supplier_id?: string
  size?: string
  color?: string
  presentation?: string
  image_url?: string | null
  purchase_price: number
  price: number
  min_stock?: number
  quantity: number
  warehouse_id: string
}

/**
 * Modo de actualización para productos que ya existen en la BD.
 *
 * - INCREMENT (default): suma la cantidad al stock existente. Comportamiento histórico.
 * - REPLACE: reemplaza el stock con la cantidad nueva (ajuste). Requiere reason.
 * - SKIP: no toca productos existentes, solo crea los nuevos.
 * - UPDATE_ONLY: actualiza precios/datos pero NO toca el stock.
 */
export type BulkUpdateMode = 'INCREMENT' | 'REPLACE' | 'SKIP' | 'UPDATE_ONLY'

interface BulkOptions {
  mode?: BulkUpdateMode
  reason?: string  // Obligatorio si mode === 'REPLACE'
}

/**
 * Creates or updates multiple products with stock
 * 
 * Process:
 * 1. Validate input
 * 2. Check MANAGE_PRODUCTS permission
 * 3. For each product:
 *    - Check if product exists by barcode
 *    - If exists: Update stock
 *    - If not exists: Create new product and stock
 * 4. Insert movements in batch
 * 5. Revalidate paths
 * 
 * Requirements: 3.2, 3.3, 9.7
 * 
 * @param products - Array of products to create or update with stock
 * @returns ActionResponse with created/updated product count or error
 */
export async function createBulkProducts(
  products: BulkProductInput[],
  options: BulkOptions = {}
): Promise<ActionResponse> {
  const mode: BulkUpdateMode = options.mode || 'INCREMENT'

  // Validar que REPLACE tenga motivo
  if (mode === 'REPLACE' && (!options.reason || options.reason.trim().length < 5)) {
    return {
      success: false,
      error: 'El modo "Reemplazar stock" requiere un motivo de al menos 5 caracteres (ej: "Conteo físico inventario abril")'
    }
  }

  // 1. Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Get authenticated user
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized: User not authenticated' }
  }

  // 2. Validate input
  if (!products || products.length === 0) {
    return { success: false, error: 'No products provided' }
  }

  // Validate each product
  for (const product of products) {
    if (!product.barcode || !product.name || !product.line_id ||
        !product.category_id ||
        !product.warehouse_id || product.quantity < 0) {
      return { 
        success: false, 
        error: `Invalid product data: ${product.name || 'unnamed'}` 
      }
    }
  }

  // 3. Validate supplier-brand relationships (no auto-create - require explicit setup)
  const uniqueBrandSupplierPairs = new Set(
    products.map(p => `${p.brand_id}:${p.supplier_id}`)
  )

  const missingRelationships: string[] = []
  for (const pair of uniqueBrandSupplierPairs) {
    const [brandId, supplierId] = pair.split(':')
    if (!brandId || !supplierId) continue

    const { data: relationship } = await supabase
      .from('supplier_brands')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('brand_id', brandId)
      .maybeSingle()

    if (!relationship) {
      missingRelationships.push(pair)
    }
  }

  if (missingRelationships.length > 0) {
    // Get names for clearer error message
    const [firstBrand, firstSupplier] = missingRelationships[0].split(':')
    const { data: brand } = await supabase.from('brands').select('name').eq('id', firstBrand).maybeSingle()
    const { data: supplier } = await supabase.from('suppliers').select('name').eq('id', firstSupplier).maybeSingle()
    return {
      success: false,
      error: `La marca "${brand?.name || firstBrand}" no está asociada al proveedor "${supplier?.name || firstSupplier}". Asocia la marca al proveedor en Catálogos > Proveedores antes de continuar.`
    }
  }

  // 3.1 Pre-check: detectar duplicados INTRA-lote (mismo barcode en el lote)
  const seenBarcodes = new Map<string, number>()
  for (let i = 0; i < products.length; i++) {
    const bc = products[i].barcode
    if (seenBarcodes.has(bc)) {
      return {
        success: false,
        error: `El código "${bc}" está repetido en este lote (filas ${seenBarcodes.get(bc)! + 1} y ${i + 1}). Cada código debe ser único.`
      }
    }
    seenBarcodes.set(bc, i)
  }

  // 3.2 Pre-check: detectar duplicados intra-lote por (base_code + size + color)
  // Dos modelos con mismo base_code+size+color son la misma variante con códigos distintos = bug
  const seenVariants = new Map<string, number>()
  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    if (!p.base_code) continue
    const variantKey = `${p.base_code}|${p.size || ''}|${p.color || ''}`
    if (seenVariants.has(variantKey)) {
      return {
        success: false,
        error: `Variante duplicada en el lote: modelo "${p.base_code}", talla "${p.size || 'sin talla'}", color "${p.color || 'sin color'}" aparece en filas ${seenVariants.get(variantKey)! + 1} y ${i + 1}.`
      }
    }
    seenVariants.set(variantKey, i)
  }

  try {
    let createdCount = 0
    let updatedCount = 0
    const createdProductIds: string[] = []
    const movementsToInsert: any[] = []

    // Process each product
    for (const product of products) {
      // First, try to find by exact barcode (most reliable)
      // Barcode should be globally unique
      let { data: barcodeResults, error: barcodeError } = await supabase
        .from('products')
        .select('id')
        .eq('barcode', product.barcode)
        .limit(1)
      
      let existingProduct = barcodeResults && barcodeResults.length > 0 ? barcodeResults[0] : null

      // Si no se encontró por barcode, buscar por (base_code + supplier + size + color) EXACTO
      // NO usar ILIKE en name — eso matchea productos similares y actualiza el incorrecto.
      // La identidad de una variante es: (base_code, supplier_id, size, color) exactos.
      if (!existingProduct && product.base_code && product.supplier_id) {
        const { data: variantResults, error: variantError } = await supabase
          .from('products')
          .select('id')
          .eq('base_code', product.base_code)
          .eq('supplier_id', product.supplier_id)
          .eq('size', product.size || null)
          .eq('color', product.color || null)
          .limit(1)

        if (variantResults && variantResults.length > 0) {
          existingProduct = variantResults[0]
        } else if (variantError) {
          console.error('[createBulkProducts] Error en búsqueda por variante exacta:', variantError)
        }
      }

      if (existingProduct) {
        // Producto existe — aplicar el MODO seleccionado por el usuario
        if (mode === 'SKIP') {
          // Modo SKIP: no tocar productos existentes
          updatedCount++  // contar como "procesado pero omitido"
          continue
        }

        // Buscar registro de stock para este almacén
        const { data: existingStock } = await supabase
          .from('stock')
          .select('id, quantity')
          .eq('product_id', existingProduct.id)
          .eq('warehouse_id', product.warehouse_id)
          .maybeSingle()

        const stockAnterior = existingStock?.quantity ?? 0
        let stockNuevo = stockAnterior
        let movementType: 'ENTRADA' | 'AJUSTE' = 'ENTRADA'
        let movementQty = 0
        let movementRef = ''

        if (mode === 'UPDATE_ONLY') {
          // No tocar stock, solo seguir con actualización de precios más abajo
          // (el flujo actual no actualiza precios automáticamente; queda como TODO)
        } else if (mode === 'REPLACE') {
          stockNuevo = product.quantity
          movementType = 'AJUSTE'
          movementQty = stockNuevo - stockAnterior
          movementRef = `Reemplazo masivo: ${options.reason}`
        } else {
          // INCREMENT (default)
          stockNuevo = stockAnterior + product.quantity
          movementType = 'ENTRADA'
          movementQty = product.quantity
          movementRef = `Compra al contado - Restock`
        }

        if (mode !== 'UPDATE_ONLY') {
          if (existingStock) {
            const { error: updateError } = await supabase
              .from('stock')
              .update({ quantity: stockNuevo })
              .eq('product_id', existingProduct.id)
              .eq('warehouse_id', product.warehouse_id)

            if (updateError) {
              return {
                success: false,
                error: `No se pudo actualizar el stock de "${product.name}": ${updateError.message}`
              }
            }
          } else {
            const { error: insertError } = await supabase
              .from('stock')
              .insert({
                warehouse_id: product.warehouse_id,
                product_id: existingProduct.id,
                quantity: stockNuevo
              })

            if (insertError) {
              return {
                success: false,
                error: `No se pudo crear el registro de stock para "${product.name}": ${insertError.message}`
              }
            }
          }

          // Movimiento de auditoría (siempre, salvo que la cantidad sea 0)
          if (movementQty !== 0) {
            movementsToInsert.push({
              warehouse_id: product.warehouse_id,
              product_id: existingProduct.id,
              type: movementType,
              quantity: Math.abs(movementQty),
              reference: movementRef,
              user_id: user.id
            })
          }
        }

        updatedCount++
      } else {
        // Product doesn't exist - create new
        console.log('[createBulkProducts] Creating new product:', product.barcode)
        
        const { data: createdProduct, error: productError } = await supabase
          .from('products')
          .insert({
            barcode: product.barcode,
            name: product.name,
            base_code: product.base_code || null,
            base_name: product.base_name || null,
            description: product.description || null,
            line_id: product.line_id,
            category_id: product.category_id,
            brand_id: product.brand_id || null,
            supplier_id: product.supplier_id || null,
            size: product.size || null,
            color: product.color || null,
            presentation: product.presentation || 'Unidad',
            image_url: product.image_url || null,
            purchase_price: product.purchase_price,
            price: product.price,
            min_stock: product.min_stock || 5,
            entry_date: getTodayPeru(),
            active: true
          })
          .select('id')
          .single()

        if (productError) {
          console.error('[createBulkProducts] Product insert error:', productError)
          return {
            success: false,
            error: `No se pudo crear "${product.name}": ${translateProductError(productError, { barcode: product.barcode, name: product.name })}`
          }
        }

        if (!createdProduct) {
          return { success: false, error: 'Failed to create product' }
        }

        createdProductIds.push(createdProduct.id)

        // Create stock record
        const { error: stockError } = await supabase
          .from('stock')
          .insert({
            warehouse_id: product.warehouse_id,
            product_id: createdProduct.id,
            quantity: product.quantity
          })

        if (stockError) {
          console.error('[createBulkProducts] Stock insert error:', stockError)
          // Rollback: eliminar el producto recién creado para no dejarlo huérfano
          await supabase
            .from('products')
            .delete()
            .eq('id', createdProduct.id)

          return {
            success: false,
            error: `No se pudo crear el stock de "${product.name}": ${translateProductError(stockError, { name: product.name })}. El producto fue revertido.`
          }
        }

        // Add movement record
        if (product.quantity > 0) {
          movementsToInsert.push({
            warehouse_id: product.warehouse_id,
            product_id: createdProduct.id,
            type: 'ENTRADA',
            quantity: product.quantity,
            notes: `Compra al contado - Ingreso inicial`,
            user_id: user.id
          })
        }

        createdCount++
      }
    }

    // Insertar movimientos — OBLIGATORIO para auditoría de stock.
    // Si esto falla, la operación se considera fallida (el stock cambió sin trazabilidad).
    if (movementsToInsert.length > 0) {
      const { error: movementsError } = await supabase
        .from('movements')
        .insert(movementsToInsert)

      if (movementsError) {
        console.error('[createBulkProducts] Movements insert error:', movementsError)
        return {
          success: false,
          error: `Stock guardado pero falló el registro de movimientos de auditoría: ${movementsError.message}. Contacta al administrador para reconciliar.`
        }
      }
    }

    // Revalidate paths to update UI
    revalidatePath('/catalogs/products')
    revalidatePath('/inventory/stock')
    revalidatePath('/inventory/bulk-entry')
    revalidatePath('/api/products/search', 'page')

    console.log('[createBulkProducts] Success:', {
      productsCreated: createdCount,
      productsUpdated: updatedCount,
      movementsCreated: movementsToInsert.length
    })

    return { 
      success: true, 
      data: { 
        count: createdCount + updatedCount,
        created: createdCount,
        updated: updatedCount,
        products: createdProductIds
      } 
    }
  } catch (error) {
    console.error('[createBulkProducts] Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('[createBulkProducts] Error stack:', errorStack)
    
    return { 
      success: false, 
      error: `Failed to create bulk products: ${errorMessage}` 
    }
  }
}

/**
 * Restock existing products
 * 
 * Updates stock for existing products and creates movement records
 * 
 * @param restockItems - Array of product IDs with quantities to restock
 * @returns ActionResponse with restocked product count or error
 */
export async function restockProducts(
  restockItems: Array<{
    product_id: string
    warehouse_id: string
    quantity: number
  }>
): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Get authenticated user
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized: User not authenticated' }
  }

  if (!restockItems || restockItems.length === 0) {
    return { success: false, error: 'No restock items provided' }
  }

  try {
    let restockedCount = 0

    // Process each restock item
    for (const item of restockItems) {
      // Check if stock record exists
      const { data: existingStock } = await supabase
        .from('stock')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .eq('warehouse_id', item.warehouse_id)
        .single()

      if (existingStock) {
        // Update existing stock
        const { error: updateError } = await supabase
          .from('stock')
          .update({ quantity: existingStock.quantity + item.quantity })
          .eq('product_id', item.product_id)
          .eq('warehouse_id', item.warehouse_id)

        if (updateError) {
          console.error('[restockProducts] Stock update error:', updateError)
          return { 
            success: false, 
            error: `Failed to update stock: ${updateError.message}` 
          }
        }
      } else {
        // Create new stock record if it doesn't exist
        const { error: insertError } = await supabase
          .from('stock')
          .insert({
            product_id: item.product_id,
            warehouse_id: item.warehouse_id,
            quantity: item.quantity
          })

        if (insertError) {
          console.error('[restockProducts] Stock insert error:', insertError)
          return { 
            success: false, 
            error: `Failed to create stock: ${insertError.message}` 
          }
        }
      }

      // Create movement record
      const { error: movementError } = await supabase
        .from('movements')
        .insert({
          product_id: item.product_id,
          warehouse_id: item.warehouse_id,
          type: 'IN',
          quantity: item.quantity,
          notes: 'Reabastecimiento masivo',
          user_id: user.id
        })

      if (movementError) {
        console.error('[restockProducts] Movement insert error:', movementError)
        // Don't fail, movements are optional
      }

      restockedCount++
    }

    // Revalidate paths
    revalidatePath('/catalogs/products')
    revalidatePath('/inventory/stock')
    revalidatePath('/inventory/bulk-entry')

    return { 
      success: true, 
      data: { 
        count: restockedCount
      } 
    }
  } catch (error) {
    console.error('[restockProducts] Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return { 
      success: false, 
      error: `Failed to restock products: ${errorMessage}` 
    }
  }
}