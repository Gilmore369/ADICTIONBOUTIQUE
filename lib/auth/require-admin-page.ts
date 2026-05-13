/**
 * Server-side gate para páginas admin-only.
 * Si el usuario no es admin, redirige a /dashboard con un mensaje.
 *
 * Usar en layout.tsx de carpetas que solo deben ver admins.
 */

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function requireAdminPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()
  if (!service) {
    // Sin service client no podemos verificar. Por seguridad, redirigir.
    redirect('/dashboard')
  }

  const { data: profile } = await service
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single()

  const roles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  if (!roles.includes('admin')) {
    redirect('/dashboard?error=admin_required')
  }
}
