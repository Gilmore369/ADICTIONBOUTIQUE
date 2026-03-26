/**
 * Blacklist Management Page
 * 
 * Gestión completa de la lista negra de clientes bloqueados
 * Permite agregar, quitar y ver historial de bloqueos
 */

import { createServerClient } from '@/lib/supabase/server'
import { BlacklistManagementView } from '@/components/clients/blacklist-management-view'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Lista Negra | Adiction Boutique',
  description: 'Gestión de clientes bloqueados'
}

export default async function BlacklistPage() {
  const supabase = await createServerClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Check authorization (admin or vendedor)
  const { data: profile } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single()

  const userRoles: string[] = ((profile as any)?.roles || []).map((r: string) => r.toLowerCase())
  if (!profile || (!userRoles.includes('admin') && !userRoles.includes('vendedor'))) {
    redirect('/')
  }

  // Fetch blacklisted clients with history
  const { data: blacklistedClients, error } = await supabase
    .from('clients')
    .select(`
      id,
      dni,
      name,
      phone,
      credit_used,
      blacklisted,
      blacklisted_at,
      blacklisted_reason,
      blacklisted_by
    `)
    .eq('blacklisted', true)
    .order('blacklisted_at', { ascending: false })

  if (error) {
    console.error('Error fetching blacklisted clients:', error)
  }

  // Fetch all clients (not blacklisted) for adding to blacklist
  // Use neq instead of eq(active, true) para incluir registros con active=null
  const { data: allClients, error: allError } = await supabase
    .from('clients')
    .select('id, dni, name, phone, credit_used, blacklisted')
    .neq('active', false)
    .order('name')

  if (allError) {
    console.error('Error fetching all clients:', allError)
  }

  return (
    <BlacklistManagementView 
      blacklistedClients={blacklistedClients || []}
      allClients={allClients || []}
    />
  )
}
