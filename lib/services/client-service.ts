// @ts-nocheck
/**
 * Client Service
 * 
 * Provides functions for fetching and managing client profiles,
 * including aggregated data from purchases, credit plans, installments,
 * action logs, and ratings.
 */

import { createServerClient } from '@/lib/supabase/server'
import {
  ClientProfile,
  CreditSummary,
  Purchase,
  InstallmentWithPlan,
  ClientActionLog,
  CollectionAction,
  ClientRating,
} from '@/lib/types/crm'
import { differenceInDays } from 'date-fns'

/**
 * Fetch complete client profile with all related data
 * 
 * Fetches client data, purchases, credit plans, installments, action logs,
 * collection actions, and rating in parallel for optimal performance.
 * Calculates credit summary and derived fields.
 * 
 * @param clientId - UUID of the client
 * @returns Complete ClientProfile object
 * 
 * @example
 * ```typescript
 * const profile = await fetchClientProfile('client-uuid-123')
 * console.log(`Client: ${profile.client.name}`)
 * console.log(`Credit available: ${profile.creditSummary.creditAvailable}`)
 * ```
 */
export async function fetchClientProfile(clientId: string): Promise<ClientProfile> {
  const supabase = await createServerClient()
  
  // Fetch all related data in parallel using Promise.all for performance
  const [
    clientResult,
    purchasesResult,
    creditPlansResult,
    installmentsResult,
    actionLogsResult,
    collectionActionsResult,
    ratingResult,
  ] = await Promise.all([
    // Fetch client data
    supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single(),
    
    // Fetch purchase history
    supabase
      .from('sales')
      .select('id, sale_number, created_at, total, sale_type, payment_status')
      .eq('client_id', clientId)
      .eq('voided', false)
      .order('created_at', { ascending: false }), // Most recent first
    
    // Fetch credit plans
    supabase
      .from('credit_plans')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    
    // Fetch installments with credit plan info
    supabase
      .from('installments')
      .select(`
        id,
        installment_number,
        amount,
        due_date,
        paid_amount,
        status,
        paid_at,
        credit_plans!inner(
          id,
          sale_number,
          client_id
        )
      `)
      .eq('credit_plans.client_id', clientId),
    
    // Fetch action logs
    supabase
      .from('client_action_logs')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    
    // Fetch collection actions
    supabase
      .from('collection_actions')
      .select('*')
      .eq('client_id', clientId)
      .order('follow_up_date', { ascending: true }),
    
    // Fetch client rating
    supabase
      .from('client_ratings')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle(),
  ])
  
  // Handle errors
  if (clientResult.error) {
    throw new Error(`Failed to fetch client: ${clientResult.error.message}`)
  }
  
  const client = clientResult.data as any
  const purchases = (purchasesResult.data || []) as any[]
  const creditPlans = (creditPlansResult.data || []) as any[]
  const installments = (installmentsResult.data || []) as any[]
  const actionLogs = (actionLogsResult.data || []) as any[]
  const collectionActions = (collectionActionsResult.data || []) as any[]
  const rating = ratingResult.data as any
  
  // Transform purchases to Purchase interface
  const purchaseHistory: Purchase[] = purchases.map((p: any) => ({
    id: p.id,
    saleNumber: p.sale_number || '',
    date: new Date(p.created_at),
    total: p.total || 0,
    saleType: p.sale_type as 'CONTADO' | 'CREDITO',
    paymentStatus: p.payment_status as 'PAID' | 'PENDING' | 'PARTIAL',
  }))
  
  // Transform installments and calculate days overdue
  const today = new Date()
  const installmentsWithPlan: InstallmentWithPlan[] = installments
    .map((inst: any) => {
      const dueDate = new Date(inst.due_date)
      const daysOverdue = dueDate < today ? differenceInDays(today, dueDate) : 0
      
      return {
        id: inst.id,
        planId: inst.credit_plans.id,
        installmentNumber: inst.installment_number,
        amount: inst.amount,
        dueDate,
        paidAmount: inst.paid_amount || 0,
        status: inst.status as 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE',
        paidAt: inst.paid_at ? new Date(inst.paid_at) : null,
        saleNumber: inst.credit_plans.sale_number || '',
        daysOverdue,
      }
    })
    // Sort by due date ascending (earliest first)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  
  // Calculate credit summary
  const creditLimit = client.credit_limit || 0
  const creditUsed = client.credit_used || 0
  const creditAvailable = creditLimit - creditUsed
  
  // Calculate total debt (sum of all pending installments)
  const totalDebt = installmentsWithPlan
    .filter((inst) => inst.status !== 'PAID')
    .reduce((sum, inst) => sum + (inst.amount - inst.paidAmount), 0)
  
  // Calculate overdue debt (sum of all overdue installments)
  const overdueDebt = installmentsWithPlan
    .filter((inst) => inst.daysOverdue > 0 && inst.status !== 'PAID')
    .reduce((sum, inst) => sum + (inst.amount - inst.paidAmount), 0)
  
  // Count pending and overdue installments (includes OVERDUE status)
  const pendingInstallments = installmentsWithPlan.filter(
    (inst) => inst.status === 'PENDING' || inst.status === 'PARTIAL' || inst.status === 'OVERDUE'
  ).length
  
  const overdueInstallments = installmentsWithPlan.filter(
    (inst) => inst.daysOverdue > 0 && inst.status !== 'PAID'
  ).length
  
  const creditSummary: CreditSummary = {
    creditLimit,
    creditUsed,
    creditAvailable,
    totalDebt,
    overdueDebt,
    pendingInstallments,
    overdueInstallments,
  }
  
  // Transform action logs
  const transformedActionLogs: ClientActionLog[] = actionLogs.map((log: any) => ({
    id: log.id,
    client_id: log.client_id,
    action_type: log.action_type,
    description: log.description,
    user_id: log.user_id,
    created_at: new Date(log.created_at),
  }))
  
  // Transform collection actions
  const transformedCollectionActions: CollectionAction[] = collectionActions.map((action: any) => ({
    id: action.id,
    client_id: action.client_id,
    action_type: action.action_type,
    description: action.description,
    follow_up_date: new Date(action.follow_up_date),
    completed: action.completed || false,
    completed_at: action.completed_at ? new Date(action.completed_at) : null,
    user_id: action.user_id,
    created_at: new Date(action.created_at),
  }))
  
  // Transform rating if exists
  const transformedRating: ClientRating | null = rating
    ? {
        client_id: rating.client_id,
        rating: rating.rating,
        score: rating.score,
        payment_punctuality: rating.payment_punctuality,
        purchase_frequency: rating.purchase_frequency,
        total_purchases: rating.total_purchases,
        client_tenure_days: rating.client_tenure_days,
        last_calculated: new Date(rating.last_calculated),
      }
    : null
  
  // Return complete client profile
  return {
    client,
    creditSummary,
    purchaseHistory,
    creditHistory: creditPlans,
    actionLogs: transformedActionLogs,
    collectionActions: transformedCollectionActions,
    installments: installmentsWithPlan,
    rating: transformedRating,
  }
}

/**
 * Deactivate a client
 * 
 * Marks a client as inactive (active = false), creates a deactivation record
 * in the client_deactivations table, and creates an audit log entry.
 * Validates that the reason is one of the allowed enum values.
 * 
 * @param clientId - UUID of the client to deactivate
 * @param reason - Reason for deactivation (FALLECIDO, MUDADO, DESAPARECIDO, OTRO)
 * @param notes - Optional additional notes about the deactivation
 * @param userId - UUID of the user performing the deactivation
 * @returns Promise that resolves when deactivation is complete
 * @throws Error if client is not found, already inactive, or database operation fails
 * 
 * @example
 * ```typescript
 * await deactivateClient(
 *   'client-uuid-123',
 *   'MUDADO',
 *   'Se mudó a otra ciudad',
 *   'user-uuid-456'
 * )
 * ```
 */
export async function deactivateClient(
  clientId: string,
  reason: 'FALLECIDO' | 'MUDADO' | 'DESAPARECIDO' | 'OTRO',
  notes: string | null,
  userId: string
): Promise<void> {
  const supabase = await createServerClient()
  
  // Validate reason is one of the allowed values
  const validReasons = ['FALLECIDO', 'MUDADO', 'DESAPARECIDO', 'OTRO']
  if (!validReasons.includes(reason)) {
    throw new Error(`Invalid deactivation reason: ${reason}. Must be one of: ${validReasons.join(', ')}`)
  }
  
  // Fetch the client to verify it exists and is active
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('id, name, active')
    .eq('id', clientId)
    .single()
  
  if (fetchError || !client) {
    throw new Error(`Client not found: ${clientId}`)
  }
  
  if (!(client as any).active) {
    throw new Error(`Client is already inactive: ${clientId}`)
  }
  
  const now = new Date()
  
  // Start a transaction-like operation by performing all updates
  // Note: Supabase doesn't support transactions in the client library,
  // but we can handle errors and maintain consistency
  
  // Step 1: Update client to set active = false
  const { error: updateError } = await supabase
    .from('clients')
    .update({
      active: false,
      deactivation_reason: reason,
      deactivated_at: now.toISOString(),
      deactivated_by: userId,
    } as any)
    .eq('id', clientId)
  
  if (updateError) {
    throw new Error(`Failed to deactivate client: ${updateError.message}`)
  }
  
  // Step 2: Create deactivation record in client_deactivations table
  const { error: deactivationError } = await supabase
    .from('client_deactivations')
    .insert({
      client_id: clientId,
      reason,
      notes,
      deactivated_by: userId,
      deactivated_at: now.toISOString(),
    } as any)
  
  if (deactivationError) {
    // Attempt to rollback the client update
    await supabase
      .from('clients')
      .update({
        active: true,
        deactivation_reason: null,
        deactivated_at: null,
        deactivated_by: null,
      } as any)
      .eq('id', clientId)
    
    throw new Error(`Failed to create deactivation record: ${deactivationError.message}`)
  }
  
  // Step 3: Create audit log entry
  const { error: auditError } = await supabase
    .from('audit_log')
    .insert({
      timestamp: now.toISOString(),
      user_id: userId,
      operation: 'DEACTIVATE_CLIENT',
      entity_type: 'client',
      entity_id: clientId,
      old_values: {
        active: true,
        deactivation_reason: null,
        deactivated_at: null,
        deactivated_by: null,
      },
      new_values: {
        active: false,
        deactivation_reason: reason,
        deactivated_at: now.toISOString(),
        deactivated_by: userId,
        notes,
      },
    } as any)
  
  if (auditError) {
    // Log the error but don't fail the operation since the main deactivation succeeded
    console.error('Failed to create audit log entry:', auditError)
  }
}

/**
 * Reactivate a client
 * 
 * Marks an inactive client as active (active = true) and creates a REACTIVACION
 * action log entry to record the reactivation event.
 * 
 * @param clientId - UUID of the client to reactivate
 * @param description - Description of the reactivation action
 * @param userId - UUID of the user performing the reactivation
 * @returns Promise that resolves when reactivation is complete
 * @throws Error if client is not found, already active, or database operation fails
 * 
 * @example
 * ```typescript
 * await reactivateClient(
 *   'client-uuid-123',
 *   'Cliente regresó a la zona',
 *   'user-uuid-456'
 * )
 * ```
 */
export async function reactivateClient(
  clientId: string,
  description: string,
  userId: string
): Promise<void> {
  const supabase = await createServerClient()
  
  // Fetch the client to verify it exists and is inactive
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('id, name, active')
    .eq('id', clientId)
    .single()
  
  if (fetchError || !client) {
    throw new Error(`Client not found: ${clientId}`)
  }
  
  if ((client as any).active) {
    throw new Error(`Client is already active: ${clientId}`)
  }
  
  const now = new Date()
  
  // Step 1: Update client to set active = true
  const { error: updateError } = await supabase
    .from('clients')
    .update({
      active: true,
      deactivation_reason: null,
      deactivated_at: null,
      deactivated_by: null,
    } as any)
    .eq('id', clientId)
  
  if (updateError) {
    throw new Error(`Failed to reactivate client: ${updateError.message}`)
  }
  
  // Step 2: Create REACTIVACION action log entry
  const { error: actionLogError } = await supabase
    .from('client_action_logs')
    .insert({
      client_id: clientId,
      action_type: 'REACTIVACION',
      description,
      user_id: userId,
      created_at: now.toISOString(),
    } as any)
  
  if (actionLogError) {
    // Attempt to rollback the client update
    await supabase
      .from('clients')
      .update({
        active: false,
      } as any)
      .eq('id', clientId)
    
    throw new Error(`Failed to create reactivation action log: ${actionLogError.message}`)
  }
}

/**
 * Filter clients by multiple criteria
 * 
 * Applies multiple filter criteria with AND logic to return clients matching
 * all specified conditions. Supports filtering by debt status, days since last
 * purchase, rating, birthday month, status, and deactivation reason.
 * Results are sorted alphabetically by name.
 * 
 * @param filters - ClientFilters object with optional filter criteria
 * @returns Array of clients matching all filter criteria, sorted by name
 * 
 * @example
 * ```typescript
 * const filters: ClientFilters = {
 *   debtStatus: 'MOROSO',
 *   rating: ['C', 'D'],
 *   daysSinceLastPurchase: 60
 * }
 * const filteredClients = await filterClients(filters)
 * console.log(`Found ${filteredClients.length} clients matching filters`)
 * ```
 */
export async function filterClients(filters: import('@/lib/types/crm').ClientFilters) {
  const supabase = await createServerClient()
  
  // Start with base query
  let query = supabase
    .from('clients')
    .select(`
      *,
      client_ratings(rating, score)
    `)
  
  // Apply status filter (ACTIVO, INACTIVO, BAJA)
  if (filters.status) {
    if (filters.status === 'ACTIVO') {
      query = query.eq('active', true)
    } else if (filters.status === 'INACTIVO' || filters.status === 'BAJA') {
      query = query.eq('active', false)
    }
  }
  
  // Apply deactivation reason filter (only for inactive clients)
  if (filters.deactivationReason && filters.deactivationReason.length > 0) {
    query = query.in('deactivation_reason', filters.deactivationReason)
  }
  
  // Apply birthday month filter
  if (filters.birthdayMonth !== undefined) {
    // Note: PostgreSQL EXTRACT returns 1-12 for months
    query = query.not('birthday', 'is', null)
  }
  
  // Apply rating filter
  if (filters.rating && filters.rating.length > 0) {
    query = query.in('rating', filters.rating)
  }
  
  // Execute the query
  const { data: clients, error } = await query
  
  if (error) {
    throw new Error(`Failed to fetch clients: ${error.message}`)
  }
  
  if (!clients) {
    return []
  }
  
  // Apply client-side filters that require complex logic
  let filteredClients = clients as any[]
  
  // Filter by birthday month (client-side since we need to extract month from date)
  if (filters.birthdayMonth !== undefined) {
    filteredClients = filteredClients.filter((client: any) => {
      if (!client.birthday) return false
      const birthdayDate = new Date(client.birthday)
      // JavaScript getMonth() returns 0-11, so add 1 to match 1-12
      return birthdayDate.getMonth() + 1 === filters.birthdayMonth
    })
  }
  
  // Filter by days since last purchase
  if (filters.daysSinceLastPurchase !== undefined) {
    const today = new Date()
    filteredClients = filteredClients.filter((client: any) => {
      if (!client.last_purchase_date) return false
      const lastPurchaseDate = new Date(client.last_purchase_date)
      const daysSince = differenceInDays(today, lastPurchaseDate)
      return daysSince > filters.daysSinceLastPurchase!
    })
  }
  
  // Filter by debt status (AL_DIA, CON_DEUDA, MOROSO)
  if (filters.debtStatus) {
    // Need to fetch installments for each client to determine debt status
    const clientIds = filteredClients.map((c: any) => c.id)
    
    if (clientIds.length > 0) {
      // Fetch all installments for these clients
      const { data: installments, error: instError } = await supabase
        .from('installments')
        .select(`
          id,
          due_date,
          status,
          credit_plans!inner(client_id)
        `)
        .in('credit_plans.client_id', clientIds)
      
      if (instError) {
        throw new Error(`Failed to fetch installments: ${instError.message}`)
      }
      
      // Group installments by client_id
      const installmentsByClient = new Map<string, any[]>()
      installments?.forEach((inst: any) => {
        const clientId = inst.credit_plans.client_id
        if (!installmentsByClient.has(clientId)) {
          installmentsByClient.set(clientId, [])
        }
        installmentsByClient.get(clientId)!.push(inst)
      })
      
      const today = new Date()
      
      filteredClients = filteredClients.filter((client: any) => {
        const clientInstallments = installmentsByClient.get(client.id) || []
        const creditUsed = client.credit_used || 0
        
        // Check if client has any overdue installments
        const hasOverdueInstallments = clientInstallments.some((inst: any) => {
          const dueDate = new Date(inst.due_date)
          return (
            dueDate < today &&
            (inst.status === 'PENDING' || inst.status === 'PARTIAL' || inst.status === 'OVERDUE')
          )
        })
        
        if (filters.debtStatus === 'MOROSO') {
          // MOROSO: At least one overdue installment
          return hasOverdueInstallments
        } else if (filters.debtStatus === 'CON_DEUDA') {
          // CON_DEUDA: credit_used > 0
          return creditUsed > 0
        } else if (filters.debtStatus === 'AL_DIA') {
          // AL_DIA: credit_used > 0 AND no overdue installments
          return creditUsed > 0 && !hasOverdueInstallments
        }
        
        return true
      })
    }
  }
  
  // Sort results alphabetically by name
  filteredClients.sort((a: any, b: any) => {
    const nameA = a.name?.toLowerCase() || ''
    const nameB = b.name?.toLowerCase() || ''
    return nameA.localeCompare(nameB)
  })
  
  return filteredClients
}
