/**
 * Audit Logging Utility
 * 
 * Provides functions to create audit log entries for sensitive operations.
 * Logs user, timestamp, action type, and details to the audit_log table.
 * 
 * Requirements: 4.6, 13.6
 */

import { createServerClient } from '@/lib/supabase/server'

/**
 * Audit log entry data structure
 */
export interface AuditLogEntry {
  userId: string | null
  operation: string
  entityType: string
  entityId?: string | null
  oldValues?: Record<string, any> | null
  newValues?: Record<string, any> | null
  ipAddress?: string | null
}

/**
 * Creates an audit log entry in the database
 * 
 * This function logs sensitive operations to the audit_log table, including:
 * - User who performed the action
 * - Timestamp of the action
 * - Operation type (e.g., 'DEACTIVATE_CLIENT', 'UPDATE_RATING')
 * - Entity type and ID being modified
 * - Old and new values for the operation
 * - IP address (optional)
 * 
 * @param entry - Audit log entry data
 * @returns Promise<{ success: boolean, error?: string }> - Result of the operation
 * 
 * @example
 * ```typescript
 * // Log a client deactivation
 * await createAuditLog({
 *   userId: 'user-123',
 *   operation: 'DEACTIVATE_CLIENT',
 *   entityType: 'client',
 *   entityId: 'client-456',
 *   oldValues: { active: true },
 *   newValues: { active: false, reason: 'MUDADO' }
 * })
 * ```
 * 
 * @example
 * ```typescript
 * // Log a rating update
 * await createAuditLog({
 *   userId: 'user-123',
 *   operation: 'UPDATE_CLIENT_RATING',
 *   entityType: 'client',
 *   entityId: 'client-456',
 *   oldValues: { rating: 'B', score: 75 },
 *   newValues: { rating: 'A', score: 92 }
 * })
 * ```
 */
export async function createAuditLog(
  entry: AuditLogEntry
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient()
    const timestamp = new Date().toISOString()
    
    const { error } = await supabase
      .from('audit_log')
      .insert({
        timestamp,
        user_id: entry.userId,
        operation: entry.operation,
        entity_type: entry.entityType,
        entity_id: entry.entityId || null,
        old_values: entry.oldValues || null,
        new_values: entry.newValues || null,
        ip_address: entry.ipAddress || null,
      })
    
    if (error) {
      console.error('Failed to create audit log entry:', error)
      return {
        success: false,
        error: error.message
      }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Unexpected error creating audit log:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Creates an audit log entry for client deactivation
 * 
 * @param clientId - ID of the client being deactivated
 * @param userId - ID of the user performing the deactivation
 * @param reason - Reason for deactivation
 * @param notes - Additional notes
 * @returns Promise<{ success: boolean, error?: string }>
 * 
 * @example
 * ```typescript
 * await logClientDeactivation(
 *   'client-123',
 *   'user-456',
 *   'MUDADO',
 *   'Se mudó a otra ciudad'
 * )
 * ```
 */
export async function logClientDeactivation(
  clientId: string,
  userId: string,
  reason: string,
  notes: string | null
): Promise<{ success: boolean; error?: string }> {
  return createAuditLog({
    userId,
    operation: 'DEACTIVATE_CLIENT',
    entityType: 'client',
    entityId: clientId,
    oldValues: {
      active: true,
      deactivation_reason: null,
      deactivated_at: null,
      deactivated_by: null,
    },
    newValues: {
      active: false,
      deactivation_reason: reason,
      deactivated_at: new Date().toISOString(),
      deactivated_by: userId,
      notes,
    },
  })
}

/**
 * Creates an audit log entry for client reactivation
 * 
 * @param clientId - ID of the client being reactivated
 * @param userId - ID of the user performing the reactivation
 * @returns Promise<{ success: boolean, error?: string }>
 * 
 * @example
 * ```typescript
 * await logClientReactivation('client-123', 'user-456')
 * ```
 */
export async function logClientReactivation(
  clientId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  return createAuditLog({
    userId,
    operation: 'REACTIVATE_CLIENT',
    entityType: 'client',
    entityId: clientId,
    oldValues: {
      active: false,
    },
    newValues: {
      active: true,
    },
  })
}

/**
 * Creates an audit log entry for rating calculation
 * 
 * @param clientId - ID of the client whose rating was calculated
 * @param userId - ID of the user who triggered the calculation (null for system)
 * @param oldRating - Previous rating data
 * @param newRating - New rating data
 * @returns Promise<{ success: boolean, error?: string }>
 * 
 * @example
 * ```typescript
 * await logRatingCalculation(
 *   'client-123',
 *   null, // System-triggered
 *   { rating: 'B', score: 75 },
 *   { rating: 'A', score: 92 }
 * )
 * ```
 */
export async function logRatingCalculation(
  clientId: string,
  userId: string | null,
  oldRating: { rating: string | null; score: number | null } | null,
  newRating: { rating: string; score: number }
): Promise<{ success: boolean; error?: string }> {
  return createAuditLog({
    userId,
    operation: 'UPDATE_CLIENT_RATING',
    entityType: 'client',
    entityId: clientId,
    oldValues: oldRating,
    newValues: newRating,
  })
}

/**
 * Creates an audit log entry for payment recording
 * 
 * @param paymentId - ID of the payment record
 * @param clientId - ID of the client making the payment
 * @param userId - ID of the user recording the payment
 * @param amount - Payment amount
 * @param details - Additional payment details
 * @returns Promise<{ success: boolean, error?: string }>
 * 
 * @example
 * ```typescript
 * await logPaymentRecorded(
 *   'payment-123',
 *   'client-456',
 *   'user-789',
 *   500.00,
 *   { installments_paid: 2, method: 'EFECTIVO' }
 * )
 * ```
 */
export async function logPaymentRecorded(
  paymentId: string,
  clientId: string,
  userId: string,
  amount: number,
  details?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  return createAuditLog({
    userId,
    operation: 'RECORD_PAYMENT',
    entityType: 'payment',
    entityId: paymentId,
    newValues: {
      client_id: clientId,
      amount,
      ...details,
    },
  })
}

/**
 * Creates an audit log entry for credit limit changes
 * 
 * @param clientId - ID of the client whose credit limit changed
 * @param userId - ID of the user making the change
 * @param oldLimit - Previous credit limit
 * @param newLimit - New credit limit
 * @returns Promise<{ success: boolean, error?: string }>
 * 
 * @example
 * ```typescript
 * await logCreditLimitChange(
 *   'client-123',
 *   'user-456',
 *   5000,
 *   10000
 * )
 * ```
 */
export async function logCreditLimitChange(
  clientId: string,
  userId: string,
  oldLimit: number,
  newLimit: number
): Promise<{ success: boolean; error?: string }> {
  return createAuditLog({
    userId,
    operation: 'UPDATE_CREDIT_LIMIT',
    entityType: 'client',
    entityId: clientId,
    oldValues: {
      credit_limit: oldLimit,
    },
    newValues: {
      credit_limit: newLimit,
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Critical event audit helpers (added 2026-02-25)
// ─────────────────────────────────────────────────────────────

/**
 * Logs a sale creation event
 */
export async function logSaleCreated(
  saleId: string,
  userId: string,
  details: { sale_number: string; store_id: string; sale_type: string; total: number }
): Promise<{ success: boolean; error?: string }> {
  return createAuditLog({
    userId,
    operation: 'CREATE_SALE',
    entityType: 'sale',
    entityId: saleId,
    newValues: details,
  })
}

/**
 * Logs a cash shift open event
 */
export async function logCashShiftOpened(
  shiftId: string,
  userId: string,
  details: { store_id: string; opening_amount: number }
): Promise<{ success: boolean; error?: string }> {
  return createAuditLog({
    userId,
    operation: 'OPEN_CASH_SHIFT',
    entityType: 'cash_shift',
    entityId: shiftId,
    newValues: details,
  })
}

/**
 * Logs a cash shift close event
 */
export async function logCashShiftClosed(
  shiftId: string,
  userId: string,
  details: { closing_amount: number; expected_amount: number; difference: number }
): Promise<{ success: boolean; error?: string }> {
  return createAuditLog({
    userId,
    operation: 'CLOSE_CASH_SHIFT',
    entityType: 'cash_shift',
    entityId: shiftId,
    newValues: details,
  })
}
