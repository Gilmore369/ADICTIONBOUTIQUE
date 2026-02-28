/**
 * Property-Based Tests for Credit Service
 * 
 * Tests universal properties that must hold for all valid inputs:
 * - Property 4: Credit Limit Enforcement
 * 
 * Uses fast-check library for property-based testing
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import * as fc from 'fast-check'
import { validateCreditLimit, updateCreditUsed } from './credit-service'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('validateCreditLimit - Property-Based Tests', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = {
      from: jest.fn(),
    }
    
    const { createClient } = require('@/lib/supabase/server')
    createClient.mockResolvedValue(mockSupabase)
  })
  
  /**
   * Property 4: Credit Limit Enforcement
   * **Validates: Requirements 10.1, 10.2**
   * 
   * For any active client attempting a credit purchase, if credit used plus
   * purchase amount exceeds credit limit, the purchase must be rejected.
   */
  it('Property 4: rejects purchases that exceed credit limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          creditLimit: fc.float({ min: 1000, max: 100000, noNaN: true }),
          creditUsed: fc.float({ min: 0, max: 50000, noNaN: true }),
          newPurchaseAmount: fc.float({ min: 100, max: 100000, noNaN: true }),
        }),
        async ({ clientId, creditLimit, creditUsed, newPurchaseAmount }) => {
          // Ensure creditUsed doesn't exceed creditLimit
          const actualCreditUsed = Math.min(creditUsed, creditLimit)
          
          // Mock client data
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    credit_limit: creditLimit,
                    credit_used: actualCreditUsed,
                    active: true,
                  },
                  error: null,
                }),
              }
            }
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const result = await validateCreditLimit(clientId, newPurchaseAmount)
          
          const availableCredit = creditLimit - actualCreditUsed
          const wouldExceedLimit = actualCreditUsed + newPurchaseAmount > creditLimit
          
          // Property 1: If purchase would exceed limit, validation must fail
          if (wouldExceedLimit) {
            expect(result.isValid).toBe(false)
            expect(result.message).toBeTruthy()
            expect(result.message).toContain('Crédito insuficiente')
          } else {
            // Property 2: If purchase is within limit, validation must succeed
            expect(result.isValid).toBe(true)
            expect(result.message).toBeUndefined()
          }
          
          // Property 3: Available credit must always equal credit_limit - credit_used
          expect(result.availableCredit).toBeCloseTo(availableCredit, 2)
          
          // Property 4: Available credit must never be negative
          expect(result.availableCredit).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * Additional Property Test: Inactive clients cannot make purchases
   * 
   * For any inactive client, credit validation must always fail regardless
   * of credit limit or purchase amount.
   */
  it('Property: inactive clients always fail validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          creditLimit: fc.float({ min: 1000, max: 100000, noNaN: true }),
          creditUsed: fc.float({ min: 0, max: 50000, noNaN: true }),
          newPurchaseAmount: fc.float({ min: 100, max: 10000, noNaN: true }),
        }),
        async ({ clientId, creditLimit, creditUsed, newPurchaseAmount }) => {
          // Mock inactive client
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    credit_limit: creditLimit,
                    credit_used: creditUsed,
                    active: false, // Inactive client
                  },
                  error: null,
                }),
              }
            }
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const result = await validateCreditLimit(clientId, newPurchaseAmount)
          
          // Property: Inactive clients must always fail validation
          expect(result.isValid).toBe(false)
          expect(result.availableCredit).toBe(0)
          expect(result.message).toContain('inactivo')
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * Additional Property Test: Zero purchase amount is always valid
   * 
   * For any active client with available credit, a purchase of 0 amount
   * should always be valid (edge case).
   */
  it('Property: zero purchase amount is always valid for active clients', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          creditLimit: fc.float({ min: 1000, max: 100000, noNaN: true }),
          creditUsed: fc.float({ min: 0, max: 50000, noNaN: true }),
        }),
        async ({ clientId, creditLimit, creditUsed }) => {
          const actualCreditUsed = Math.min(creditUsed, creditLimit)
          
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    credit_limit: creditLimit,
                    credit_used: actualCreditUsed,
                    active: true,
                  },
                  error: null,
                }),
              }
            }
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const result = await validateCreditLimit(clientId, 0)
          
          // Property: Zero amount should always be valid
          expect(result.isValid).toBe(true)
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('updateCreditUsed - Property-Based Tests', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = {
      from: jest.fn(),
    }
    
    const { createClient } = require('@/lib/supabase/server')
    createClient.mockResolvedValue(mockSupabase)
  })
  
  /**
   * Property Test: Available credit calculation after update
   * **Validates: Requirements 10.3, 10.4**
   * 
   * For any credit update, the returned available credit must equal
   * credit_limit - new_credit_used.
   */
  it('Property: available credit equals credit_limit minus credit_used', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          creditLimit: fc.float({ min: 1000, max: 100000, noNaN: true }),
          newCreditUsed: fc.float({ min: 0, max: 50000, noNaN: true }),
        }),
        async ({ clientId, creditLimit, newCreditUsed }) => {
          // Ensure newCreditUsed doesn't exceed creditLimit
          const actualNewCreditUsed = Math.min(newCreditUsed, creditLimit)
          
          let updatedCreditUsed: number | null = null
          
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    credit_limit: creditLimit,
                  },
                  error: null,
                }),
                update: jest.fn().mockImplementation((data: any) => {
                  updatedCreditUsed = data.credit_used
                  return {
                    eq: jest.fn().mockResolvedValue({
                      data: { credit_used: data.credit_used },
                      error: null,
                    }),
                  }
                }),
              }
            }
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const availableCredit = await updateCreditUsed(clientId, actualNewCreditUsed)
          
          // Property 1: Available credit must equal credit_limit - credit_used
          const expectedAvailable = creditLimit - actualNewCreditUsed
          expect(availableCredit).toBeCloseTo(expectedAvailable, 2)
          
          // Property 2: credit_used must have been updated
          expect(updatedCreditUsed).toBe(actualNewCreditUsed)
          
          // Property 3: Available credit must never be negative
          expect(availableCredit).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * Property Test: Negative credit_used is rejected
   * 
   * For any negative credit_used value, the update must be rejected.
   */
  it('Property: negative credit_used is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          creditLimit: fc.float({ min: 1000, max: 100000, noNaN: true }),
          negativeCreditUsed: fc.float({ min: Math.fround(-10000), max: Math.fround(-0.01), noNaN: true }),
        }),
        async ({ clientId, creditLimit, negativeCreditUsed }) => {
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    credit_limit: creditLimit,
                  },
                  error: null,
                }),
              }
            }
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          // Property: Negative credit_used must throw error
          await expect(updateCreditUsed(clientId, negativeCreditUsed)).rejects.toThrow(
            'credit_used cannot be negative'
          )
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * Property Test: credit_used exceeding credit_limit is rejected
   * 
   * For any credit_used value exceeding credit_limit, the update must be rejected.
   */
  it('Property: credit_used exceeding credit_limit is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          creditLimit: fc.float({ min: 1000, max: 100000, noNaN: true }),
          excessAmount: fc.float({ min: Math.fround(0.01), max: 50000, noNaN: true }),
        }),
        async ({ clientId, creditLimit, excessAmount }) => {
          const exceedingCreditUsed = creditLimit + excessAmount
          
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    credit_limit: creditLimit,
                  },
                  error: null,
                }),
              }
            }
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          // Property: credit_used exceeding limit must throw error
          await expect(updateCreditUsed(clientId, exceedingCreditUsed)).rejects.toThrow(
            'cannot exceed credit_limit'
          )
        }
      ),
      { numRuns: 50 }
    )
  })
})
