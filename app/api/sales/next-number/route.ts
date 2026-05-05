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

/**
 * Returns a *preview* of what the next sale number will look like.
 *
 * IMPORTANT: this endpoint does NOT reserve a number. The actual sale number
 * is allocated atomically inside `createSale` by calling the
 * `generate_sale_number()` RPC, which uses a Postgres SEQUENCE and is
 * race-condition-free.
 *
 * The previous implementation read the last sale and added 1 here — two
 * concurrent POSes could read the same value and both try to insert the
 * same sale_number, with the second one crashing on the UNIQUE constraint.
 * We now show the same correlative the BD would produce next, but we don't
 * mutate state, so racing is harmless.
 */
export async function GET() {
  try {
    const supabase = await createServerClient()

    // Auth gate — preview is internal info
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Read the current sequence value WITHOUT advancing it (last_value + 1).
    // last_value reflects the most recent nextval(); the actual next call
    // returns last_value + 1 in steady state.
    const { data: seqRow, error: seqErr } = await supabase
      .rpc('peek_sale_number_seq')

    let nextNumber = 1
    if (!seqErr && typeof seqRow === 'number') {
      nextNumber = Number(seqRow) + 1
    } else {
      // Fallback for envs where the helper RPC isn't installed yet — show
      // the largest existing V-#### number + 1. Still preview-only.
      const { data: latest } = await supabase
        .from('sales')
        .select('sale_number')
        .like('sale_number', 'V-%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (latest?.sale_number) {
        const m = latest.sale_number.match(/V-(\d+)/)
        if (m) nextNumber = parseInt(m[1], 10) + 1
      }
    }

    const formattedNumber = `V-${nextNumber.toString().padStart(4, '0')}`

    return NextResponse.json({
      data: {
        number: formattedNumber,
        next: nextNumber,
        // Hint for the client: this is a preview, not a reservation.
        preview: true,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
