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
  brand_id: string
  supplier_id: string
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
  products: BulkProductInput[]
): Promise<ActionResponse> {
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
        !product.category_id || !product.brand_id || !product.supplier_id ||
        !product.warehouse_id || product.quantity < 0) {
      return { 
        success: false, 
        error: `Invalid product data: ${product.name || 'unnamed'}` 
      }
    }
  }

  // 3. Validate supplier-brand relationships
  const uniqueBrandSupplierPairs = new Set(
    products.map(p => `${p.brand_id}:${p.supplier_id}`)
  )

  for (const pair of uniqueBrandSupplierPairs) {
    const [brandId, supplierId] = pair.split(':')
    
    const { data: relationship, error: relationError } = await supabase
      .from('supplier_brands')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('brand_id', brandId)
      .single()

    if (relationError || !relationship) {
      // Get brand and supplier names for better error message
      const { data: brand } = await supabase
        .from('brands')
        .select('name')
        .eq('id', brandId)
        .single()
      
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('name')
        .eq('id', supplierId)
        .single()

      return {
        success: false,
        error: `El proveedor "${supplier?.name || 'desconocido'}" no vende la marca "${brand?.name || 'desconocida'}". Por favor verifica la relación proveedor-marca.`
      }
    }
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

      // If not found by barcode, search by name + size + color + supplier
      // This handles cases where the same product has multiple different codes
      if (!existingProduct) {
        console.log('[createBulkProducts] Barcode not found, searching by name+size+color:', {
          name: product.name,
          size: product.size,
          color: product.color,
          supplier_id: product.supplier_id
        })
        
        const baseNameMatch = product.name.match(/^([^-]+)/)
        const baseName = baseNameMatch ? baseNameMatch[1].trim() : product.name
        
        const { data: nameResults, error: nameError } = await supabase
          .from('products')
          .select('id')
          .eq('supplier_id', product.supplier_id)
          .ilike('name', `%${baseName}%`)
          .eq('size', product.size || null)
          .eq('color', product.color || null)
          .limit(1)
        
        if (nameResults && nameResults.length > 0) {
          console.log('[createBulkProducts] Found by name+size+color:', nameResults[0].id)
          existingProduct = nameResults[0]
        } else if (nameError) {
          console.error('[createBulkProducts] Error searching by name+size+color:', nameError)
        }
      }

      if (existingProduct) {
        // Product exists - update stock
        console.log('[createBulkProducts] Product exists, updating stock:', product.name, product.size, product.color)
        
        // Check if stock record exists for this warehouse
        const { data: existingStock } = await supabase
          .from('stock')
          .select('id, quantity')
          .eq('product_id', existingProduct.id)
          .eq('warehouse_id', product.warehouse_id)
          .single()

        if (existingStock) {
          // Update existing stock
          const newQuantity = existingStock.quantity + product.quantity
          const { error: updateError } = await supabase
            .from('stock')
            .update({ quantity: newQuantity })
            .eq('product_id', existingProduct.id)
            .eq('warehouse_id', product.warehouse_id)

          if (updateError) {
            console.error('[createBulkProducts] Stock update error:', updateError)
            return {
              success: false,
              error: `Failed to update stock for ${product.name}: ${updateError.message}`
            }
          }
        } else {
          // Create new stock record for this warehouse
          const { error: insertError } = await supabase
            .from('stock')
            .insert({
              warehouse_id: product.warehouse_id,
              product_id: existingProduct.id,
              quantity: product.quantity
            })

          if (insertError) {
            console.error('[createBulkProducts] Stock insert error:', insertError)
            return {
              success: false,
              error: `Failed to create stock for ${product.name}: ${insertError.message}`
            }
          }
        }

        // Add movement record
        if (product.quantity > 0) {
          movementsToInsert.push({
            warehouse_id: product.warehouse_id,
            product_id: existingProduct.id,
            type: 'ENTRADA',
            quantity: product.quantity,
            reference: `Compra al contado - Restock`,
            user_id: user.id
          })
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
            brand_id: product.brand_id,
            supplier_id: product.supplier_id,
            size: product.size || null,
            color: product.color || null,
            presentation: product.presentation || 'Unidad',
            image_url: product.image_url || null,
            purchase_price: product.purchase_price,
            price: product.price,
            min_stock: product.min_stock || 5,
            entry_date: new Date().toISOString().split('T')[0],
            active: true
          })
          .select('id')
          .single()

        if (productError) {
          console.error('[createBulkProducts] Product insert error:', productError)
          return {
            success: false,
            error: `Failed to create product ${product.name}: ${productError.message}`
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
          // Rollback: delete created product
          await supabase
            .from('products')
            .delete()
            .eq('id', createdProduct.id)
          
          return {
            success: false,
            error: `Failed to create stock for ${product.name}: ${stockError.message}`
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

    // Insert all movements at once
    if (movementsToInsert.length > 0) {
      console.log('[createBulkProducts] Inserting movements:', movementsToInsert.length)
      
      const { error: movementsError } = await supabase
        .from('movements')
        .insert(movementsToInsert)

      if (movementsError) {
        console.error('[createBulkProducts] Movements insert error:', movementsError)
        // Don't rollback, movements are optional
      } else {
        console.log('[createBulkProducts] Movements created successfully')
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