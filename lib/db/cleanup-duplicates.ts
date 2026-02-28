/**
 * Database Cleanup Script
 * Consolidates duplicate products with the same name, size, and color
 * Merges stock from all duplicates into the primary product
 */

import { createServerClient } from '@/lib/supabase/server'

export async function cleanupDuplicateProducts(supplierId: string) {
  const supabase = await createServerClient()

  try {
    // Get all products for this supplier
    const { data: allProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, barcode, name, size, color, supplier_id')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('[cleanupDuplicates] Fetch error:', fetchError)
      return { success: false, error: fetchError.message }
    }

    if (!allProducts || allProducts.length === 0) {
      return { success: true, message: 'No products found' }
    }

    // Group products by name + size + color
    const groupedByKey = new Map<string, any[]>()

    allProducts.forEach(product => {
      const key = `${product.name}|${product.size || 'null'}|${product.color || 'null'}`
      if (!groupedByKey.has(key)) {
        groupedByKey.set(key, [])
      }
      groupedByKey.get(key)!.push(product)
    })

    let mergedCount = 0
    const results: any[] = []

    // For each group with duplicates
    for (const [key, products] of groupedByKey.entries()) {
      if (products.length > 1) {
        console.log(`[cleanupDuplicates] Found ${products.length} duplicates for: ${key}`)
        
        // Keep the first product as primary
        const primaryProduct = products[0]
        const duplicateProducts = products.slice(1)

        // Get all stock records for all duplicates
        const { data: allStock } = await supabase
          .from('stock')
          .select('id, product_id, warehouse_id, quantity')
          .in('product_id', products.map(p => p.id))

        if (allStock) {
          // Group stock by warehouse
          const stockByWarehouse = new Map<string, number>()

          allStock.forEach(stock => {
            const current = stockByWarehouse.get(stock.warehouse_id) || 0
            stockByWarehouse.set(stock.warehouse_id, current + stock.quantity)
          })

          // Update primary product stock
          for (const [warehouseId, totalQuantity] of stockByWarehouse.entries()) {
            const { data: existingStock } = await supabase
              .from('stock')
              .select('id')
              .eq('product_id', primaryProduct.id)
              .eq('warehouse_id', warehouseId)
              .single()

            if (existingStock) {
              // Update existing stock
              await supabase
                .from('stock')
                .update({ quantity: totalQuantity })
                .eq('product_id', primaryProduct.id)
                .eq('warehouse_id', warehouseId)
            } else {
              // Create new stock record
              await supabase
                .from('stock')
                .insert({
                  product_id: primaryProduct.id,
                  warehouse_id: warehouseId,
                  quantity: totalQuantity
                })
            }
          }

          // Delete stock records for duplicate products
          const duplicateIds = duplicateProducts.map(p => p.id)
          await supabase
            .from('stock')
            .delete()
            .in('product_id', duplicateIds)

          // Update movements to point to primary product
          await supabase
            .from('movements')
            .update({ product_id: primaryProduct.id })
            .in('product_id', duplicateIds)

          // Delete duplicate products
          await supabase
            .from('products')
            .delete()
            .in('id', duplicateIds)

          results.push({
            primary: primaryProduct.barcode,
            merged: duplicateProducts.map(p => p.barcode),
            totalStock: Array.from(stockByWarehouse.values()).reduce((a, b) => a + b, 0)
          })

          mergedCount += duplicateProducts.length
        }
      }
    }

    console.log(`[cleanupDuplicates] Cleanup complete. Merged ${mergedCount} duplicate products.`)
    return { 
      success: true, 
      message: `Merged ${mergedCount} duplicate products`,
      results 
    }
  } catch (error) {
    console.error('[cleanupDuplicates] Unexpected error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
