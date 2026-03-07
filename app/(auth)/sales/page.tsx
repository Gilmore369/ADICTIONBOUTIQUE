/**
 * Sales History Page
 * 
 * Historial completo de ventas con dashboard de indicadores
 * Permite ver, filtrar y descargar tickets en PDF
 */

import { createServerClient } from '@/lib/supabase/server'
import { SalesHistoryView } from '@/components/sales/sales-history-view'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Historial de Ventas | Adiction Boutique',
  description: 'Historial completo de ventas con indicadores y filtros'
}

export default async function SalesHistoryPage() {
  const supabase = await createServerClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch sales with related data
  const { data: sales, error } = await supabase
    .from('sales')
    .select(`
      id,
      sale_number,
      created_at,
      sale_type,
      subtotal,
      discount,
      total,
      store_id,
      voided,
      clients (
        id,
        name,
        dni
      ),
      sale_items (
        id,
        quantity,
        unit_price,
        subtotal,
        products (
          name
        )
      )
    `)
    .eq('voided', false)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Error fetching sales:', error)
  }

  return <SalesHistoryView initialSales={sales || []} />
}
