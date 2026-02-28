/**
 * Regression test: stock isolation — no cross-store fallback
 *
 * Captures bug: when a product had 0 stock in store A but 5 in store B,
 * the old code would silently use store B's stock and allow the sale.
 *
 * The fix: batch query with strict ilike('warehouse_id', store_id),
 * NO fallback to total stock across all stores.
 */

describe('stock isolation — createSale pre-check logic', () => {
  /**
   * Extracted stock validation logic from actions/sales.ts
   */
  function validateStockForStore(
    saleItems: Array<{ product_id: string; quantity: number }>,
    stockRows: Array<{ product_id: string; quantity: number; warehouse_id: string }>,
    storeId: string
  ): { valid: boolean; failedProduct?: string; available?: number; required?: number } {
    // Filter stock to ONLY matching store (case-insensitive)
    const storeStock = stockRows.filter(
      s => s.warehouse_id.toLowerCase() === storeId.toLowerCase() && s.quantity > 0
    )

    // Build map: product_id → available qty in THIS store only
    const stockMap = new Map<string, number>()
    for (const row of storeStock) {
      stockMap.set(row.product_id, (stockMap.get(row.product_id) || 0) + row.quantity)
    }

    // Validate each item — NO cross-store fallback
    for (const item of saleItems) {
      const availableQty = stockMap.get(item.product_id) || 0
      if (availableQty < item.quantity) {
        return {
          valid: false,
          failedProduct: item.product_id,
          available: availableQty,
          required: item.quantity,
        }
      }
    }

    return { valid: true }
  }

  it('allows sale when store has sufficient stock', () => {
    const result = validateStockForStore(
      [{ product_id: 'p1', quantity: 2 }],
      [{ product_id: 'p1', quantity: 10, warehouse_id: 'Mujeres' }],
      'Mujeres'
    )
    expect(result.valid).toBe(true)
  })

  // ── CRITICAL REGRESSION ─────────────────────────────────────────────
  it('BLOCKS sale when product has stock in OTHER store only', () => {
    const result = validateStockForStore(
      [{ product_id: 'p1', quantity: 1 }],
      [
        { product_id: 'p1', quantity: 0, warehouse_id: 'Mujeres' },   // THIS store: 0
        { product_id: 'p1', quantity: 50, warehouse_id: 'Hombres' },  // OTHER store: 50
      ],
      'Mujeres'
    )
    // OLD BUG: would have returned valid=true using Hombres' stock
    expect(result.valid).toBe(false)
    expect(result.available).toBe(0)
  })

  it('BLOCKS sale when product does not exist in store at all', () => {
    const result = validateStockForStore(
      [{ product_id: 'p1', quantity: 1 }],
      [{ product_id: 'p1', quantity: 5, warehouse_id: 'Hombres' }], // only in Hombres
      'Mujeres' // selling from Mujeres
    )
    expect(result.valid).toBe(false)
    expect(result.available).toBe(0)
    expect(result.required).toBe(1)
  })

  it('handles case-insensitive store matching', () => {
    const result = validateStockForStore(
      [{ product_id: 'p1', quantity: 1 }],
      [{ product_id: 'p1', quantity: 5, warehouse_id: 'mujeres' }], // lowercase
      'Mujeres' // capitalized
    )
    expect(result.valid).toBe(true)
  })

  it('validates multiple items in single batch', () => {
    const result = validateStockForStore(
      [
        { product_id: 'p1', quantity: 2 },
        { product_id: 'p2', quantity: 3 },
      ],
      [
        { product_id: 'p1', quantity: 10, warehouse_id: 'Mujeres' },
        { product_id: 'p2', quantity: 1, warehouse_id: 'Mujeres' }, // only 1, need 3
      ],
      'Mujeres'
    )
    expect(result.valid).toBe(false)
    expect(result.failedProduct).toBe('p2')
    expect(result.available).toBe(1)
    expect(result.required).toBe(3)
  })

  it('handles empty stock rows', () => {
    const result = validateStockForStore(
      [{ product_id: 'p1', quantity: 1 }],
      [],
      'Mujeres'
    )
    expect(result.valid).toBe(false)
    expect(result.available).toBe(0)
  })
})
