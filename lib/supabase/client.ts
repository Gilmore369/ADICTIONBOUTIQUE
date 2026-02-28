/**
 * Supabase Client for Client Components
 * 
 * Use this client in Client Components (components with 'use client' directive)
 * for client-side data fetching and real-time subscriptions.
 * 
 * @example
 * ```tsx
 * 'use client'
 * 
 * import { createBrowserClient } from '@/lib/supabase/client'
 * 
 * export function MyComponent() {
 *   const supabase = createBrowserClient()
 *   // Use supabase client...
 * }
 * ```
 */

import { createBrowserClient as createClient } from '@supabase/ssr'
import { Database } from '@/types/database'

export function createBrowserClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
