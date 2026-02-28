/**
 * Supabase Service Role Client
 *
 * Use ONLY on the server (API routes, Server Actions) for operations that
 * require elevated permissions: Storage bucket management, admin queries, etc.
 *
 * NEVER import this in client components or expose to the browser.
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Returns a Supabase client that uses the service_role key.
 * Falls back to null if the key is not configured.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.warn('[createServiceClient] SUPABASE_SERVICE_ROLE_KEY is not set')
    return null
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
