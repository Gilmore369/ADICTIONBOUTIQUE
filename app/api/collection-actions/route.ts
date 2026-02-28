/**
 * Collection Actions API Route
 * 
 * POST /api/collection-actions - Create a new collection action
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
    const { clientId, action_type, result, description, follow_up_date } = body

    // Validate required fields
    if (!clientId || !action_type || !result || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get client name
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    // Create collection action
    const { data: collectionAction, error: insertError } = await supabase
      .from('collection_actions')
      .insert({
        client_id: clientId,
        client_name: client.name,
        action_type,
        result,
        notes: description,
        payment_promise_date: follow_up_date || null,
        user_id: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating collection action:', insertError)
      return NextResponse.json(
        { error: 'Failed to create collection action', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: collectionAction }, { status: 201 })
  } catch (error) {
    console.error('Error in collection actions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
