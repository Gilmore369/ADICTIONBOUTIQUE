/**
 * Blacklist Management Page
 * 
 * Gestión completa de la lista negra de clientes bloqueados
 * Permite agregar, quitar y ver historial de bloqueos
 */

import { createServerClient } from '@/lib/supabase/server'
import { BlacklistManagementView } from '@/components/clients/blacklist-management-view'
import { fetchAllRows } from '@/lib/supabase/paginate'
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
  // Modelo unificado: TODOS los roles operativos
  const validRoles = ['admin', 'vendedor', 'cajero', 'cobrador']
  if (!profile || !userRoles.some(r => validRoles.includes(r))) {
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

  // Fetch ALL clients (not blacklisted) for adding to blacklist + conteo real.
  // fetchAllRows pagina para superar el cap de 1000 filas de Supabase
  // (antes "Clientes activos" mostraba 1000 en vez de los ~6,283 reales).
  // Use neq instead of eq(active, true) para incluir registros con active=null
  let allClients: any[] = []
  try {
    allClients = await fetchAllRows<any>((from, to) =>
      supabase
        .from('clients')
        .select('id, dni, name, phone, credit_used, blacklisted')
        .neq('active', false)
        .order('name')
        .range(from, to)
    )
  } catch (allError) {
    console.error('Error fetching all clients:', allError)
  }

  return (
    <BlacklistManagementView 
      blacklistedClients={blacklistedClients || []}
      allClients={allClients || []}
    />
  )
}
