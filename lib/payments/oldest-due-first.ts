/**
 * Oldest Due First Payment Algorithm
 * 
 * This module implements the payment allocation algorithm that prioritizes
 * overdue installments before upcoming ones, applying payments in order of
 * due date.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

/**
 * Installment type for payment processing
 */
export interface Installment {
  id: string
  plan_id: string
  installment_number: number
  amount: number
  due_date: string // ISO date string
  paid_amount: number
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE'
  paid_at?: string | null
}

/**
 * Updated installment after payment application
 */
export interface UpdatedInstallment {
  id: string
  paid_amount: number
  status: 'PENDING' | 'PARTIAL' | 'PAID'
  paid_at?: string
}

/**
 * Result of applying payment to installments
 */
export interface PaymentApplicationResult {
  updatedInstallments: UpdatedInstallment[]
  remainingAmount: number
}

/**
 * Sort installments by due date using oldest_due_first algorithm
 * 
 * Prioritizes:
 * 1. Overdue installments (due_date < today) - sorted by due_date ascending
 * 2. Upcoming installments (due_date >= today) - sorted by due_date ascending
 * 
 * @param installments - Array of installments to sort
 * @returns Sorted array with overdue first, then upcoming
 * 
 * **Validates: Requirements 7.1, 7.2**
 */
export function sortInstallmentsByDueDate(installments: Installment[]): Installment[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Normalize to start of day
  
  // Separate overdue and upcoming installments
  const overdue: Installment[] = []
  const upcoming: Installment[] = []
  
  for (const installment of installments) {
    const dueDate = new Date(installment.due_date)
    dueDate.setHours(0, 0, 0, 0) // Normalize to start of day
    
    if (dueDate < today) {
      overdue.push(installment)
    } else {
      upcoming.push(installment)
    }
  }
  
  // Sort each group by due_date ascending (oldest first)
  const sortByDueDate = (a: Installment, b: Installment) => {
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  }
  
  overdue.sort(sortByDueDate)
  upcoming.sort(sortByDueDate)
  
  // Return overdue first, then upcoming
  return [...overdue, ...upcoming]
}

/**
 * Apply payment to installments using oldest_due_first algorithm
 * 
 * Processes installments in order (overdue first, then upcoming by due date):
 * - If payment fully covers installment: set status to 'PAID', paid_amount = amount
 * - If payment partially covers installment: set status to 'PARTIAL', update paid_amount
 * - If installment already has partial payment: add to existing paid_amount
 * 
 * @param paymentAmount - Total payment amount to apply
 * @param installments - Array of installments (should be pre-sorted)
 * @returns Updated installments and remaining payment amount
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
 */
export function applyPaymentToInstallments(
  paymentAmount: number,
  installments: Installment[]
): PaymentApplicationResult {
  const updatedInstallments: UpdatedInstallment[] = []
  let remainingAmount = paymentAmount
  
  // Sort installments using oldest_due_first algorithm
  const sortedInstallments = sortInstallmentsByDueDate(installments)
  
  for (const installment of sortedInstallments) {
    // Skip if no remaining payment
    if (remainingAmount <= 0) {
      break
    }
    
    // Calculate remaining balance for this installment
    const installmentBalance = installment.amount - installment.paid_amount
    
    // Skip if installment is already fully paid
    if (installmentBalance <= 0) {
      continue
    }
    
    // Determine how much to apply to this installment
    const amountToApply = Math.min(remainingAmount, installmentBalance)
    const newPaidAmount = installment.paid_amount + amountToApply
    
    // Determine new status
    let newStatus: 'PENDING' | 'PARTIAL' | 'PAID'
    if (newPaidAmount >= installment.amount) {
      // Full payment - Requirement 7.4
      newStatus = 'PAID'
    } else if (newPaidAmount > 0) {
      // Partial payment - Requirement 7.3
      newStatus = 'PARTIAL'
    } else {
      newStatus = 'PENDING'
    }
    
    // Create updated installment record
    const updatedInstallment: UpdatedInstallment = {
      id: installment.id,
      paid_amount: newPaidAmount,
      status: newStatus
    }
    
    // Add paid_at timestamp if fully paid
    if (newStatus === 'PAID') {
      updatedInstallment.paid_at = new Date().toISOString()
    }
    
    updatedInstallments.push(updatedInstallment)
    
    // Deduct from remaining amount
    remainingAmount -= amountToApply
  }
  
  return {
    updatedInstallments,
    remainingAmount
  }
}

/**
 * Calculate total outstanding debt from installments
 * 
 * @param installments - Array of installments
 * @returns Total unpaid amount across all installments
 */
export function calculateOutstandingDebt(installments: Installment[]): number {
  return installments.reduce((total, installment) => {
    const balance = installment.amount - installment.paid_amount
    return total + Math.max(0, balance)
  }, 0)
}
