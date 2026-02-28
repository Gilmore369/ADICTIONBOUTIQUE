/**
 * Unit tests for calculateClientRating function
 * 
 * Tests the client rating calculation logic for:
 * - Payment punctuality calculation (40% weight)
 * - Purchase frequency calculation (30% weight)
 * - Total purchase amount calculation (20% weight)
 * - Client tenure calculation (10% weight)
 * - Rating category assignment (A, B, C, D)
 * - Edge case: clients with no purchase history
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { calculateClientRating } from './rating-service'
import { RatingCategory } from '@/lib/types/crm'
import * as fc from 'fast-check'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn()
}))

// Custom matcher for checking if value is one of the expected values
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received)
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true
      }
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false
      }
    }
  }
})

describe('calculateClientRating', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()
    
    // Create mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis()
    }
    
    const { createServerClient } = require('@/lib/supabase/server')
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
  })
  
  it('should return default rating C/50 for client with no purchase history', async () => {
    // Mock empty data
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'installments') {
        return {
          ...mockSupabase,
          eq: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'sales') {
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { id: 'client-1', name: 'Test Client', created_at: new Date().toISOString() },
            error: null 
          })
        }
      }
      return mockSupabase
    })
    
    const rating = await calculateClientRating('client-1')
    
    expect(rating.rating).toBe(RatingCategory.C)
    expect(rating.score).toBe(50)
    expect(rating.payment_punctuality).toBe(50)
    expect(rating.purchase_frequency).toBe(50)
    expect(rating.total_purchases).toBe(0)
    expect(rating.client_tenure_days).toBe(0)
  })
  
  it('should calculate rating A for excellent client (all payments on time, frequent purchases)', async () => {
    const today = new Date()
    const sixMonthsAgo = new Date(today)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    
    // Mock data for excellent client
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'installments') {
        // 10 installments, all paid on time
        const installments = Array.from({ length: 10 }, (_, i) => ({
          id: `inst-${i}`,
          amount: 100,
          due_date: new Date(today.getTime() - (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString(),
          paid_amount: 100,
          status: 'PAID',
          paid_at: new Date(today.getTime() - (i + 1) * 30 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000).toISOString(), // Paid 1 day before due
          credit_plans: { client_id: 'client-1' }
        }))
        
        return {
          ...mockSupabase,
          eq: jest.fn().mockResolvedValue({ data: installments, error: null })
        }
      }
      if (table === 'sales') {
        // 30 purchases over 6 months (5 per month)
        const purchases = Array.from({ length: 30 }, (_, i) => ({
          id: `sale-${i}`,
          total: 500,
          created_at: new Date(sixMonthsAgo.getTime() + i * 6 * 24 * 60 * 60 * 1000).toISOString()
        }))
        
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: purchases, error: null })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { id: 'client-1', name: 'Excellent Client', created_at: sixMonthsAgo.toISOString() },
            error: null 
          })
        }
      }
      return mockSupabase
    })
    
    const rating = await calculateClientRating('client-1')
    
    expect(rating.rating).toBe(RatingCategory.A)
    expect(rating.score).toBeGreaterThanOrEqual(90)
    expect(rating.payment_punctuality).toBe(100) // All paid on time
    expect(rating.total_purchases).toBe(30)
  })
  
  it('should calculate rating D for poor client (late payments, infrequent purchases)', async () => {
    const today = new Date()
    const oneYearAgo = new Date(today)
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    
    // Mock data for poor client
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'installments') {
        // 5 installments, all paid late
        const installments = Array.from({ length: 5 }, (_, i) => ({
          id: `inst-${i}`,
          amount: 100,
          due_date: new Date(today.getTime() - (i + 1) * 60 * 24 * 60 * 60 * 1000).toISOString(),
          paid_amount: 100,
          status: 'PAID',
          paid_at: new Date(today.getTime() - (i + 1) * 60 * 24 * 60 * 60 * 1000 + 30 * 24 * 60 * 60 * 1000).toISOString(), // Paid 30 days late
          credit_plans: { client_id: 'client-1' }
        }))
        
        return {
          ...mockSupabase,
          eq: jest.fn().mockResolvedValue({ data: installments, error: null })
        }
      }
      if (table === 'sales') {
        // Only 2 purchases in a year
        const purchases = [
          {
            id: 'sale-1',
            total: 100,
            created_at: oneYearAgo.toISOString()
          },
          {
            id: 'sale-2',
            total: 100,
            created_at: new Date(oneYearAgo.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]
        
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: purchases, error: null })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { id: 'client-1', name: 'Poor Client', created_at: oneYearAgo.toISOString() },
            error: null 
          })
        }
      }
      return mockSupabase
    })
    
    const rating = await calculateClientRating('client-1')
    
    expect(rating.rating).toBe(RatingCategory.D)
    expect(rating.score).toBeLessThan(50)
    expect(rating.payment_punctuality).toBe(0) // All paid late
    expect(rating.total_purchases).toBe(2)
  })
  
  it('should assign rating category B for score between 70-89', async () => {
    const today = new Date()
    const fourMonthsAgo = new Date(today)
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4)
    
    // Mock data for good client (B rating)
    // Target: 75 score = (80 * 0.4) + (75 * 0.3) + (60 * 0.2) + (40 * 0.1) = 32 + 22.5 + 12 + 4 = 70.5
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'installments') {
        // 10 installments, 8 paid on time (80% punctuality = 80 score)
        const installments = Array.from({ length: 10 }, (_, i) => ({
          id: `inst-${i}`,
          amount: 100,
          due_date: new Date(today.getTime() - (i + 1) * 15 * 24 * 60 * 60 * 1000).toISOString(),
          paid_amount: 100,
          status: 'PAID',
          paid_at: i < 8 
            ? new Date(today.getTime() - (i + 1) * 15 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000).toISOString() // On time
            : new Date(today.getTime() - (i + 1) * 15 * 24 * 60 * 60 * 1000 + 5 * 24 * 60 * 60 * 1000).toISOString(), // Late
          credit_plans: { client_id: 'client-1' }
        }))
        
        return {
          ...mockSupabase,
          eq: jest.fn().mockResolvedValue({ data: installments, error: null })
        }
      }
      if (table === 'sales') {
        // 15 purchases over 4 months (3.75 per month * 20 = 75 score)
        const purchases = Array.from({ length: 15 }, (_, i) => ({
          id: `sale-${i}`,
          total: 600, // 15 * 600 = 9000 / 100 = 90 (capped at 100, but weight is only 20%)
          created_at: new Date(fourMonthsAgo.getTime() + i * 8 * 24 * 60 * 60 * 1000).toISOString()
        }))
        
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: purchases, error: null })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { id: 'client-1', name: 'Good Client', created_at: fourMonthsAgo.toISOString() },
            error: null 
          })
        }
      }
      return mockSupabase
    })
    
    const rating = await calculateClientRating('client-1')
    
    expect(rating.rating).toBe(RatingCategory.B)
    expect(rating.score).toBeGreaterThanOrEqual(70)
    expect(rating.score).toBeLessThan(90)
  })
  
  it('should assign rating category C for score between 50-69', async () => {
    const today = new Date()
    const threeMonthsAgo = new Date(today)
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    
    // Mock data for regular client (C rating)
    // Target: 60 score = (60 * 0.4) + (60 * 0.3) + (50 * 0.2) + (50 * 0.1) = 24 + 18 + 10 + 5 = 57
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'installments') {
        // 10 installments, 6 paid on time (60% punctuality = 60 score)
        const installments = Array.from({ length: 10 }, (_, i) => ({
          id: `inst-${i}`,
          amount: 100,
          due_date: new Date(today.getTime() - (i + 1) * 10 * 24 * 60 * 60 * 1000).toISOString(),
          paid_amount: 100,
          status: 'PAID',
          paid_at: i < 6 
            ? new Date(today.getTime() - (i + 1) * 10 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000).toISOString() // On time
            : new Date(today.getTime() - (i + 1) * 10 * 24 * 60 * 60 * 1000 + 10 * 24 * 60 * 60 * 1000).toISOString(), // Late
          credit_plans: { client_id: 'client-1' }
        }))
        
        return {
          ...mockSupabase,
          eq: jest.fn().mockResolvedValue({ data: installments, error: null })
        }
      }
      if (table === 'sales') {
        // 9 purchases over 3 months (3 per month * 20 = 60 score)
        const purchases = Array.from({ length: 9 }, (_, i) => ({
          id: `sale-${i}`,
          total: 550, // 9 * 550 = 4950 / 100 = 49.5 (close to 50 score)
          created_at: new Date(threeMonthsAgo.getTime() + i * 10 * 24 * 60 * 60 * 1000).toISOString()
        }))
        
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: purchases, error: null })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { id: 'client-1', name: 'Regular Client', created_at: threeMonthsAgo.toISOString() },
            error: null 
          })
        }
      }
      return mockSupabase
    })
    
    const rating = await calculateClientRating('client-1')
    
    expect(rating.rating).toBe(RatingCategory.C)
    expect(rating.score).toBeGreaterThanOrEqual(50)
    expect(rating.score).toBeLessThan(70)
  })
  
  it('should include last_calculated timestamp', async () => {
    // Mock minimal data
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'installments') {
        return {
          ...mockSupabase,
          eq: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'sales') {
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { id: 'client-1', name: 'Test Client', created_at: new Date().toISOString() },
            error: null 
          })
        }
      }
      return mockSupabase
    })
    
    const beforeCalculation = new Date()
    const rating = await calculateClientRating('client-1')
    const afterCalculation = new Date()
    
    expect(rating.last_calculated).toBeInstanceOf(Date)
    expect(rating.last_calculated.getTime()).toBeGreaterThanOrEqual(beforeCalculation.getTime())
    expect(rating.last_calculated.getTime()).toBeLessThanOrEqual(afterCalculation.getTime())
  })
  
  it('should handle partial payments correctly in punctuality calculation', async () => {
    const today = new Date()
    const twoMonthsAgo = new Date(today)
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
    
    // Mock data with partial payments
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'installments') {
        const installments = [
          {
            id: 'inst-1',
            amount: 100,
            due_date: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            paid_amount: 50,
            status: 'PARTIAL',
            paid_at: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000).toISOString(), // On time
            credit_plans: { client_id: 'client-1' }
          }
        ]
        
        return {
          ...mockSupabase,
          eq: jest.fn().mockResolvedValue({ data: installments, error: null })
        }
      }
      if (table === 'sales') {
        const purchases = [
          {
            id: 'sale-1',
            total: 200,
            created_at: twoMonthsAgo.toISOString()
          }
        ]
        
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: purchases, error: null })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { id: 'client-1', name: 'Partial Payment Client', created_at: twoMonthsAgo.toISOString() },
            error: null 
          })
        }
      }
      return mockSupabase
    })
    
    const rating = await calculateClientRating('client-1')
    
    // Partial payment should count as paid on time if paid_at is before due_date
    expect(rating.payment_punctuality).toBe(100)
  })

  /**
   * Edge Case Tests for Rating Calculation
   * 
   * **Validates: Requirements 2.10**
   * 
   * These tests verify specific edge cases in the rating calculation:
   * - New client with no purchases
   * - Client with perfect payment history
   * - Client with all late payments
   * - Client with mixed payment history
   */
  describe('Edge Cases', () => {
    it('should handle new client with no purchases (default C/50)', async () => {
      // Mock empty data for brand new client
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'installments') {
          return {
            ...mockSupabase,
            eq: jest.fn().mockResolvedValue({ data: [], error: null })
          }
        }
        if (table === 'sales') {
          return {
            ...mockSupabase,
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [], error: null })
          }
        }
        if (table === 'clients') {
          return {
            ...mockSupabase,
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ 
              data: { 
                id: 'new-client-1', 
                name: 'Brand New Client', 
                created_at: new Date().toISOString() 
              },
              error: null 
            })
          }
        }
        return mockSupabase
      })
      
      const rating = await calculateClientRating('new-client-1')
      
      // Verify default rating for new client
      expect(rating.rating).toBe(RatingCategory.C)
      expect(rating.score).toBe(50)
      expect(rating.payment_punctuality).toBe(50)
      expect(rating.purchase_frequency).toBe(50)
      expect(rating.total_purchases).toBe(0)
      expect(rating.client_tenure_days).toBe(0)
      expect(rating.last_calculated).toBeInstanceOf(Date)
    })

    it('should handle client with perfect payment history (100% on time)', async () => {
      const today = new Date()
      const oneYearAgo = new Date(today)
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      
      // Mock data for client with perfect payment history
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'installments') {
          // 20 installments, all paid exactly on or before due date
          const installments = Array.from({ length: 20 }, (_, i) => ({
            id: `inst-${i}`,
            amount: 200,
            due_date: new Date(today.getTime() - (i + 1) * 18 * 24 * 60 * 60 * 1000).toISOString(),
            paid_amount: 200,
            status: 'PAID',
            // Paid 1-3 days before due date
            paid_at: new Date(today.getTime() - (i + 1) * 18 * 24 * 60 * 60 * 1000 - (i % 3 + 1) * 24 * 60 * 60 * 1000).toISOString(),
            credit_plans: { client_id: 'perfect-client-1' }
          }))
          
          return {
            ...mockSupabase,
            eq: jest.fn().mockResolvedValue({ data: installments, error: null })
          }
        }
        if (table === 'sales') {
          // 50 purchases over 1 year (high frequency)
          const purchases = Array.from({ length: 50 }, (_, i) => ({
            id: `sale-${i}`,
            total: 800,
            created_at: new Date(oneYearAgo.getTime() + i * 7 * 24 * 60 * 60 * 1000).toISOString()
          }))
          
          return {
            ...mockSupabase,
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: purchases, error: null })
          }
        }
        if (table === 'clients') {
          return {
            ...mockSupabase,
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ 
              data: { 
                id: 'perfect-client-1', 
                name: 'Perfect Payment Client', 
                created_at: oneYearAgo.toISOString() 
              },
              error: null 
            })
          }
        }
        return mockSupabase
      })
      
      const rating = await calculateClientRating('perfect-client-1')
      
      // Verify perfect payment punctuality
      expect(rating.payment_punctuality).toBe(100)
      expect(rating.rating).toBe(RatingCategory.A)
      expect(rating.score).toBeGreaterThanOrEqual(90)
      expect(rating.total_purchases).toBe(50)
    })

    it('should handle client with all late payments (0% on time)', async () => {
      const today = new Date()
      const oneYearAgo = new Date(today)
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      
      // Mock data for client with all late payments
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'installments') {
          // 10 installments, all paid late (15-45 days after due date)
          const installments = Array.from({ length: 10 }, (_, i) => ({
            id: `inst-${i}`,
            amount: 150,
            due_date: new Date(today.getTime() - (i + 1) * 36 * 24 * 60 * 60 * 1000).toISOString(),
            paid_amount: 150,
            status: 'PAID',
            // Paid 15-45 days late
            paid_at: new Date(today.getTime() - (i + 1) * 36 * 24 * 60 * 60 * 1000 + (15 + i * 3) * 24 * 60 * 60 * 1000).toISOString(),
            credit_plans: { client_id: 'late-client-1' }
          }))
          
          return {
            ...mockSupabase,
            eq: jest.fn().mockResolvedValue({ data: installments, error: null })
          }
        }
        if (table === 'sales') {
          // Only 3 purchases in a year (very low frequency)
          const purchases = [
            {
              id: 'sale-1',
              total: 150,
              created_at: oneYearAgo.toISOString()
            },
            {
              id: 'sale-2',
              total: 150,
              created_at: new Date(oneYearAgo.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 'sale-3',
              total: 150,
              created_at: new Date(oneYearAgo.getTime() + 240 * 24 * 60 * 60 * 1000).toISOString()
            }
          ]
          
          return {
            ...mockSupabase,
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: purchases, error: null })
          }
        }
        if (table === 'clients') {
          return {
            ...mockSupabase,
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ 
              data: { 
                id: 'late-client-1', 
                name: 'Always Late Client', 
                created_at: oneYearAgo.toISOString() 
              },
              error: null 
            })
          }
        }
        return mockSupabase
      })
      
      const rating = await calculateClientRating('late-client-1')
      
      // Verify all late payments result in 0% punctuality
      expect(rating.payment_punctuality).toBe(0)
      expect(rating.rating).toBe(RatingCategory.D)
      expect(rating.score).toBeLessThan(50)
      expect(rating.total_purchases).toBe(3)
    })

    it('should handle client with mixed payment history (some on time, some late)', async () => {
      const today = new Date()
      const sixMonthsAgo = new Date(today)
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      
      // Mock data for client with mixed payment history
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'installments') {
          // 12 installments: 7 on time, 5 late (58.3% on time)
          const installments = Array.from({ length: 12 }, (_, i) => {
            const isOnTime = i < 7
            const dueDate = new Date(today.getTime() - (i + 1) * 15 * 24 * 60 * 60 * 1000)
            
            return {
              id: `inst-${i}`,
              amount: 250,
              due_date: dueDate.toISOString(),
              paid_amount: 250,
              status: 'PAID',
              paid_at: isOnTime
                ? new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days early
                : new Date(dueDate.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days late
              credit_plans: { client_id: 'mixed-client-1' }
            }
          })
          
          return {
            ...mockSupabase,
            eq: jest.fn().mockResolvedValue({ data: installments, error: null })
          }
        }
        if (table === 'sales') {
          // 18 purchases over 6 months (3 per month)
          const purchases = Array.from({ length: 18 }, (_, i) => ({
            id: `sale-${i}`,
            total: 400,
            created_at: new Date(sixMonthsAgo.getTime() + i * 10 * 24 * 60 * 60 * 1000).toISOString()
          }))
          
          return {
            ...mockSupabase,
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: purchases, error: null })
          }
        }
        if (table === 'clients') {
          return {
            ...mockSupabase,
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ 
              data: { 
                id: 'mixed-client-1', 
                name: 'Mixed Payment Client', 
                created_at: sixMonthsAgo.toISOString() 
              },
              error: null 
            })
          }
        }
        return mockSupabase
      })
      
      const rating = await calculateClientRating('mixed-client-1')
      
      // Verify mixed payment history results in moderate rating
      expect(rating.payment_punctuality).toBeGreaterThan(50)
      expect(rating.payment_punctuality).toBeLessThan(70)
      expect(rating.rating).toBeOneOf([RatingCategory.C, RatingCategory.B])
      expect(rating.score).toBeGreaterThanOrEqual(50)
      expect(rating.score).toBeLessThan(90)
      expect(rating.total_purchases).toBe(18)
    })
  })

  /**
   * Property-Based Tests for calculateClientRating function
   * 
   * Uses fast-check to verify universal properties that must hold
   * for all valid inputs to the rating calculation system.
   * 
   * Properties tested:
   * 1. Rating Score Range Invariant - scores always between 0-100
   * 2. Rating Category Assignment - categories correctly assigned based on score
   */

  describe('Property-Based Tests', () => {
  /**
   * Property 1: Rating Score Range Invariant
   * 
   * **Validates: Requirements 2.1**
   * 
   * For any client in the system, when the rating is calculated,
   * the score must be between 0 and 100 inclusive.
   */
  it('Property 1: Rating score must always be between 0 and 100 inclusive', async () => {
    // Generator for client data with various scenarios
    const clientDataArbitrary = fc.record({
      clientId: fc.uuid(),
      installments: fc.array(
        fc.record({
          id: fc.uuid(),
          amount: fc.integer({ min: 1, max: 10000 }),
          due_date: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
          paid_amount: fc.integer({ min: 0, max: 10000 }),
          status: fc.constantFrom('PAID', 'PARTIAL', 'PENDING', 'OVERDUE'),
          paid_at: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() }), { nil: null }),
          credit_plans: fc.record({ client_id: fc.uuid() })
        }),
        { minLength: 0, maxLength: 50 }
      ),
      purchases: fc.array(
        fc.record({
          id: fc.uuid(),
          total: fc.integer({ min: 0, max: 100000 }),
          created_at: fc.date({ min: new Date('2020-01-01'), max: new Date() })
        }),
        { minLength: 0, maxLength: 100 }
      ),
      client: fc.record({
        id: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 100 }),
        created_at: fc.date({ min: new Date('2020-01-01'), max: new Date() })
      })
    })

    await fc.assert(
      fc.asyncProperty(clientDataArbitrary, async (data) => {
        // Filter out invalid dates
        const validInstallments = data.installments.filter(inst => 
          !isNaN(inst.due_date.getTime()) && 
          (!inst.paid_at || !isNaN(inst.paid_at.getTime()))
        )
        const validPurchases = data.purchases.filter(p => !isNaN(p.created_at.getTime()))
        
        // Skip test if client has invalid date
        if (isNaN(data.client.created_at.getTime())) {
          return true // Skip this test case
        }
        
        // Setup mock with generated data
        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'installments') {
            return {
              ...mockSupabase,
              eq: jest.fn().mockResolvedValue({ 
                data: validInstallments.map(inst => ({
                  ...inst,
                  due_date: inst.due_date.toISOString(),
                  paid_at: inst.paid_at ? inst.paid_at.toISOString() : null,
                  credit_plans: { client_id: data.clientId }
                })), 
                error: null 
              })
            }
          }
          if (table === 'sales') {
            return {
              ...mockSupabase,
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({ 
                data: validPurchases
                  .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
                  .map(p => ({
                    ...p,
                    created_at: p.created_at.toISOString()
                  })), 
                error: null 
              })
            }
          }
          if (table === 'clients') {
            return {
              ...mockSupabase,
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: {
                  ...data.client,
                  created_at: data.client.created_at.toISOString()
                },
                error: null 
              })
            }
          }
          return mockSupabase
        })

        // Execute the function
        const rating = await calculateClientRating(data.clientId)

        // Verify the property: score must be between 0 and 100 inclusive
        expect(rating.score).toBeGreaterThanOrEqual(0)
        expect(rating.score).toBeLessThanOrEqual(100)
      }),
      { numRuns: 100 } // Run 100 random test cases
    )
  })

  /**
   * Property 2: Rating Category Assignment
   * 
   * **Validates: Requirements 2.6, 2.7, 2.8, 2.9**
   * 
   * For any calculated rating score, the assigned category must be:
   * - 'A' if score >= 90
   * - 'B' if score >= 70
   * - 'C' if score >= 50
   * - 'D' if score < 50
   */
  it('Property 2: Rating category must be correctly assigned based on score', async () => {
    // Generator for client data with various scenarios
    const clientDataArbitrary = fc.record({
      clientId: fc.uuid(),
      installments: fc.array(
        fc.record({
          id: fc.uuid(),
          amount: fc.integer({ min: 1, max: 10000 }),
          due_date: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
          paid_amount: fc.integer({ min: 0, max: 10000 }),
          status: fc.constantFrom('PAID', 'PARTIAL', 'PENDING', 'OVERDUE'),
          paid_at: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() }), { nil: null }),
          credit_plans: fc.record({ client_id: fc.uuid() })
        }),
        { minLength: 0, maxLength: 50 }
      ),
      purchases: fc.array(
        fc.record({
          id: fc.uuid(),
          total: fc.integer({ min: 0, max: 100000 }),
          created_at: fc.date({ min: new Date('2020-01-01'), max: new Date() })
        }),
        { minLength: 0, maxLength: 100 }
      ),
      client: fc.record({
        id: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 100 }),
        created_at: fc.date({ min: new Date('2020-01-01'), max: new Date() })
      })
    })

    await fc.assert(
      fc.asyncProperty(clientDataArbitrary, async (data) => {
        // Filter out invalid dates
        const validInstallments = data.installments.filter(inst => 
          !isNaN(inst.due_date.getTime()) && 
          (!inst.paid_at || !isNaN(inst.paid_at.getTime()))
        )
        const validPurchases = data.purchases.filter(p => !isNaN(p.created_at.getTime()))
        
        // Skip test if client has invalid date
        if (isNaN(data.client.created_at.getTime())) {
          return true // Skip this test case
        }
        
        // Setup mock with generated data
        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'installments') {
            return {
              ...mockSupabase,
              eq: jest.fn().mockResolvedValue({ 
                data: validInstallments.map(inst => ({
                  ...inst,
                  due_date: inst.due_date.toISOString(),
                  paid_at: inst.paid_at ? inst.paid_at.toISOString() : null,
                  credit_plans: { client_id: data.clientId }
                })), 
                error: null 
              })
            }
          }
          if (table === 'sales') {
            return {
              ...mockSupabase,
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({ 
                data: validPurchases
                  .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
                  .map(p => ({
                    ...p,
                    created_at: p.created_at.toISOString()
                  })), 
                error: null 
              })
            }
          }
          if (table === 'clients') {
            return {
              ...mockSupabase,
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: {
                  ...data.client,
                  created_at: data.client.created_at.toISOString()
                },
                error: null 
              })
            }
          }
          return mockSupabase
        })

        // Execute the function
        const rating = await calculateClientRating(data.clientId)

        // Verify the property: category assignment based on score
        if (rating.score >= 90) {
          expect(rating.rating).toBe(RatingCategory.A)
        } else if (rating.score >= 70) {
          expect(rating.rating).toBe(RatingCategory.B)
        } else if (rating.score >= 50) {
          expect(rating.rating).toBe(RatingCategory.C)
        } else {
          expect(rating.rating).toBe(RatingCategory.D)
        }
      }),
      { numRuns: 100 } // Run 100 random test cases
    )
  })
  })
})
