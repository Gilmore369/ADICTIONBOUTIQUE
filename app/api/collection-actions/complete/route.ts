/**
 * Complete Collection Action API Route
 * 
 * POST /api/collection-actions/complete - Mark a collection action as completed
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { actionId } = body

    // Validate required fields
    if (!actionId) {
      return NextResponse.json(
        { error: 'Missing action ID' },
        { status: 400 }
      )
    }

    // Update collection action to mark as completed
    const { data: collectionAction, error: updateError } = await supabase
      .from('collection_actions')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .select()
      .single()

    if (updateError) {
      console.error('Error completing collection action:', updateError)
      return NextResponse.json(
        { error: 'Failed to complete collection action' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: collectionAction }, { status: 200 })
  } catch (error) {
    console.error('Error in complete collection action API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
