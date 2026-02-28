/**
 * Credit Service
 * 
 * Handles credit limit validation and credit usage updates for clients.
 * Implements requirements 10.1, 10.2, 10.3, 10.4 from the CRM specification.
 */

import { createServerClient } from '@/lib/supabase/server'

/**
 * Result of credit limit validation
 */
export interface CreditValidationResult {
  isValid: boolean
  availableCredit: number
  message?: string
}

/**
 * Validates if a client can make a credit purchase without exceeding their credit limit.
 * 
 * @param clientId - The UUID of the client
 * @param newPurchaseAmount - The amount of the new purchase to validate
 * @returns CreditValidationResult with validation status and available credit
 * 
 * **Preconditions:**
 * - clientId is a valid UUID
 * - newPurchaseAmount is a positive number
 * - Client exists in database and is active
 * 
 * **Postconditions:**
 * - Returns validation result indicating if purchase is allowed
 * - Returns available credit amount (credit_limit - credit_used)
 * - If validation fails, includes error message with available credit
 * 
 * **Validates: Requirements 10.1, 10.2**
 */
export async function validateCreditLimit(
  clientId: string,
  newPurchaseAmount: number
): Promise<CreditValidationResult> {
  const supabase = await createServerClient()

  // Fetch client credit information
  const { data: client, error } = await supabase
    .from('clients')
    .select('credit_limit, credit_used, active')
    .eq('id', clientId)
    .single()

  if (error || !client) {
    throw new Error(`Client not found: ${clientId}`)
  }

  if (!client.active) {
    return {
      isValid: false,
      availableCredit: 0,
      message: 'Cliente inactivo no puede realizar compras a crédito'
    }
  }

  // Calculate available credit
  const availableCredit = client.credit_limit - client.credit_used

  // Validate that credit_used + new_purchase_amount <= credit_limit
  const wouldExceedLimit = client.credit_used + newPurchaseAmount > client.credit_limit

  if (wouldExceedLimit) {
    return {
      isValid: false,
      availableCredit,
      message: `Crédito insuficiente. Crédito disponible: $${availableCredit.toFixed(2)}`
    }
  }

  return {
    isValid: true,
    availableCredit
  }
}

/**
 * Updates a client's credit_used amount after a payment and recalculates available credit.
 * 
 * @param clientId - The UUID of the client
 * @param newCreditUsed - The new credit_used amount after payment
 * @returns The updated available credit amount
 * 
 * **Preconditions:**
 * - clientId is a valid UUID
 * - newCreditUsed is a non-negative number
 * - newCreditUsed <= credit_limit
 * - Client exists in database
 * 
 * **Postconditions:**
 * - Client's credit_used is updated in database
 * - Returns recalculated available credit (credit_limit - credit_used)
 * - Available credit is guaranteed to equal credit_limit minus credit_used
 * 
 * **Validates: Requirements 10.3, 10.4**
 */
export async function updateCreditUsed(
  clientId: string,
  newCreditUsed: number
): Promise<number> {
  const supabase = await createServerClient()

  // Validate input
  if (newCreditUsed < 0) {
    throw new Error('credit_used cannot be negative')
  }

  // Fetch client to get credit_limit for validation
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('credit_limit')
    .eq('id', clientId)
    .single()

  if (fetchError || !client) {
    throw new Error(`Client not found: ${clientId}`)
  }

  // Validate that new credit_used doesn't exceed credit_limit
  if (newCreditUsed > client.credit_limit) {
    throw new Error(
      `credit_used (${newCreditUsed}) cannot exceed credit_limit (${client.credit_limit})`
    )
  }

  // Update credit_used
  const { error: updateError } = await supabase
    .from('clients')
    .update({ credit_used: newCreditUsed })
    .eq('id', clientId)

  if (updateError) {
    throw new Error(`Failed to update credit_used: ${updateError.message}`)
  }

  // Calculate and return available credit
  // Guarantees: credit_available = credit_limit - credit_used (Requirement 10.4)
  const availableCredit = client.credit_limit - newCreditUsed

  return availableCredit
}
