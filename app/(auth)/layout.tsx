/**
 * Authenticated Layout
 * 
 * Layout for authenticated pages with sidebar navigation and header.
 * Validates user session and redirects to login if not authenticated.
 * 
 * Design Tokens Used:
 * - Spacing: 16px (padding)
 * - Responsive: Sidebar collapses on mobile (<768px)
 */

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/shared/app-shell'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, email, roles')
    .eq('id', user.id)
    .single()

  return (
    <AppShell
      user={{
        email: (profile as any)?.email || user.email || '',
        name:  (profile as any)?.name ?? null,
      }}
    >
      {children}
    </AppShell>
  )
}
