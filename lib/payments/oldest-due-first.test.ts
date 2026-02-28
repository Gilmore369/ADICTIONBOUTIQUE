/**
 * Unit tests for oldest_due_first payment algorithm
 * 
 * Tests the core payment allocation logic for:
 * - Sorting installments by due date (overdue first)
 * - Applying payments to installments in order
 * - Handling partial and full payments
 * - Updating installment status correctly
 */

import { describe, it, expect } from '@jest/globals'
import {
  sortInstallmentsByDueDate,
  applyPaymentToInstallments,
  calculateOutstandingDebt,
  type Installment
} from './oldest-due-first'

describe('sortInstallmentsByDueDate', () => {
  it('should prioritize overdue installments before upcoming ones', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)
    
    const installments: Installment[] = [
      {
        id: '1',
        plan_id: 'plan1',
        installment_number: 1,
        amount: 100,
        due_date: tomorrow.toISOString().split('T')[0],
        paid_amount: 0,
        status: 'PENDING'
      },
      {
        id: '2',
        plan_id: 'plan1',
        installment_number: 2,
        amount: 100,
        due_date: yesterday.toISOString().split('T')[0],
        paid_amount: 0,
        status: 'OVERDUE'
      },
      {
        id: '3',
        plan_id: 'plan1',
        installment_number: 3,
        amount: 100,
        due_date: nextWeek.toISOString().split('T')[0],
        paid_amount: 0,
        status: 'PENDING'
      }
    ]
    
    const sorted = sortInstallmentsByDueDate(installments)
    
    // Overdue (yesterday) should be first
    expect(sorted[0].id).toBe('2')
    // Upcoming should follow in order (tomorrow, then next week)
    expect(sorted[1].id).toBe('1')
    expect(sorted[2].id).toBe('3')
  })
  
  it('should sort multiple overdue installments by due date ascending', () => {
    const today = new Date()
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const fiveDaysAgo = new Date(today)
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    
    const installments: Installment[] = [
      {
        id: '1',
        plan_id: 'plan1',
        installment_number: 1,
        amount: 100,
        due_date: twoDaysAgo.toISOString().split('T')[0],
        paid_amount: 0,
        status: 'OVERDUE'
      },
      {
        id: '2',
        plan_id: 'plan1',
        installment_number: 2,
        amount: 100,
        due_date: fiveDaysAgo.toISOString().split('T')[0],
        paid_amount: 0,
        status: 'OVERDUE'
      }
    ]
    
    const sorted = sortInstallmentsByDueDate(installments)
    
    // Oldest overdue (5 days ago) should be first
    expect(sorted[0].id).toBe('2')
    expect(sorted[1].id).toBe('1')
  })
})

describe('applyPaymentToInstallments', () => {
  it('should fully pay an installment when payment covers full amount', () => {
    const installments: Installment[] = [
      {
        id: '1',
        plan_id: 'plan1',
        installment_number: 1,
        amount: 100,
        due_date: '2024-01-01',
        paid_amount: 0,
        status: 'PENDING'
      }
    ]
    
    const result = applyPaymentToInstallments(100, installments)
    
    expect(result.updatedInstallments).toHaveLength(1)
    expect(result.updatedInstallments[0].paid_amount).toBe(100)
    expect(result.updatedInstallments[0].status).toBe('PAID')
    expect(result.updatedInstallments[0].paid_at).toBeDefined()
    expect(result.remainingAmount).toBe(0)
  })
  
  it('should partially pay an installment when payment is insufficient', () => {
    const installments: Installment[] = [
      {
        id: '1',
        plan_id: 'plan1',
        installment_number: 1,
        amount: 100,
        due_date: '2024-01-01',
        paid_amount: 0,
        status: 'PENDING'
      }
    ]
    
    const result = applyPaymentToInstallments(50, installments)
    
    expect(result.updatedInstallments).toHaveLength(1)
    expect(result.updatedInstallments[0].paid_amount).toBe(50)
    expect(result.updatedInstallments[0].status).toBe('PARTIAL')
    expect(result.updatedInstallments[0].paid_at).toBeUndefined()
    expect(result.remainingAmount).toBe(0)
  })
  
  it('should apply payment to multiple installments in order', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const installments: Installment[] = [
      {
        id: '1',
        plan_id: 'plan1',
        installment_number: 1,
        amount: 100,
        due_date: tomorrow.toISOString().split('T')[0],
        paid_amount: 0,
        status: 'PENDING'
      },
      {
        id: '2',
        plan_id: 'plan1',
        installment_number: 2,
        amount: 100,
        due_date: yesterday.toISOString().split('T')[0],
        paid_amount: 0,
        status: 'OVERDUE'
      }
    ]
    
    const result = applyPaymentToInstallments(150, installments)
    
    expect(result.updatedInstallments).toHaveLength(2)
    
    // First installment (overdue) should be fully paid
    const overdueUpdate = result.updatedInstallments.find(u => u.id === '2')
    expect(overdueUpdate?.paid_amount).toBe(100)
    expect(overdueUpdate?.status).toBe('PAID')
    
    // Second installment (upcoming) should be partially paid
    const upcomingUpdate = result.updatedInstallments.find(u => u.id === '1')
    expect(upcomingUpdate?.paid_amount).toBe(50)
    expect(upcomingUpdate?.status).toBe('PARTIAL')
    
    expect(result.remainingAmount).toBe(0)
  })
  
  it('should handle existing partial payments correctly', () => {
    const installments: Installment[] = [
      {
        id: '1',
        plan_id: 'plan1',
        installment_number: 1,
        amount: 100,
        due_date: '2024-01-01',
        paid_amount: 30,
        status: 'PARTIAL'
      }
    ]
    
    const result = applyPaymentToInstallments(70, installments)
    
    expect(result.updatedInstallments).toHaveLength(1)
    expect(result.updatedInstallments[0].paid_amount).toBe(100)
    expect(result.updatedInstallments[0].status).toBe('PAID')
    expect(result.remainingAmount).toBe(0)
  })
  
  it('should return remaining amount when payment exceeds total debt', () => {
    const installments: Installment[] = [
      {
        id: '1',
        plan_id: 'plan1',
        installment_number: 1,
        amount: 100,
        due_date: '2024-01-01',
        paid_amount: 0,
        status: 'PENDING'
      }
    ]
    
    const result = applyPaymentToInstallments(150, installments)
    
    expect(result.updatedInstallments).toHaveLength(1)
    expect(result.updatedInstallments[0].paid_amount).toBe(100)
    expect(result.updatedInstallments[0].status).toBe('PAID')
    expect(result.remainingAmount).toBe(50)
  })
  
  it('should skip already fully paid installments', () => {
    const installments: Installment[] = [
      {
        id: '1',
        plan_id: 'plan1',
        installment_number: 1,
        amount: 100,
        due_date: '2024-01-01',
        paid_amount: 100,
        status: 'PAID'
      },
      {
        id: '2',
        plan_id: 'plan1',
        installment_number: 2,
        amount: 100,
        due_date: '2024-02-01',
        paid_amount: 0,
        status: 'PENDING'
      }
    ]
    
    const result = applyPaymentToInstallments(100, installments)
    
    // Should only update the second installment
    expect(result.updatedInstallments).toHaveLength(1)
    expect(result.updatedInstallments[0].id).toBe('2')
    expect(result.updatedInstallments[0].paid_amount).toBe(100)
    expect(result.updatedInstallments[0].status).toBe('PAID')
  })
})

describe('calculateOutstandingDebt', () => {
  it('should calculate total unpaid amount correctly', () => {
    const installments: Installment[] = [
      {
        id: '1',
        plan_id: 'plan1',
        installment_number: 1,
        amount: 100,
        due_date: '2024-01-01',
        paid_amount: 30,
        status: 'PARTIAL'
      },
      {
        id: '2',
        plan_id: 'plan1',
        installment_number: 2,
        amount: 100,
        due_date: '2024-02-01',
        paid_amount: 0,
        status: 'PENDING'
      },
      {
        id: '3',
        plan_id: 'plan1',
        installment_number: 3,
        amount: 100,
        due_date: '2024-03-01',
        paid_amount: 100,
        status: 'PAID'
      }
    ]
    
    const debt = calculateOutstandingDebt(installments)
    
    // (100 - 30) + (100 - 0) + (100 - 100) = 70 + 100 + 0 = 170
    expect(debt).toBe(170)
  })
  
  it('should return 0 when all installments are paid', () => {
    const installments: Installment[] = [
      {
        id: '1',
        plan_id: 'plan1',
        installment_number: 1,
        amount: 100,
        due_date: '2024-01-01',
        paid_amount: 100,
        status: 'PAID'
      }
    ]
    
    const debt = calculateOutstandingDebt(installments)
    expect(debt).toBe(0)
  })
})
