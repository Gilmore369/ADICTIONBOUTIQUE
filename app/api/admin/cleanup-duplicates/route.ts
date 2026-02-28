/**
 * Admin API: Cleanup Duplicate Products
 * 
 * Consolidates duplicate products with the same name, size, and color
 * Merges stock from all duplicates into the primary product
 * 
 * POST /api/admin/cleanup-duplicates
 * Body: { supplier_id: string }
 */

import { createServerClient } from '@/lib/supabase/server'
import { checkPermission } from '@/lib/auth/check-permission'
import { Permission } from '@/lib/auth/permissions'
import { NextRequest, NextResponse } from 'next/server'
import { cleanupDuplicateProducts } from '@/lib/db/cleanup-duplicates'

export async function POST(request: NextRequest) {
  try {
    // Check admin permission
    const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      )
    }

    const { supplier_id } = await request.json()

    if (!supplier_id) {
      return NextResponse.json(
        { error: 'supplier_id is required' },
        { status: 400 }
      )
    }

    const result = await cleanupDuplicateProducts(supplier_id)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[cleanup-duplicates] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
