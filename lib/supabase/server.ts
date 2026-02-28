/**
 * Supabase Client for Server Components and Server Actions
 * 
 * Use this client in Server Components and Server Actions for server-side
 * data fetching and mutations.
 * 
 * @example
 * ```tsx
 * import { createServerClient } from '@/lib/supabase/server'
 * 
 * export async function MyServerComponent() {
 *   const supabase = await createServerClient()
 *   const { data } = await supabase.from('products').select('*')
 *   // ...
 * }
 * ```
 */

import { createServerClient as createClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export async function createServerClient() {
  const cookieStore = await cookies()

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
