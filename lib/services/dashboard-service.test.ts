/**
 * Unit tests for fetchDashboardMetrics function
 * 
 * Tests the dashboard metrics calculation logic for:
 * - Total active clients count
 * - Total deactivated clients count
 * - Clients with debt count
 * - Clients with overdue debt count
 * - Inactive clients count
 * - Birthdays this month count
 * - Pending collection actions count
 * - Total outstanding debt calculation
 * - Total overdue debt calculation
 * - Empty database scenarios
 * 
 * Validates: Requirements 6.1
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { fetchDashboardMetrics } from './dashboard-service'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn()
}))

describe('fetchDashboardMetrics', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()
    
    // Create mock Supabase client
    mockSupabase = {
      from: jest.fn()
    }
    
    const { createServerClient } = require('@/lib/supabase/server')
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
  })
  
  /**
   * Helper to create standard mock responses for empty database
   */
  const mockEmptyDatabase = () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation((field, value) => {
            if (field === 'active') {
              if (value === true) {
                return {
                  not: jest.fn().mockResolvedValue({ data: [], error: null })
                }
              }
              return Promise.resolve({ count: 0, error: null })
            }
            return { not: jest.fn().mockResolvedValue({ data: [], error: null }) }
          }),
          gt: jest.fn().mockResolvedValue({ count: 0, error: null })
        }
      }
      if (table === 'installments') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'collection_actions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({ count: 0, error: null })
        }
      }
      return mockSupabase
    })
  }

  /**
   * Test: Total active clients count
   * Validates: Requirement 6.1
   */
  it('should count total active clients correctly', async () => {
    let clientsCallCount = 0
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        clientsCallCount++
        const callNum = clientsCallCount
        
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation((field, value) => {
            // Call 1: active clients count
            if (callNum === 1 && field === 'active' && value === true) {
              return Promise.resolve({ count: 25, error: null })
            }
            // Call 2: deactivated clients count
            if (callNum === 2 && field === 'active' && value === false) {
              return Promise.resolve({ count: 0, error: null })
            }
            // Call 4: inactive clients (active=true, then .not())
            if (callNum === 4 && field === 'active' && value === true) {
              return {
                not: jest.fn().mockResolvedValue({ data: [], error: null })
              }
            }
            // Call 5: birthday clients (active=true, then .not())
            if (callNum === 5 && field === 'active' && value === true) {
              return {
                not: jest.fn().mockResolvedValue({ data: [], error: null })
              }
            }
            return Promise.resolve({ count: 0, error: null })
          }),
          gt: jest.fn().mockResolvedValue({ count: 0, error: null })
        }
      }
      if (table === 'installments') {
        return {
          select: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'collection_actions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({ count: 0, error: null })
        }
      }
      return mockSupabase
    })
    
    const metrics = await fetchDashboardMetrics()
    
    expect(metrics.totalActiveClients).toBe(25)
  })

  /**
   * Test: Empty database scenario
   * Validates: Requirement 6.1
   */
  it('should handle empty database correctly', async () => {
    mockEmptyDatabase()
    
    const metrics = await fetchDashboardMetrics()
    
    expect(metrics.totalActiveClients).toBe(0)
    expect(metrics.totalDeactivatedClients).toBe(0)
    expect(metrics.clientsWithDebt).toBe(0)
    expect(metrics.clientsWithOverdueDebt).toBe(0)
    expect(metrics.inactiveClients).toBe(0)
    expect(metrics.birthdaysThisMonth).toBe(0)
    expect(metrics.pendingCollectionActions).toBe(0)
    expect(metrics.totalOutstandingDebt).toBe(0)
    expect(metrics.totalOverdueDebt).toBe(0)
  })
  
  /**
   * Test: Total outstanding debt calculation
   * Validates: Requirement 6.8
   */
  it('should calculate total outstanding debt correctly', async () => {
    let clientsCallCount = 0
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        clientsCallCount++
        const callNum = clientsCallCount
        
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation((field, value) => {
            // Calls 1-2: count queries
            if (field === 'active' && callNum <= 2) {
              return Promise.resolve({ count: 0, error: null })
            }
            // Call 3: credit_used > 0
            if (field !== 'active' && callNum === 3) {
              return Promise.resolve({ count: 0, error: null })
            }
            // Call 4-5: data queries with .not()
            if (field === 'active' && value === true) {
              return {
                not: jest.fn().mockResolvedValue({ data: [], error: null })
              }
            }
            return Promise.resolve({ count: 0, error: null })
          }),
          gt: jest.fn().mockResolvedValue({ count: 0, error: null })
        }
      }
      if (table === 'installments') {
        return {
          select: jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'inst-1',
                amount: 1000,
                paid_amount: 0,
                due_date: new Date().toISOString(),
                status: 'PENDING',
                credit_plans: { client_id: 'client-1' }
              },
              {
                id: 'inst-2',
                amount: 500,
                paid_amount: 200,
                due_date: new Date().toISOString(),
                status: 'PARTIAL',
                credit_plans: { client_id: 'client-2' }
              },
              {
                id: 'inst-3',
                amount: 750,
                paid_amount: 750,
                due_date: new Date().toISOString(),
                status: 'PAID',
                credit_plans: { client_id: 'client-3' }
              }
            ],
            error: null 
          })
        }
      }
      if (table === 'collection_actions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({ count: 0, error: null })
        }
      }
      return mockSupabase
    })
    
    const metrics = await fetchDashboardMetrics()
    
    // Total outstanding: 1000 + (500 - 200) = 1300
    // PAID installment should not be counted
    expect(metrics.totalOutstandingDebt).toBe(1300)
  })

  /**
   * Test: Total overdue debt calculation
   * Validates: Requirement 6.9
   */
  it('should calculate total overdue debt correctly', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    let clientsCallCount = 0
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        clientsCallCount++
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation((field, value) => {
            if (field === 'active' && value === true) {
              return {
                not: jest.fn().mockResolvedValue({ data: [], error: null })
              }
            }
            return Promise.resolve({ count: 0, error: null })
          }),
          gt: jest.fn().mockResolvedValue({ count: 0, error: null })
        }
      }
      if (table === 'installments') {
        return {
          select: jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'inst-1',
                amount: 1000,
                paid_amount: 0,
                due_date: yesterday.toISOString(),
                status: 'OVERDUE',
                credit_plans: { client_id: 'client-1' }
              },
              {
                id: 'inst-2',
                amount: 500,
                paid_amount: 100,
                due_date: yesterday.toISOString(),
                status: 'PARTIAL',
                credit_plans: { client_id: 'client-2' }
              },
              {
                id: 'inst-3',
                amount: 750,
                paid_amount: 0,
                due_date: tomorrow.toISOString(),
                status: 'PENDING',
                credit_plans: { client_id: 'client-3' }
              }
            ],
            error: null 
          })
        }
      }
      if (table === 'collection_actions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({ count: 0, error: null })
        }
      }
      return mockSupabase
    })
    
    const metrics = await fetchDashboardMetrics()
    
    // Total overdue: 1000 + (500 - 100) = 1400
    // Future installment should not be counted
    expect(metrics.totalOverdueDebt).toBe(1400)
    // Should count 2 unique clients with overdue debt
    expect(metrics.clientsWithOverdueDebt).toBe(2)
  })
  
  /**
   * Test: Clients with debt count
   * Validates: Requirement 6.3
   */
  it('should count clients with debt (credit_used > 0) correctly', async () => {
    let clientsCallCount = 0
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        clientsCallCount++
        const callNum = clientsCallCount
        
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation((field, value) => {
            if (field === 'active' && value === true && callNum >= 4) {
              return {
                not: jest.fn().mockResolvedValue({ data: [], error: null })
              }
            }
            return Promise.resolve({ count: 0, error: null })
          }),
          gt: jest.fn().mockImplementation((field, value) => {
            if (field === 'credit_used' && value === 0) {
              return Promise.resolve({ count: 15, error: null })
            }
            return Promise.resolve({ count: 0, error: null })
          })
        }
      }
      if (table === 'installments') {
        return {
          select: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'collection_actions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({ count: 0, error: null })
        }
      }
      return mockSupabase
    })
    
    const metrics = await fetchDashboardMetrics()
    
    expect(metrics.clientsWithDebt).toBe(15)
  })
  
  /**
   * Test: Unique clients with overdue debt
   * Validates: Requirement 6.4 - unique client count
   */
  it('should count unique clients with overdue debt (not duplicate counts)', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    let clientsCallCount = 0
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        clientsCallCount++
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation((field, value) => {
            if (field === 'active' && value === true) {
              return {
                not: jest.fn().mockResolvedValue({ data: [], error: null })
              }
            }
            return Promise.resolve({ count: 0, error: null })
          }),
          gt: jest.fn().mockResolvedValue({ count: 0, error: null })
        }
      }
      if (table === 'installments') {
        return {
          select: jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'inst-1',
                amount: 1000,
                paid_amount: 0,
                due_date: yesterday.toISOString(),
                status: 'OVERDUE',
                credit_plans: { client_id: 'client-1' }
              },
              {
                id: 'inst-2',
                amount: 500,
                paid_amount: 0,
                due_date: yesterday.toISOString(),
                status: 'OVERDUE',
                credit_plans: { client_id: 'client-1' } // Same client
              },
              {
                id: 'inst-3',
                amount: 750,
                paid_amount: 0,
                due_date: yesterday.toISOString(),
                status: 'OVERDUE',
                credit_plans: { client_id: 'client-2' }
              }
            ],
            error: null 
          })
        }
      }
      if (table === 'collection_actions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({ count: 0, error: null })
        }
      }
      return mockSupabase
    })
    
    const metrics = await fetchDashboardMetrics()
    
    // Should count 2 unique clients, not 3 installments
    expect(metrics.clientsWithOverdueDebt).toBe(2)
    // But total overdue debt should be sum of all 3 installments
    expect(metrics.totalOverdueDebt).toBe(2250)
  })
})
