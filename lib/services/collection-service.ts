/**
 * Collection Service
 * 
 * Provides functions for managing collection actions, including creating,
 * completing, and fetching collection actions for clients with debt.
 */

import { createServerClient } from '@/lib/supabase/server'
import { CollectionAction } from '@/lib/types/crm'

/**
 * Create a collection action
 * 
 * Creates a new collection action entry for a client. Validates that all
 * required fields are provided (client_id, action_type, description, follow_up_date).
 * Stores the user_id and current timestamp automatically.
 * 
 * @param clientId - UUID of the client
 * @param actionType - Type of collection action (LLAMADA, VISITA, WHATSAPP, MOTORIZADO, EMAIL, OTRO)
 * @param description - Description of the collection action
 * @param followUpDate - Date when follow-up is required
 * @param userId - UUID of the user performing the action
 * @returns Promise that resolves to the created CollectionAction
 * @throws Error if required fields are missing or database operation fails
 * 
 * @example
 * ```typescript
 * const action = await createCollectionAction(
 *   'client-uuid-123',
 *   'LLAMADA',
 *   'Llamada para recordar pago vencido',
 *   new Date('2024-03-15'),
 *   'user-uuid-456'
 * )
 * console.log(`Collection action created: ${action.id}`)
 * ```
 */
export async function createCollectionAction(
  clientId: string,
  actionType: string,
  description: string,
  followUpDate: Date,
  userId: string
): Promise<CollectionAction> {
  const supabase = await createServerClient()
  
  // Validate required fields
  if (!clientId) {
    throw new Error('client_id is required')
  }
  
  if (!actionType) {
    throw new Error('action_type is required')
  }
  
  if (!description) {
    throw new Error('description is required')
  }
  
  if (!followUpDate) {
    throw new Error('follow_up_date is required')
  }
  
  if (!userId) {
    throw new Error('user_id is required')
  }
  
  // Validate action type is one of the allowed values
  const validActionTypes = [
    'LLAMADA', 
    'VISITA', 
    'WHATSAPP', 
    'EMAIL', 
    'SMS', 
    'CARTA', 
    'MOTORIZADO', 
    'VIDEOLLAMADA', 
    'OTRO'
  ]
  if (!validActionTypes.includes(actionType)) {
    throw new Error(
      `Invalid action type: ${actionType}. Must be one of: ${validActionTypes.join(', ')}`
    )
  }
  
  const now = new Date()
  
  // Fetch client name for the collection action
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', clientId)
    .single()
  
  if (fetchError || !client) {
    throw new Error(`Client not found: ${clientId}`)
  }
  
  // Create the collection action entry
  const { data: collectionAction, error: insertError } = await supabase
    .from('collection_actions')
    .insert({
      client_id: clientId,
      client_name: client.name,
      action_type: actionType,
      description,
      follow_up_date: followUpDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
      completed: false,
      user_id: userId,
      created_at: now.toISOString(),
    })
    .select()
    .single()
  
  if (insertError) {
    throw new Error(`Failed to create collection action: ${insertError.message}`)
  }
  
  if (!collectionAction) {
    throw new Error('Failed to create collection action: No data returned')
  }
  
  // Transform to CollectionAction interface
  return {
    id: collectionAction.id,
    client_id: collectionAction.client_id,
    action_type: collectionAction.action_type,
    description: collectionAction.description,
    follow_up_date: new Date(collectionAction.follow_up_date),
    completed: collectionAction.completed,
    completed_at: collectionAction.completed_at ? new Date(collectionAction.completed_at) : null,
    user_id: collectionAction.user_id,
    created_at: new Date(collectionAction.created_at),
  }
}

/**
 * Complete a collection action
 * 
 * Marks a collection action as completed and sets the completed_at timestamp
 * to the current date and time.
 * 
 * @param actionId - UUID of the collection action to complete
 * @returns Promise that resolves to the updated CollectionAction
 * @throws Error if action not found or database operation fails
 * 
 * @example
 * ```typescript
 * const completedAction = await completeCollectionAction('action-uuid-123')
 * console.log(`Action completed at: ${completedAction.completed_at}`)
 * ```
 */
export async function completeCollectionAction(
  actionId: string
): Promise<CollectionAction> {
  const supabase = await createServerClient()
  
  // Validate required field
  if (!actionId) {
    throw new Error('actionId is required')
  }
  
  const now = new Date()
  
  // Update the collection action
  const { data: collectionAction, error: updateError } = await supabase
    .from('collection_actions')
    .update({
      completed: true,
      completed_at: now.toISOString(),
    })
    .eq('id', actionId)
    .select()
    .single()
  
  if (updateError) {
    throw new Error(`Failed to complete collection action: ${updateError.message}`)
  }
  
  if (!collectionAction) {
    throw new Error(`Collection action not found: ${actionId}`)
  }
  
  // Transform to CollectionAction interface
  return {
    id: collectionAction.id,
    client_id: collectionAction.client_id,
    action_type: collectionAction.action_type,
    description: collectionAction.description,
    follow_up_date: new Date(collectionAction.follow_up_date),
    completed: collectionAction.completed,
    completed_at: collectionAction.completed_at ? new Date(collectionAction.completed_at) : null,
    user_id: collectionAction.user_id,
    created_at: new Date(collectionAction.created_at),
  }
}

/**
 * Fetch collection actions for a client
 * 
 * Retrieves all collection actions for a specific client, sorted by follow_up_date
 * in ascending order (earliest first).
 * 
 * @param clientId - UUID of the client
 * @returns Promise that resolves to array of CollectionAction objects
 * @throws Error if database operation fails
 * 
 * @example
 * ```typescript
 * const actions = await fetchCollectionActions('client-uuid-123')
 * console.log(`Found ${actions.length} collection actions`)
 * ```
 */
export async function fetchCollectionActions(clientId: string): Promise<CollectionAction[]> {
  const supabase = await createServerClient()
  
  // Validate required field
  if (!clientId) {
    throw new Error('clientId is required')
  }
  
  const { data: collectionActions, error } = await supabase
    .from('collection_actions')
    .select('*')
    .eq('client_id', clientId)
    .order('follow_up_date', { ascending: true })
  
  if (error) {
    throw new Error(`Failed to fetch collection actions: ${error.message}`)
  }
  
  if (!collectionActions) {
    return []
  }
  
  // Transform to CollectionAction interface
  return collectionActions.map((action) => ({
    id: action.id,
    client_id: action.client_id,
    action_type: action.action_type,
    description: action.description,
    follow_up_date: new Date(action.follow_up_date),
    completed: action.completed,
    completed_at: action.completed_at ? new Date(action.completed_at) : null,
    user_id: action.user_id,
    created_at: new Date(action.created_at),
  }))
}
