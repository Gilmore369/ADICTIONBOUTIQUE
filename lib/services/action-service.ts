/**
 * Action Service
 * 
 * Provides functions for managing client action logs, including creating
 * and fetching action logs for client interactions.
 */

import { createServerClient } from '@/lib/supabase/server'
import { ActionType, ClientActionLog } from '@/lib/types/crm'

/**
 * Create a client action log
 * 
 * Creates a new action log entry for a client. Validates that the action type
 * is one of the allowed values (NOTA, LLAMADA, VISITA, MENSAJE, REACTIVACION).
 * Stores the user_id and current timestamp automatically.
 * 
 * Special handling for REACTIVACION type:
 * - If action type is REACTIVACION and client is inactive, sets client active = true
 * 
 * @param clientId - UUID of the client
 * @param actionType - Type of action (NOTA, LLAMADA, VISITA, MENSAJE, REACTIVACION)
 * @param description - Description of the action
 * @param userId - UUID of the user performing the action
 * @returns Promise that resolves to the created ClientActionLog
 * @throws Error if action type is invalid or database operation fails
 * 
 * @example
 * ```typescript
 * const actionLog = await createActionLog(
 *   'client-uuid-123',
 *   ActionType.LLAMADA,
 *   'Llamada para recordar pago pendiente',
 *   'user-uuid-456'
 * )
 * console.log(`Action log created: ${actionLog.id}`)
 * ```
 */
export async function createActionLog(
  clientId: string,
  actionType: ActionType,
  description: string,
  userId: string
): Promise<ClientActionLog> {
  const supabase = await createServerClient()
  
  // Validate action type is one of the allowed values
  const validActionTypes = Object.values(ActionType)
  if (!validActionTypes.includes(actionType)) {
    throw new Error(
      `Invalid action type: ${actionType}. Must be one of: ${validActionTypes.join(', ')}`
    )
  }
  
  // Validate required fields
  if (!clientId || !description || !userId) {
    throw new Error('clientId, description, and userId are required')
  }
  
  const now = new Date()
  
  // Handle REACTIVACION type - update client active status
  if (actionType === ActionType.REACTIVACION) {
    // Fetch the client to verify it exists and check if inactive
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('id, name, active')
      .eq('id', clientId)
      .single()
    
    if (fetchError || !client) {
      throw new Error(`Client not found: ${clientId}`)
    }
    
    // If client is inactive, reactivate them
    if (!client.active) {
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          active: true,
          deactivation_reason: null,
          deactivated_at: null,
          deactivated_by: null,
        })
        .eq('id', clientId)
      
      if (updateError) {
        throw new Error(`Failed to reactivate client: ${updateError.message}`)
      }
    }
  }
  
  // Create the action log entry
  const { data: actionLog, error: insertError } = await supabase
    .from('client_action_logs')
    .insert({
      client_id: clientId,
      action_type: actionType,
      description,
      user_id: userId,
      created_at: now.toISOString(),
    })
    .select()
    .single()
  
  if (insertError) {
    throw new Error(`Failed to create action log: ${insertError.message}`)
  }
  
  if (!actionLog) {
    throw new Error('Failed to create action log: No data returned')
  }
  
  // Transform to ClientActionLog interface
  return {
    id: actionLog.id,
    client_id: actionLog.client_id,
    action_type: actionLog.action_type as ActionType,
    description: actionLog.description,
    user_id: actionLog.user_id,
    created_at: new Date(actionLog.created_at),
  }
}

/**
 * Fetch action logs for a client
 * 
 * Retrieves all action logs for a specific client, sorted by date
 * in descending order (most recent first).
 * 
 * @param clientId - UUID of the client
 * @returns Promise that resolves to array of ClientActionLog objects
 * @throws Error if database operation fails
 * 
 * @example
 * ```typescript
 * const actionLogs = await fetchActionLogs('client-uuid-123')
 * console.log(`Found ${actionLogs.length} action logs`)
 * ```
 */
export async function fetchActionLogs(clientId: string): Promise<ClientActionLog[]> {
  const supabase = await createServerClient()
  
  const { data: actionLogs, error } = await supabase
    .from('client_action_logs')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  
  if (error) {
    throw new Error(`Failed to fetch action logs: ${error.message}`)
  }
  
  if (!actionLogs) {
    return []
  }
  
  // Transform to ClientActionLog interface
  return actionLogs.map((log) => ({
    id: log.id,
    client_id: log.client_id,
    action_type: log.action_type as ActionType,
    description: log.description,
    user_id: log.user_id,
    created_at: new Date(log.created_at),
  }))
}
