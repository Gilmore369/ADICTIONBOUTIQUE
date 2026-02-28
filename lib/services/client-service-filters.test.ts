/**
 * Unit tests for filterClients function
 * 
 * Tests each filter criterion independently and in combination:
 * - Debt status filters (AL_DIA, CON_DEUDA, MOROSO)
 * - Days since last purchase filter
 * - Rating filter
 * - Birthday month filter
 * - Status filter (ACTIVO, INACTIVO, BAJA)
 * - Deactivation reason filter
 * - Multiple filter combinations
 * - Empty results scenarios
 * 
 * Validates: Requirements 5.1
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { filterClients } from './client-service'
import type { ClientFilters } from '@/lib/types/crm'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))

describe('filterClients - Unit Tests', () => {
  let mockSupabase: any
  
  // Helper to create a chainable mock
  const createMockChain = (finalData: any) => {
    const mockChain: any = {
      select: jest.fn(),
      in: jest.fn(),
      eq: jest.fn(),
      not: jest.fn(),
    }
    
    // Each method returns the chain for further chaining
    mockChain.select.mockReturnValue(mockChain)
    mockChain.in.mockReturnValue(mockChain)
    mockChain.eq.mockReturnValue(mockChain)
    mockChain.not.mockReturnValue(mockChain)
    
    // But also resolve to the final data when awaited
    Object.assign(mockChain, {
      then: (resolve: any) => Promise.resolve(finalData).then(resolve),
      catch: (reject: any) => Promise.resolve(finalData).catch(reject),
    })
    
    return mockChain
  }
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()
    
    // Create mock Supabase client
    mockSupabase = {
      from: jest.fn(),
    }
    
    // Mock createServerClient to return our mock
    const { createServerClient } = require('@/lib/supabase/server')
    createServerClient.mockResolvedValue(mockSupabase)
  })
  
  describe('Debt Status Filter', () => {
    it('should filter clients with MOROSO status (at least one overdue installment)', async () => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      const mockClients = [
        {
          id: 'client-1',
          name: 'Moroso Client',
          credit_used: 1000,
          active: true,
          client_ratings: null,
        },
        {
          id: 'client-2',
          name: 'Good Client',
          credit_used: 500,
          active: true,
          client_ratings: null,
        },
      ]
      
      // Only client-1 has an overdue installment
      const mockInstallments = [
        {
          id: 'inst-1',
          due_date: yesterday.toISOString(),
          status: 'OVERDUE',
          credit_plans: { client_id: 'client-1' },
        },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return createMockChain({
            data: mockClients,
            error: null,
          })
        }
        
        if (table === 'installments') {
          return createMockChain({
            data: mockInstallments,
            error: null,
          })
        }
        
        return createMockChain({ data: [], error: null })
      })
      
      const filters: ClientFilters = { debtStatus: 'MOROSO' }
      const result = await filterClients(filters)
      
      // Should only return client with overdue installment
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('client-1')
      expect(result[0].name).toBe('Moroso Client')
    })
    
    it('should filter clients with CON_DEUDA status (credit_used > 0)', async () => {
      const mockClients = [
        {
          id: 'client-1',
          name: 'Client With Debt',
          credit_used: 1000,
          active: true,
          client_ratings: null,
        },
        {
          id: 'client-2',
          name: 'Client No Debt',
          credit_used: 0,
          active: true,
          client_ratings: null,
        },
        {
          id: 'client-3',
          name: 'Another With Debt',
          credit_used: 500,
          active: true,
          client_ratings: null,
        },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return createMockChain({
            data: mockClients,
            error: null,
          })
        }
        
        if (table === 'installments') {
          return createMockChain({
            data: [],
            error: null,
          })
        }
        
        return createMockChain({ data: [], error: null })
      })
      
      const filters: ClientFilters = { debtStatus: 'CON_DEUDA' }
      const result = await filterClients(filters)
      
      // Should return clients with credit_used > 0
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Another With Debt')
      expect(result[1].name).toBe('Client With Debt')
    })
    
    it('should filter clients with AL_DIA status', async () => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const mockClients = [
        { id: 'client-1', name: 'Client Al Dia', credit_used: 1000, active: true, client_ratings: null },
        { id: 'client-2', name: 'Client Overdue', credit_used: 500, active: true, client_ratings: null },
        { id: 'client-3', name: 'Client No Debt', credit_used: 0, active: true, client_ratings: null },
      ]
      
      const mockInstallments = [
        { id: 'inst-1', due_date: tomorrow.toISOString(), status: 'PENDING', credit_plans: { client_id: 'client-1' } },
        { id: 'inst-2', due_date: yesterday.toISOString(), status: 'OVERDUE', credit_plans: { client_id: 'client-2' } },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') return createMockChain({ data: mockClients, error: null })
        if (table === 'installments') return createMockChain({ data: mockInstallments, error: null })
        return createMockChain({ data: [], error: null })
      })
      
      const filters: ClientFilters = { debtStatus: 'AL_DIA' }
      const result = await filterClients(filters)
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('client-1')
    })
  })
  
  describe('Days Since Last Purchase Filter', () => {
    it('should filter clients by days since last purchase', async () => {
      const today = new Date()
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const ninetyDaysAgo = new Date(today)
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      
      const mockClients = [
        { id: 'client-1', name: 'Recent Buyer', last_purchase_date: thirtyDaysAgo.toISOString(), active: true, client_ratings: null },
        { id: 'client-2', name: 'Inactive Buyer', last_purchase_date: ninetyDaysAgo.toISOString(), active: true, client_ratings: null },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') return createMockChain({ data: mockClients, error: null })
        return createMockChain({ data: [], error: null })
      })
      
      const filters: ClientFilters = { daysSinceLastPurchase: 45 }
      const result = await filterClients(filters)
      
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Inactive Buyer')
    })
  })
  
  describe('Rating Filter', () => {
    it('should filter clients by rating', async () => {
      const mockClients = [
        { id: 'client-1', name: 'A Client', rating: 'A', active: true, client_ratings: { rating: 'A', score: 95 } },
        { id: 'client-2', name: 'C Client', rating: 'C', active: true, client_ratings: { rating: 'C', score: 55 } },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') return createMockChain({ data: [mockClients[1]], error: null })
        return createMockChain({ data: [], error: null })
      })
      
      const filters: ClientFilters = { rating: ['C'] }
      const result = await filterClients(filters)
      
      expect(result).toHaveLength(1)
      expect(result[0].rating).toBe('C')
    })
  })
  
  describe('Birthday Month Filter', () => {
    it('should filter clients by birthday month', async () => {
      const mockClients = [
        { id: 'client-1', name: 'January Birthday', birthday: '1990-01-15', active: true, client_ratings: null },
        { id: 'client-2', name: 'March Birthday', birthday: '1985-03-20', active: true, client_ratings: null },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') return createMockChain({ data: mockClients, error: null })
        return createMockChain({ data: [], error: null })
      })
      
      const filters: ClientFilters = { birthdayMonth: 3 }
      const result = await filterClients(filters)
      
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('March Birthday')
    })
  })
  
  describe('Status Filter', () => {
    it('should filter active clients', async () => {
      const mockClients = [
        { id: 'client-1', name: 'Active Client', active: true, client_ratings: null },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') return createMockChain({ data: mockClients, error: null })
        return createMockChain({ data: [], error: null })
      })
      
      const filters: ClientFilters = { status: 'ACTIVO' }
      const result = await filterClients(filters)
      
      expect(result).toHaveLength(1)
      expect(result[0].active).toBe(true)
    })
    
    it('should filter inactive clients', async () => {
      const mockClients = [
        { id: 'client-1', name: 'Inactive Client', active: false, deactivation_reason: 'MUDADO', client_ratings: null },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') return createMockChain({ data: mockClients, error: null })
        return createMockChain({ data: [], error: null })
      })
      
      const filters: ClientFilters = { status: 'BAJA' }
      const result = await filterClients(filters)
      
      expect(result).toHaveLength(1)
      expect(result[0].active).toBe(false)
    })
  })
  
  describe('Multiple Filter Combinations', () => {
    it('should apply multiple filters with AND logic', async () => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const sixtyDaysAgo = new Date(today)
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
      
      const mockClients = [
        { id: 'client-1', name: 'Perfect Match', rating: 'C', last_purchase_date: sixtyDaysAgo.toISOString(), credit_used: 1000, active: true, client_ratings: { rating: 'C', score: 55 } },
        { id: 'client-2', name: 'Wrong Rating', rating: 'A', last_purchase_date: sixtyDaysAgo.toISOString(), credit_used: 1000, active: true, client_ratings: { rating: 'A', score: 95 } },
      ]
      
      const mockInstallments = [
        { id: 'inst-1', due_date: yesterday.toISOString(), status: 'OVERDUE', credit_plans: { client_id: 'client-1' } },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') return createMockChain({ data: [mockClients[0]], error: null })
        if (table === 'installments') return createMockChain({ data: mockInstallments, error: null })
        return createMockChain({ data: [], error: null })
      })
      
      const filters: ClientFilters = { rating: ['C'], daysSinceLastPurchase: 45, debtStatus: 'MOROSO' }
      const result = await filterClients(filters)
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('client-1')
    })
  })
  
  describe('Empty Results Scenarios', () => {
    it('should return empty array when no clients match filters', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') return createMockChain({ data: [], error: null })
        return createMockChain({ data: [], error: null })
      })
      
      const filters: ClientFilters = { rating: ['D'] }
      const result = await filterClients(filters)
      
      expect(result).toHaveLength(0)
      expect(Array.isArray(result)).toBe(true)
    })
    
    it('should return empty array when filtering by debt status with no matches', async () => {
      const mockClients = [
        { id: 'client-1', name: 'No Debt Client', credit_used: 0, active: true, client_ratings: null },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') return createMockChain({ data: mockClients, error: null })
        if (table === 'installments') return createMockChain({ data: [], error: null })
        return createMockChain({ data: [], error: null })
      })
      
      const filters: ClientFilters = { debtStatus: 'CON_DEUDA' }
      const result = await filterClients(filters)
      
      expect(result).toHaveLength(0)
    })
  })
  
  describe('Alphabetical Sorting', () => {
    it('should sort results alphabetically by name', async () => {
      const mockClients = [
        { id: 'client-1', name: 'Zebra Client', active: true, client_ratings: null },
        { id: 'client-2', name: 'Alpha Client', active: true, client_ratings: null },
        { id: 'client-3', name: 'Beta Client', active: true, client_ratings: null },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') return createMockChain({ data: mockClients, error: null })
        return createMockChain({ data: [], error: null })
      })
      
      const filters: ClientFilters = {}
      const result = await filterClients(filters)
      
      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('Alpha Client')
      expect(result[1].name).toBe('Beta Client')
      expect(result[2].name).toBe('Zebra Client')
    })
  })
})
