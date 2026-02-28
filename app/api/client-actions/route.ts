/**
 * Client Actions API Route
 * 
 * POST /api/client-actions - Create a new client action log
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { ActionType } from '@/lib/types/crm'

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
    const { clientId, action_type, description } = body

    // Validate required fields
    if (!clientId || !action_type || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate action type
    const validActionTypes = Object.values(ActionType)
    if (!validActionTypes.includes(action_type)) {
      return NextResponse.json(
        { error: 'Invalid action type' },
        { status: 400 }
      )
    }

    // Create action log
    const { data: actionLog, error: insertError } = await supabase
      .from('client_action_logs')
      .insert({
        client_id: clientId,
        action_type,
        description,
        user_id: user.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating action log:', insertError)
      return NextResponse.json(
        { error: 'Failed to create action log' },
        { status: 500 }
      )
    }

    // If action type is REACTIVACION, update client status
    if (action_type === ActionType.REACTIVACION) {
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          active: true,
          deactivation_reason: null,
          deactivated_at: null,
          deactivated_by: null,
        })
        .eq('id', clientId)

      if (updateError) {
        console.error('Error reactivating client:', updateError)
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({ data: actionLog }, { status: 201 })
  } catch (error) {
    console.error('Error in client actions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
