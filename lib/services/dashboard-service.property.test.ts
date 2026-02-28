/**
 * Property-Based Tests for fetchDashboardMetrics function
 * 
 * Tests universal properties that must hold for all valid inputs:
 * - Property 15: Dashboard Metrics Accuracy
 * - Property 16: Overdue Debt Calculation
 * 
 * Uses fast-check library for property-based testing
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import * as fc from 'fast-check'
import { fetchDashboardMetrics } from './dashboard-service'
import { differenceInDays } from 'date-fns'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))

describe('fetchDashboardMetrics - Property-Based Tests', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = {
      from: jest.fn(),
    }
    
    const { createServerClient } = require('@/lib/supabase/server')
    createServerClient.mockResolvedValue(mockSupabase)
  })
  
  /**
   * Property 15: Dashboard Metrics Accuracy
   * **Validates: Requirements 6.1**
   * 
   * For any set of clients in the database, the dashboard total active clients
   * count must equal the number of clients with active = true.
   */
  it('Property 15: totalActiveClients equals count of clients with active = true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate a set of clients with random active status
          clients: fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 30 }),
              active: fc.boolean(),
              credit_used: fc.integer({ min: 0, max: 50000 }),
              credit_limit: fc.integer({ min: 0, max: 100000 }),
            }),
            { minLength: 5, maxLength: 50 }
          ),
        }),
        async ({ clients }) => {
          // Calculate expected active clients count
          const expectedActiveCount = clients.filter(c => c.active === true).length
          const expectedDeactivatedCount = clients.filter(c => c.active === false).length
          
          // Setup mock to return the generated clients
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'system_config') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { key: 'inactivity_threshold_days', value: '90' },
                  error: null,
                }),
              }
            }
            
            if (table === 'clients') {
              const selectMock = jest.fn().mockReturnThis()
              const eqMock = jest.fn().mockReturnThis()
              const gtMock = jest.fn().mockReturnThis()
              const notMock = jest.fn().mockReturnThis()
              
              const queryChain = {
                select: selectMock,
                eq: eqMock,
                gt: gtMock,
                not: notMock,
              }
              
              // Handle count queries with head: true
              selectMock.mockImplementation((columns: string, options?: any) => {
                if (options?.head === true) {
                  // This is a count query
                  return {
                    eq: (column: string, value: any) => {
                      if (column === 'active' && value === true) {
                        return Promise.resolve({ count: expectedActiveCount, error: null })
                      } else if (column === 'active' && value === false) {
                        return Promise.resolve({ count: expectedDeactivatedCount, error: null })
                      }
                      return Promise.resolve({ count: 0, error: null })
                    },
                    gt: () => {
                      // Count clients with debt
                      const clientsWithDebt = clients.filter(c => c.credit_used > 0).length
                      return Promise.resolve({ count: clientsWithDebt, error: null })
                    },
                  }
                }
                
                // Regular select queries
                return queryChain
              })
              
              // Handle non-count queries
              eqMock.mockImplementation((column: string, value: any) => {
                if (column === 'active') {
                  const filteredClients = clients.filter(c => c.active === value)
                  return {
                    not: jest.fn().mockResolvedValue({
                      data: filteredClients.filter(c => c.last_purchase_date !== null),
                      error: null,
                    }),
                  }
                }
                return queryChain
              })
              
              notMock.mockResolvedValue({
                data: clients.filter(c => c.active && c.birthday !== null),
                error: null,
              })
              
              return queryChain
            }
            
            if (table === 'installments') {
              return {
                select: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }
            }
            
            if (table === 'collection_actions') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockResolvedValue({
                  count: 0,
                  error: null,
                }),
              }
            }
            
            return {
              select: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const metrics = await fetchDashboardMetrics()
          
          // Property: totalActiveClients must equal the count of clients with active = true
          expect(metrics.totalActiveClients).toBe(expectedActiveCount)
          
          // Also verify totalDeactivatedClients for completeness
          expect(metrics.totalDeactivatedClients).toBe(expectedDeactivatedCount)
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * Property 16: Overdue Debt Calculation
   * **Validates: Requirements 6.9**
   * 
   * For any set of installments in the database, the total overdue debt must
   * equal the sum of (amount - paid_amount) for all installments with
   * due_date < current_date and status not PAID.
   */
  it('Property 16: totalOverdueDebt equals sum of overdue installment balances', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate a set of installments with various due dates and statuses
          installments: fc.array(
            fc.record({
              id: fc.uuid(),
              clientId: fc.uuid(),
              amount: fc.integer({ min: 100, max: 10000 }),
              paidAmount: fc.integer({ min: 0, max: 5000 }),
              status: fc.constantFrom('PENDING', 'PARTIAL', 'PAID', 'OVERDUE'),
              // Use integer timestamps to avoid invalid dates
              dueDateTimestamp: fc.integer({ 
                min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).getTime(), // 1 year ago
                max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).getTime()  // 1 year from now
              }),
            }),
            { minLength: 5, maxLength: 50 }
          ),
        }),
        async ({ installments }) => {
          // Calculate expected overdue debt
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          
          let expectedOverdueDebt = 0
          let expectedTotalDebt = 0
          
          for (const inst of installments) {
            // Skip fully paid installments
            if (inst.status === 'PAID') {
              continue
            }
            
            const remainingAmount = inst.amount - inst.paidAmount
            const dueDate = new Date(inst.dueDateTimestamp)
            dueDate.setHours(0, 0, 0, 0)
            const isOverdue = dueDate < today
            
            // Add to total outstanding debt
            expectedTotalDebt += remainingAmount
            
            // Check if installment is overdue
            if (isOverdue && (inst.status === 'PENDING' || inst.status === 'PARTIAL' || inst.status === 'OVERDUE')) {
              expectedOverdueDebt += remainingAmount
            }
          }
          
          // Setup mock to return the generated installments
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'system_config') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { key: 'inactivity_threshold_days', value: '90' },
                  error: null,
                }),
              }
            }
            
            if (table === 'clients') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gt: jest.fn().mockResolvedValue({ count: 0, error: null }),
                not: jest.fn().mockResolvedValue({ data: [], error: null }),
              }
            }
            
            if (table === 'installments') {
              return {
                select: jest.fn().mockResolvedValue({
                  data: installments.map(inst => ({
                    id: inst.id,
                    amount: inst.amount,
                    paid_amount: inst.paidAmount,
                    due_date: new Date(inst.dueDateTimestamp).toISOString(),
                    status: inst.status,
                    credit_plans: {
                      client_id: inst.clientId,
                    },
                  })),
                  error: null,
                }),
              }
            }
            
            if (table === 'collection_actions') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockResolvedValue({
                  count: 0,
                  error: null,
                }),
              }
            }
            
            return {
              select: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const metrics = await fetchDashboardMetrics()
          
          // Property: totalOverdueDebt must equal the sum of overdue installment balances
          expect(metrics.totalOverdueDebt).toBe(expectedOverdueDebt)
          
          // Also verify totalOutstandingDebt for completeness
          expect(metrics.totalOutstandingDebt).toBe(expectedTotalDebt)
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * Additional Property Test: Clients with Overdue Debt Count
   * 
   * Verifies that the count of clients with overdue debt matches the number
   * of unique clients who have at least one overdue installment.
   */
  it('Property: clientsWithOverdueDebt equals unique clients with overdue installments', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate installments with various client IDs
          installments: fc.array(
            fc.record({
              id: fc.uuid(),
              clientId: fc.uuid(),
              amount: fc.integer({ min: 100, max: 10000 }),
              paidAmount: fc.integer({ min: 0, max: 5000 }),
              status: fc.constantFrom('PENDING', 'PARTIAL', 'PAID', 'OVERDUE'),
              dueDateTimestamp: fc.integer({ 
                min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).getTime(),
                max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).getTime()
              }),
            }),
            { minLength: 5, maxLength: 50 }
          ),
        }),
        async ({ installments }) => {
          // Calculate expected clients with overdue debt
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          
          const clientsWithOverdueDebtSet = new Set<string>()
          
          for (const inst of installments) {
            const dueDate = new Date(inst.dueDateTimestamp)
            dueDate.setHours(0, 0, 0, 0)
            const isOverdue = dueDate < today
            
            if (isOverdue && (inst.status === 'PENDING' || inst.status === 'PARTIAL' || inst.status === 'OVERDUE')) {
              clientsWithOverdueDebtSet.add(inst.clientId)
            }
          }
          
          const expectedClientsWithOverdueDebt = clientsWithOverdueDebtSet.size
          
          // Setup mock
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'system_config') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { key: 'inactivity_threshold_days', value: '90' },
                  error: null,
                }),
              }
            }
            
            if (table === 'clients') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gt: jest.fn().mockResolvedValue({ count: 0, error: null }),
                not: jest.fn().mockResolvedValue({ data: [], error: null }),
              }
            }
            
            if (table === 'installments') {
              return {
                select: jest.fn().mockResolvedValue({
                  data: installments.map(inst => ({
                    id: inst.id,
                    amount: inst.amount,
                    paid_amount: inst.paidAmount,
                    due_date: new Date(inst.dueDateTimestamp).toISOString(),
                    status: inst.status,
                    credit_plans: {
                      client_id: inst.clientId,
                    },
                  })),
                  error: null,
                }),
              }
            }
            
            if (table === 'collection_actions') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockResolvedValue({
                  count: 0,
                  error: null,
                }),
              }
            }
            
            return {
              select: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const metrics = await fetchDashboardMetrics()
          
          // Property: clientsWithOverdueDebt must equal unique clients with overdue installments
          expect(metrics.clientsWithOverdueDebt).toBe(expectedClientsWithOverdueDebt)
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * Additional Property Test: Non-negative Debt Values
   * 
   * Verifies that all debt-related metrics are non-negative.
   */
  it('Property: all debt metrics are non-negative', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          // Generate amount first, then paidAmount based on amount
          fc.integer({ min: 100, max: 10000 }).chain(amount =>
            fc.record({
              id: fc.uuid(),
              clientId: fc.uuid(),
              amount: fc.constant(amount),
              paidAmount: fc.integer({ min: 0, max: amount }),
              status: fc.constantFrom('PENDING', 'PARTIAL', 'PAID', 'OVERDUE'),
              dueDateTimestamp: fc.integer({ 
                min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).getTime(),
                max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).getTime()
              }),
            })
          ),
          { minLength: 0, maxLength: 30 }
        ),
        async (installments) => {
          // Calculate unique clients with any unpaid installments
          const clientsWithUnpaidInstallments = new Set<string>()
          for (const inst of installments) {
            if (inst.status !== 'PAID') {
              clientsWithUnpaidInstallments.add(inst.clientId)
            }
          }
          const clientsWithDebtCount = clientsWithUnpaidInstallments.size
          
          // Setup mock
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'system_config') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { key: 'inactivity_threshold_days', value: '90' },
                  error: null,
                }),
              }
            }
            
            if (table === 'clients') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gt: jest.fn().mockResolvedValue({ count: clientsWithDebtCount, error: null }),
                not: jest.fn().mockResolvedValue({ data: [], error: null }),
              }
            }
            
            if (table === 'installments') {
              return {
                select: jest.fn().mockResolvedValue({
                  data: installments.map(inst => ({
                    id: inst.id,
                    amount: inst.amount,
                    paid_amount: inst.paidAmount,
                    due_date: new Date(inst.dueDateTimestamp).toISOString(),
                    status: inst.status,
                    credit_plans: {
                      client_id: inst.clientId,
                    },
                  })),
                  error: null,
                }),
              }
            }
            
            if (table === 'collection_actions') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockResolvedValue({
                  count: 0,
                  error: null,
                }),
              }
            }
            
            return {
              select: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const metrics = await fetchDashboardMetrics()
          
          // Property: All debt metrics must be non-negative
          expect(metrics.totalOutstandingDebt).toBeGreaterThanOrEqual(0)
          expect(metrics.totalOverdueDebt).toBeGreaterThanOrEqual(0)
          expect(metrics.clientsWithDebt).toBeGreaterThanOrEqual(0)
          expect(metrics.clientsWithOverdueDebt).toBeGreaterThanOrEqual(0)
          
          // Property: Overdue debt cannot exceed total outstanding debt
          expect(metrics.totalOverdueDebt).toBeLessThanOrEqual(metrics.totalOutstandingDebt)
          
          // Property: Clients with overdue debt cannot exceed clients with debt
          expect(metrics.clientsWithOverdueDebt).toBeLessThanOrEqual(metrics.clientsWithDebt)
        }
      ),
      { numRuns: 100 }
    )
  })
})
