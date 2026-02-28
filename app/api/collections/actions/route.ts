/**
 * Collection Actions API Route
 * 
 * POST: Create a new collection action
 */

import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    
    const actionData = {
      client_id: formData.get('client_id') as string,
      client_name: formData.get('client_name') as string,
      action_type: formData.get('action_type') as string,
      result: formData.get('result') as string,
      payment_promise_date: formData.get('payment_promise_date') as string | null,
      notes: formData.get('notes') as string | null,
      user_id: user.id
    }

    // Insert collection action
    const { data, error } = await supabase
      .from('collection_actions')
      .insert(actionData)
      .select()
      .single()

    if (error) {
      console.error('Error creating collection action:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in collection actions API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
