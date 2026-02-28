'use server'

import { createServerClient } from '@/lib/supabase/server'
import { exportClients } from '@/lib/services/export-service'
import type { ClientFilters } from '@/lib/types/crm'

/**
 * Server Actions for Data Export Operations
 * 
 * Requirements: 9.1, 9.5
 * Task: 21.3 Create export actions
 */

/**
 * Export Filtered Clients to CSV
 * 
 * Generates a CSV file with filtered client data.
 * Masks sensitive data for non-admin users.
 */
export async function exportFilteredClients(filters: ClientFilters) {
  try {
    const supabase = await createServerClient()
    
    // Check authorization
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('No autenticado')
    }

    const { data: profile } = await supabase
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single()

    if (!profile || ((profile as any).role !== 'admin' && (profile as any).role !== 'vendedor')) {
      throw new Error('No tiene permisos para realizar esta acción')
    }

    // Determine if user is admin (for data masking)
    const userRole = (profile as any).role
    
    // Generate CSV
    const csvData = await exportClients(filters, userRole)
    
    return { 
      success: true, 
      data: csvData 
    }
  } catch (error) {
    console.error('Error exporting clients:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al exportar los clientes'
    }
  }
}
