/**
 * User Profile API
 * 
 * PATCH /api/users/profile
 * Updates user profile information
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    // Validate input
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }

    // Update user profile
    const { data, error } = await supabase
      .from('users')
      .update({ 
        name: name.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('[users/profile] Error updating profile:', error)
      return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        name: data.name,
        email: data.email,
        profile_photo_url: data.profile_photo_url
      }
    })

  } catch (error) {
    console.error('[users/profile] Unexpected error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}