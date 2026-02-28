'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { 
  createActionLog
} from '@/lib/services/action-service'
import { 
  deactivateClient as deactivateClientService,
  reactivateClient as reactivateClientService,
  filterClients as filterClientsService
} from '@/lib/services/client-service'
import { z } from 'zod'
import type { ClientFilters } from '@/lib/types/crm'

/**
 * Server Actions for Client CRM Operations
 * 
 * Requirements: 7.1, 8.1, 8.4, 4.1, 7.5, 13.1, 15.2
 * Task: 21.1 Create client actions
 */

// Validation Schemas
const actionLogSchema = z.object({
  clientId: z.string().uuid(),
  actionType: z.enum(['NOTA', 'LLAMADA', 'VISITA', 'MENSAJE', 'REACTIVACION']),
  description: z.string().min(1, 'La descripción es requerida'),
})

const collectionActionSchema = z.object({
  clientId: z.string().uuid(),
  actionType: z.string().min(1, 'El tipo de acción es requerido'),
  description: z.string().min(1, 'La descripción es requerida'),
  followUpDate: z.string().min(1, 'La fecha de seguimiento es requerida'),
})

const deactivationSchema = z.object({
  clientId: z.string().uuid(),
  reason: z.enum(['FALLECIDO', 'MUDADO', 'DESAPARECIDO', 'OTRO']),
  notes: z.string().nullable(),
})

// Authorization Helper
async function checkAuthorization(requiredRole?: 'admin' | 'vendedor') {
  const supabase = await createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('No autenticado')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single()

  if (!profile) {
    throw new Error('Perfil de usuario no encontrado')
  }

  const roles = (profile as any).roles || []

  if (requiredRole === 'admin' && !roles.includes('admin')) {
    throw new Error('Se requieren permisos de administrador')
  }

  if (!roles.includes('admin') && !roles.includes('vendedor') && !roles.includes('cajero')) {
    throw new Error('No tiene permisos para realizar esta acción')
  }

  return { userId: user.id, roles }
}

/**
 * Create Action Log
 * 
 * Creates a new action log entry for a client.
 * Handles REACTIVACION type by updating client status.
 */
export async function createClientActionLog(data: {
  clientId: string
  actionType: 'NOTA' | 'LLAMADA' | 'VISITA' | 'MENSAJE' | 'REACTIVACION'
  description: string
}) {
  try {
    // Validate input
    const validated = actionLogSchema.parse(data)
    
    // Check authorization
    const { userId } = await checkAuthorization()
    
    // Create action log
    await createActionLog(
      validated.clientId,
      validated.actionType as any,
      validated.description,
      userId
    )
    
    // Revalidate paths
    revalidatePath(`/clients/${validated.clientId}`)
    revalidatePath('/clients')
    
    return { success: true }
  } catch (error) {
    console.error('Error creating action log:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear el registro de acción'
    }
  }
}

/**
 * Deactivate Client
 * 
 * Marks a client as inactive. Admin only.
 */
export async function deactivateClientAction(data: {
  clientId: string
  reason: 'FALLECIDO' | 'MUDADO' | 'DESAPARECIDO' | 'OTRO'
  notes: string | null
}) {
  try {
    // Validate input
    const validated = deactivationSchema.parse(data)
    
    // Check authorization (admin only)
    const { userId } = await checkAuthorization('admin')
    
    // Deactivate client
    await deactivateClientService(
      validated.clientId,
      validated.reason,
      validated.notes,
      userId
    )
    
    // Revalidate paths
    revalidatePath(`/clients/${validated.clientId}`)
    revalidatePath('/clients')
    revalidatePath('/clients/dashboard')
    
    return { success: true }
  } catch (error) {
    console.error('Error deactivating client:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al dar de baja al cliente'
    }
  }
}

/**
 * Reactivate Client
 * 
 * Marks an inactive client as active again.
 */
export async function reactivateClientAction(clientId: string) {
  try {
    // Check authorization
    const { userId } = await checkAuthorization()
    
    // Reactivate client with description
    await reactivateClientService(clientId, 'Cliente reactivado', userId)
    
    // Revalidate paths
    revalidatePath(`/clients/${clientId}`)
    revalidatePath('/clients')
    revalidatePath('/clients/dashboard')
    
    return { success: true }
  } catch (error) {
    console.error('Error reactivating client:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al reactivar al cliente'
    }
  }
}

/**
 * Filter Clients
 * 
 * Filters clients based on provided criteria.
 */
export async function filterClientsAction(filters: ClientFilters) {
  try {
    // Check authorization
    await checkAuthorization()
    
    // Filter clients
    const clients = await filterClientsService(filters)
    
    return { success: true, data: clients }
  } catch (error) {
    console.error('Error filtering clients:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al filtrar clientes'
    }
  }
}
