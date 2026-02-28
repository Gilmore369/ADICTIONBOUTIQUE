/**
 * Next Sale Number API Route
 * 
 * GET /api/sales/next-number
 * Returns the next correlative sale number (V-001, V-002, etc.)
 * 
 * Requirements: Performance - LIMIT clause, correlative numbering
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerClient()

    // Get the last sale number with V- prefix
    const { data: lastSale, error } = await supabase
      .from('sales')
      .select('sale_number')
      .like('sale_number', 'V-%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    let nextNumber = 1

    if (lastSale?.sale_number) {
      // Extract number from format V-001, V-002, etc.
      const match = lastSale.sale_number.match(/V-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }

    // Format with leading zeros (3 digits)
    const formattedNumber = `V-${nextNumber.toString().padStart(3, '0')}`

    return NextResponse.json({
      data: {
        number: formattedNumber,
        next: nextNumber
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
