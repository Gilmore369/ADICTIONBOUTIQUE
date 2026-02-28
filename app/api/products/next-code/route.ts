/**
 * Next Product Code API Route
 * 
 * GET /api/products/next-code?prefix=BLS
 * Returns the next available correlative code for a given prefix
 * 
 * Example: If last code is BLS-005, returns BLS-006
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const prefix = searchParams.get('prefix')

    if (!prefix) {
      return NextResponse.json(
        { error: 'Prefix parameter is required' },
        { status: 400 }
      )
    }

    // Validate prefix format (3 uppercase letters)
    if (!/^[A-Z]{3}$/.test(prefix)) {
      return NextResponse.json(
        { error: 'Prefix must be 3 uppercase letters (e.g., BLS)' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Find the highest number for this prefix
    // Pattern: PREFIX-NNN (e.g., BLS-001, BLS-002)
    const { data: products, error } = await supabase
      .from('products')
      .select('barcode')
      .like('barcode', `${prefix}-%`)
      .order('barcode', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Extract numbers from barcodes and find the maximum
    let maxNumber = 0
    const pattern = new RegExp(`^${prefix}-(\\d{3})`)

    for (const product of products || []) {
      const match = product.barcode.match(pattern)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) {
          maxNumber = num
        }
      }
    }

    // Generate next code
    const nextNumber = maxNumber + 1
    const nextCode = `${prefix}-${nextNumber.toString().padStart(3, '0')}`

    return NextResponse.json({ 
      data: {
        prefix,
        lastNumber: maxNumber,
        nextNumber,
        nextCode
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
