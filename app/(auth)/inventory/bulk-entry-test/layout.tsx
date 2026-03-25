/**
 * Layout guard for bulk-entry-test — admin only.
 * This is a dev/test page and must not be accessible by regular users.
 */

import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function BulkEntryTestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single()

  const roles: string[] = ((profile as any)?.roles ?? []).map((r: string) => r.toLowerCase())
  if (!roles.includes('admin')) redirect('/dashboard')

  return <>{children}</>
}
