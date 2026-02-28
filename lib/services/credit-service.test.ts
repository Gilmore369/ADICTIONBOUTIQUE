/**
 * Unit Tests for Credit Service
 * 
 * Tests specific examples and edge cases for credit validation:
 * - Validation with amount within limit
 * - Validation with amount exceeding limit
 * - credit_used update after payment
 * 
 * Requirements: 10.1, 10.2, 10.3
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { validateCreditLimit, updateCreditUsed } from './credit-service'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('validateCreditLimit - Unit Tests', () => {
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
   * Test validation with amount within limit
   * Requirements: 10.1
   */
  it('validates successfully when purchase is within credit limit', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const creditLimit = 10000
    const creditUsed = 5000
    const newPurchaseAmount = 3000 // Within limit (5000 + 3000 = 8000 < 10000)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              credit_limit: creditLimit,
              credit_used: creditUsed,
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
    
    expect(result.isValid).toBe(true)
    expect(result.availableCredit).toBe(5000) // 10000 - 5000
    expect(result.message).toBeUndefined()
  })
  
  /**
   * Test validation with amount exceeding limit
   * Requirements: 10.2
   */
  it('rejects purchase when amount exceeds credit limit', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const creditLimit = 10000
    const creditUsed = 5000
    const newPurchaseAmount = 6000 // Exceeds limit (5000 + 6000 = 11000 > 10000)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              credit_limit: creditLimit,
              credit_used: creditUsed,
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
    
    expect(result.isValid).toBe(false)
    expect(result.availableCredit).toBe(5000) // 10000 - 5000
    expect(result.message).toBeTruthy()
    expect(result.message).toContain('Crédito insuficiente')
    expect(result.message).toContain('5000.00')
  })
  
  /**
   * Test validation at exact credit limit
   * Requirements: 10.1
   */
  it('validates successfully when purchase exactly reaches credit limit', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const creditLimit = 10000
    const creditUsed = 5000
    const newPurchaseAmount = 5000 // Exactly at limit (5000 + 5000 = 10000)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              credit_limit: creditLimit,
              credit_used: creditUsed,
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
    
    expect(result.isValid).toBe(true)
    expect(result.availableCredit).toBe(5000)
  })
  
  /**
   * Test validation for inactive client
   * Requirements: 10.1
   */
  it('rejects purchase for inactive client', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const creditLimit = 10000
    const creditUsed = 0
    const newPurchaseAmount = 1000
    
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
    
    expect(result.isValid).toBe(false)
    expect(result.availableCredit).toBe(0)
    expect(result.message).toContain('inactivo')
  })
  
  /**
   * Test validation with client at full credit usage
   * Requirements: 10.2
   */
  it('rejects purchase when client has used full credit limit', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const creditLimit = 10000
    const creditUsed = 10000 // Full credit used
    const newPurchaseAmount = 100
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              credit_limit: creditLimit,
              credit_used: creditUsed,
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
    
    expect(result.isValid).toBe(false)
    expect(result.availableCredit).toBe(0)
    expect(result.message).toContain('Crédito insuficiente')
  })
  
  /**
   * Test error handling for non-existent client
   * Requirements: 10.1
   */
  it('throws error when client does not exist', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const newPurchaseAmount = 1000
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Client not found' },
          }),
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
    
    await expect(validateCreditLimit(clientId, newPurchaseAmount)).rejects.toThrow(
      'Client not found'
    )
  })
})

describe('updateCreditUsed - Unit Tests', () => {
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
   * Test credit_used update after payment
   * Requirements: 10.3
   */
  it('updates credit_used after payment and returns available credit', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const creditLimit = 10000
    const oldCreditUsed = 5000
    const newCreditUsed = 3000 // After payment of 2000
    
    let updatedValue: number | null = null
    
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
            updatedValue = data.credit_used
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
    
    const availableCredit = await updateCreditUsed(clientId, newCreditUsed)
    
    expect(updatedValue).toBe(3000)
    expect(availableCredit).toBe(7000) // 10000 - 3000
  })
  
  /**
   * Test credit_used update to zero (full payment)
   * Requirements: 10.3
   */
  it('updates credit_used to zero after full payment', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const creditLimit = 10000
    const newCreditUsed = 0 // Full payment
    
    let updatedValue: number | null = null
    
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
            updatedValue = data.credit_used
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
    
    const availableCredit = await updateCreditUsed(clientId, newCreditUsed)
    
    expect(updatedValue).toBe(0)
    expect(availableCredit).toBe(10000) // Full credit available
  })
  
  /**
   * Test rejection of negative credit_used
   * Requirements: 10.3
   */
  it('rejects negative credit_used value', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const negativeCreditUsed = -1000
    
    await expect(updateCreditUsed(clientId, negativeCreditUsed)).rejects.toThrow(
      'credit_used cannot be negative'
    )
  })
  
  /**
   * Test rejection of credit_used exceeding limit
   * Requirements: 10.3
   */
  it('rejects credit_used exceeding credit_limit', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const creditLimit = 10000
    const exceedingCreditUsed = 15000
    
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
    
    await expect(updateCreditUsed(clientId, exceedingCreditUsed)).rejects.toThrow(
      'cannot exceed credit_limit'
    )
  })
  
  /**
   * Test error handling for non-existent client
   * Requirements: 10.3
   */
  it('throws error when client does not exist', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const newCreditUsed = 1000
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Client not found' },
          }),
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
    
    await expect(updateCreditUsed(clientId, newCreditUsed)).rejects.toThrow('Client not found')
  })
})
