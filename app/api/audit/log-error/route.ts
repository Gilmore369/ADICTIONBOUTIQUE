import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route: Log Error to Audit Log
 * Logs application errors to audit_log table
 * Requirements: 15.4, 15.5
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Get current user (may be null if error occurred before auth)
    const { data: { user } } = await supabase.auth.getUser()
    
    // Parse error data from request
    const errorData = await request.json()
    
    // Insert error log into audit_log table
    const { error: insertError } = await supabase
      .from('audit_log')
      .insert({
        user_id: user?.id || null,
        operation: 'ERROR',
        entity_type: 'application_error',
        entity_id: null,
        old_values: null,
        new_values: {
          message: errorData.message,
          stack: errorData.stack,
          digest: errorData.digest,
          timestamp: errorData.timestamp,
          user_agent: request.headers.get('user-agent'),
          url: request.headers.get('referer')
        },
        ip_address: request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'
      } as any)
    
    if (insertError) {
      console.error('Failed to insert error log:', insertError)
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in log-error route:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to log error' },
      { status: 500 }
    )
  }
}
