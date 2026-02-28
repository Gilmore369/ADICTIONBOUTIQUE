/**
 * Unit tests for fetchClientProfile function
 * 
 * Tests the client profile fetching logic for:
 * - Parallel data fetching with Promise.all
 * - Credit summary calculation
 * - Installments sorted by due date (ascending)
 * - Purchase history sorted by date (descending)
 * - Days overdue calculation for installments
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { fetchClientProfile } from './client-service'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))

describe('fetchClientProfile', () => {
  let mockSupabase: any
  
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
  
  it('should fetch complete client profile with all related data', async () => {
    const clientId = 'client-123'
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    // Mock all database queries
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              credit_limit: 10000,
              credit_used: 3000,
              active: true,
            },
            error: null,
          }),
        }
      }
      
      if (table === 'sales') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'sale-1',
                sale_number: 'S001',
                created_at: today.toISOString(),
                total: 1000,
                sale_type: 'CREDITO',
                payment_status: 'PENDING',
              },
              {
                id: 'sale-2',
                sale_number: 'S002',
                created_at: yesterday.toISOString(),
                total: 500,
                sale_type: 'CONTADO',
                payment_status: 'PAID',
              },
            ],
            error: null,
          }),
        }
      }
      
      if (table === 'credit_plans') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'plan-1',
                client_id: clientId,
                sale_number: 'S001',
                total_amount: 1000,
                created_at: today.toISOString(),
              },
            ],
            error: null,
          }),
        }
      }
      
      if (table === 'installments') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'inst-1',
                installment_number: 1,
                amount: 500,
                due_date: yesterday.toISOString(),
                paid_amount: 0,
                status: 'OVERDUE',
                paid_at: null,
                credit_plans: {
                  id: 'plan-1',
                  sale_number: 'S001',
                  client_id: clientId,
                },
              },
              {
                id: 'inst-2',
                installment_number: 2,
                amount: 500,
                due_date: tomorrow.toISOString(),
                paid_amount: 0,
                status: 'PENDING',
                paid_at: null,
                credit_plans: {
                  id: 'plan-1',
                  sale_number: 'S001',
                  client_id: clientId,
                },
              },
            ],
            error: null,
          }),
        }
      }
      
      if (table === 'client_action_logs') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'log-1',
                client_id: clientId,
                action_type: 'LLAMADA',
                description: 'Called client',
                user_id: 'user-1',
                created_at: today.toISOString(),
              },
            ],
            error: null,
          }),
        }
      }
      
      if (table === 'collection_actions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'action-1',
                client_id: clientId,
                action_type: 'LLAMADA',
                description: 'Follow up call',
                follow_up_date: tomorrow.toISOString(),
                completed: false,
                completed_at: null,
                user_id: 'user-1',
                created_at: today.toISOString(),
              },
            ],
            error: null,
          }),
        }
      }
      
      if (table === 'client_ratings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              client_id: clientId,
              rating: 'B',
              score: 75,
              payment_punctuality: 80,
              purchase_frequency: 70,
              total_purchases: 10,
              client_tenure_days: 180,
              last_calculated: today.toISOString(),
            },
            error: null,
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
    
    const profile = await fetchClientProfile(clientId)
    
    // Verify client data
    expect(profile.client.id).toBe(clientId)
    expect(profile.client.name).toBe('Test Client')
    
    // Verify credit summary calculations
    expect(profile.creditSummary.creditLimit).toBe(10000)
    expect(profile.creditSummary.creditUsed).toBe(3000)
    expect(profile.creditSummary.creditAvailable).toBe(7000)
    expect(profile.creditSummary.totalDebt).toBe(1000) // Both installments unpaid
    expect(profile.creditSummary.overdueDebt).toBe(500) // Only overdue installment
    expect(profile.creditSummary.pendingInstallments).toBe(2)
    expect(profile.creditSummary.overdueInstallments).toBe(1)
    
    // Verify purchase history is sorted by date descending (most recent first)
    expect(profile.purchaseHistory).toHaveLength(2)
    expect(profile.purchaseHistory[0].saleNumber).toBe('S001')
    expect(profile.purchaseHistory[1].saleNumber).toBe('S002')
    
    // Verify installments are sorted by due date ascending (earliest first)
    expect(profile.installments).toHaveLength(2)
    expect(profile.installments[0].id).toBe('inst-1') // Yesterday (overdue)
    expect(profile.installments[1].id).toBe('inst-2') // Tomorrow (pending)
    
    // Verify days overdue calculation
    expect(profile.installments[0].daysOverdue).toBe(1) // Yesterday = 1 day overdue
    expect(profile.installments[1].daysOverdue).toBe(0) // Tomorrow = not overdue
    
    // Verify other data
    expect(profile.creditHistory).toHaveLength(1)
    expect(profile.actionLogs).toHaveLength(1)
    expect(profile.collectionActions).toHaveLength(1)
    expect(profile.rating).not.toBeNull()
    expect(profile.rating?.score).toBe(75)
  })
  
  it('should handle client with no data gracefully', async () => {
    const clientId = 'client-empty'
    
    // Mock empty data for all queries
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Empty Client',
              credit_limit: 0,
              credit_used: 0,
              active: true,
            },
            error: null,
          }),
        }
      }
      
      if (table === 'client_ratings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    const profile = await fetchClientProfile(clientId)
    
    // Verify empty arrays and zero values
    expect(profile.purchaseHistory).toHaveLength(0)
    expect(profile.installments).toHaveLength(0)
    expect(profile.creditHistory).toHaveLength(0)
    expect(profile.actionLogs).toHaveLength(0)
    expect(profile.collectionActions).toHaveLength(0)
    expect(profile.rating).toBeNull()
    
    // Verify credit summary with zeros
    expect(profile.creditSummary.creditLimit).toBe(0)
    expect(profile.creditSummary.creditUsed).toBe(0)
    expect(profile.creditSummary.creditAvailable).toBe(0)
    expect(profile.creditSummary.totalDebt).toBe(0)
    expect(profile.creditSummary.overdueDebt).toBe(0)
  })
  
  it('should throw error when client is not found', async () => {
    const clientId = 'non-existent'
    
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
      
      if (table === 'client_ratings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    await expect(fetchClientProfile(clientId)).rejects.toThrow('Failed to fetch client')
  })
  
  it('should calculate credit summary correctly with partial payments', async () => {
    const clientId = 'client-partial'
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Partial Payment Client',
              credit_limit: 5000,
              credit_used: 2000,
              active: true,
            },
            error: null,
          }),
        }
      }
      
      if (table === 'installments') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'inst-1',
                installment_number: 1,
                amount: 1000,
                due_date: yesterday.toISOString(),
                paid_amount: 500, // Partial payment
                status: 'PARTIAL',
                paid_at: null,
                credit_plans: {
                  id: 'plan-1',
                  sale_number: 'S001',
                  client_id: clientId,
                },
              },
              {
                id: 'inst-2',
                installment_number: 2,
                amount: 1000,
                due_date: today.toISOString(),
                paid_amount: 1000, // Fully paid
                status: 'PAID',
                paid_at: today.toISOString(),
                credit_plans: {
                  id: 'plan-1',
                  sale_number: 'S001',
                  client_id: clientId,
                },
              },
            ],
            error: null,
          }),
        }
      }
      
      if (table === 'client_ratings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    const profile = await fetchClientProfile(clientId)
    
    // Verify credit summary with partial payments
    expect(profile.creditSummary.creditLimit).toBe(5000)
    expect(profile.creditSummary.creditUsed).toBe(2000)
    expect(profile.creditSummary.creditAvailable).toBe(3000)
    
    // Total debt should only include unpaid portion of partial payment
    expect(profile.creditSummary.totalDebt).toBe(500) // 1000 - 500 paid
    
    // Overdue debt should be the unpaid portion of the overdue installment
    expect(profile.creditSummary.overdueDebt).toBe(500)
    
    // Pending installments should count PARTIAL status
    expect(profile.creditSummary.pendingInstallments).toBe(1)
    expect(profile.creditSummary.overdueInstallments).toBe(1)
  })
  
  it('should handle credit summary with all paid installments', async () => {
    const clientId = 'client-paid'
    const today = new Date()
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Paid Client',
              credit_limit: 10000,
              credit_used: 0, // All paid off
              active: true,
            },
            error: null,
          }),
        }
      }
      
      if (table === 'installments') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'inst-1',
                installment_number: 1,
                amount: 1000,
                due_date: today.toISOString(),
                paid_amount: 1000,
                status: 'PAID',
                paid_at: today.toISOString(),
                credit_plans: {
                  id: 'plan-1',
                  sale_number: 'S001',
                  client_id: clientId,
                },
              },
            ],
            error: null,
          }),
        }
      }
      
      if (table === 'client_ratings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    const profile = await fetchClientProfile(clientId)
    
    // Verify credit summary with all paid installments
    expect(profile.creditSummary.creditLimit).toBe(10000)
    expect(profile.creditSummary.creditUsed).toBe(0)
    expect(profile.creditSummary.creditAvailable).toBe(10000)
    expect(profile.creditSummary.totalDebt).toBe(0)
    expect(profile.creditSummary.overdueDebt).toBe(0)
    expect(profile.creditSummary.pendingInstallments).toBe(0)
    expect(profile.creditSummary.overdueInstallments).toBe(0)
  })
  
  it('should correctly count OVERDUE status installments in credit summary', async () => {
    const clientId = 'client-overdue'
    const today = new Date()
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const fiveDaysAgo = new Date(today)
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Overdue Client',
              credit_limit: 10000,
              credit_used: 3000,
              active: true,
            },
            error: null,
          }),
        }
      }
      
      if (table === 'installments') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'inst-1',
                installment_number: 1,
                amount: 1000,
                due_date: fiveDaysAgo.toISOString(),
                paid_amount: 0,
                status: 'OVERDUE',
                paid_at: null,
                credit_plans: {
                  id: 'plan-1',
                  sale_number: 'S001',
                  client_id: clientId,
                },
              },
              {
                id: 'inst-2',
                installment_number: 2,
                amount: 1000,
                due_date: twoDaysAgo.toISOString(),
                paid_amount: 0,
                status: 'OVERDUE',
                paid_at: null,
                credit_plans: {
                  id: 'plan-1',
                  sale_number: 'S001',
                  client_id: clientId,
                },
              },
              {
                id: 'inst-3',
                installment_number: 3,
                amount: 1000,
                due_date: today.toISOString(),
                paid_amount: 0,
                status: 'PENDING',
                paid_at: null,
                credit_plans: {
                  id: 'plan-1',
                  sale_number: 'S001',
                  client_id: clientId,
                },
              },
            ],
            error: null,
          }),
        }
      }
      
      if (table === 'client_ratings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    const profile = await fetchClientProfile(clientId)
    
    // Verify credit summary includes OVERDUE status installments
    expect(profile.creditSummary.totalDebt).toBe(3000) // All three installments
    expect(profile.creditSummary.overdueDebt).toBe(2000) // Two overdue installments
    expect(profile.creditSummary.pendingInstallments).toBe(3) // PENDING + OVERDUE
    expect(profile.creditSummary.overdueInstallments).toBe(2) // Only overdue ones
    
    // Verify days overdue calculation
    expect(profile.installments[0].daysOverdue).toBe(5)
    expect(profile.installments[1].daysOverdue).toBe(2)
    expect(profile.installments[2].daysOverdue).toBe(0) // Due today, not overdue yet
  })
})

/**
 * Unit tests for deactivateClient function
 * 
 * Tests the client deactivation logic for:
 * - Setting active = false on clients table
 * - Creating record in client_deactivations table
 * - Validating reason is one of allowed enum values
 * - Creating audit log entry
 * - Error handling for invalid inputs
 */

import { deactivateClient } from './client-service'

describe('deactivateClient', () => {
  let mockSupabase: any
  
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
  
  it('should successfully deactivate an active client', async () => {
    const clientId = 'client-123'
    const userId = 'user-456'
    const reason = 'MUDADO'
    const notes = 'Se mudó a otra ciudad'
    
    let clientsUpdateCalled = false
    let deactivationsInsertCalled = false
    let auditLogInsertCalled = false
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              active: true,
            },
            error: null,
          }),
          update: jest.fn().mockImplementation((data: any) => {
            clientsUpdateCalled = true
            expect(data.active).toBe(false)
            expect(data.deactivation_reason).toBe(reason)
            expect(data.deactivated_by).toBe(userId)
            return {
              eq: jest.fn().mockResolvedValue({ error: null }),
            }
          }),
        }
      }
      
      if (table === 'client_deactivations') {
        return {
          insert: jest.fn().mockImplementation((data: any) => {
            deactivationsInsertCalled = true
            expect(data.client_id).toBe(clientId)
            expect(data.reason).toBe(reason)
            expect(data.notes).toBe(notes)
            expect(data.deactivated_by).toBe(userId)
            return Promise.resolve({ error: null })
          }),
        }
      }
      
      if (table === 'audit_log') {
        return {
          insert: jest.fn().mockImplementation((data: any) => {
            auditLogInsertCalled = true
            expect(data.user_id).toBe(userId)
            expect(data.operation).toBe('DEACTIVATE_CLIENT')
            expect(data.entity_type).toBe('client')
            expect(data.entity_id).toBe(clientId)
            expect(data.old_values.active).toBe(true)
            expect(data.new_values.active).toBe(false)
            expect(data.new_values.deactivation_reason).toBe(reason)
            return Promise.resolve({ error: null })
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    await deactivateClient(clientId, reason, notes, userId)
    
    expect(clientsUpdateCalled).toBe(true)
    expect(deactivationsInsertCalled).toBe(true)
    expect(auditLogInsertCalled).toBe(true)
  })
  
  it('should validate reason is one of allowed enum values', async () => {
    const clientId = 'client-123'
    const userId = 'user-456'
    const invalidReason = 'INVALID_REASON' as any
    const notes = 'Test notes'
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              active: true,
            },
            error: null,
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    await expect(
      deactivateClient(clientId, invalidReason, notes, userId)
    ).rejects.toThrow('Invalid deactivation reason')
  })
  
  it('should throw error when client is not found', async () => {
    const clientId = 'non-existent'
    const userId = 'user-456'
    const reason = 'MUDADO'
    const notes = 'Test notes'
    
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
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    await expect(
      deactivateClient(clientId, reason, notes, userId)
    ).rejects.toThrow('Client not found')
  })
  
  it('should throw error when client is already inactive', async () => {
    const clientId = 'client-123'
    const userId = 'user-456'
    const reason = 'MUDADO'
    const notes = 'Test notes'
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              active: false,
            },
            error: null,
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    await expect(
      deactivateClient(clientId, reason, notes, userId)
    ).rejects.toThrow('Client is already inactive')
  })
  
  it('should handle all valid deactivation reasons', async () => {
    const clientId = 'client-123'
    const userId = 'user-456'
    const validReasons: Array<'FALLECIDO' | 'MUDADO' | 'DESAPARECIDO' | 'OTRO'> = [
      'FALLECIDO',
      'MUDADO',
      'DESAPARECIDO',
      'OTRO',
    ]
    
    for (const reason of validReasons) {
      jest.clearAllMocks()
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: clientId,
                name: 'Test Client',
                active: true,
              },
              error: null,
            }),
            update: jest.fn().mockReturnThis(),
          }
        }
        
        if (table === 'client_deactivations') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        
        if (table === 'audit_log') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      })
      
      await expect(
        deactivateClient(clientId, reason, 'Test notes', userId)
      ).resolves.not.toThrow()
    }
  })
  
  it('should rollback client update if deactivation record creation fails', async () => {
    const clientId = 'client-123'
    const userId = 'user-456'
    const reason = 'MUDADO'
    const notes = 'Test notes'
    
    let rollbackCalled = false
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              active: true,
            },
            error: null,
          }),
          update: jest.fn().mockImplementation((data: any) => {
            if (data.active === true) {
              // This is the rollback
              rollbackCalled = true
            }
            return {
              eq: jest.fn().mockResolvedValue({ error: null }),
            }
          }),
        }
      }
      
      if (table === 'client_deactivations') {
        return {
          insert: jest.fn().mockResolvedValue({
            error: { message: 'Failed to insert deactivation record' },
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    await expect(
      deactivateClient(clientId, reason, notes, userId)
    ).rejects.toThrow('Failed to create deactivation record')
    
    expect(rollbackCalled).toBe(true)
  })
  
  it('should continue even if audit log creation fails', async () => {
    const clientId = 'client-123'
    const userId = 'user-456'
    const reason = 'MUDADO'
    const notes = 'Test notes'
    
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              active: true,
            },
            error: null,
          }),
          update: jest.fn().mockReturnThis(),
        }
      }
      
      if (table === 'client_deactivations') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        }
      }
      
      if (table === 'audit_log') {
        return {
          insert: jest.fn().mockResolvedValue({
            error: { message: 'Failed to create audit log' },
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    // Should not throw even though audit log fails
    await expect(
      deactivateClient(clientId, reason, notes, userId)
    ).resolves.not.toThrow()
    
    // Should log the error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to create audit log entry:',
      expect.any(Object)
    )
    
    consoleErrorSpy.mockRestore()
  })
  
  it('should preserve historical data when deactivating a client', async () => {
    const clientId = 'client-123'
    const userId = 'user-456'
    const reason = 'FALLECIDO'
    const notes = 'Cliente falleció'
    const today = new Date()
    
    // Mock historical data that should be preserved
    const mockPurchases = [
      {
        id: 'sale-1',
        sale_number: 'S001',
        created_at: today.toISOString(),
        total: 1000,
        sale_type: 'CREDITO',
        payment_status: 'PENDING',
      },
    ]
    
    const mockCreditPlans = [
      {
        id: 'plan-1',
        client_id: clientId,
        sale_number: 'S001',
        total_amount: 1000,
        created_at: today.toISOString(),
      },
    ]
    
    const mockInstallments = [
      {
        id: 'inst-1',
        installment_number: 1,
        amount: 500,
        due_date: today.toISOString(),
        paid_amount: 0,
        status: 'PENDING',
        paid_at: null,
        credit_plans: {
          id: 'plan-1',
          sale_number: 'S001',
          client_id: clientId,
        },
      },
    ]
    
    const mockActionLogs = [
      {
        id: 'log-1',
        client_id: clientId,
        action_type: 'LLAMADA',
        description: 'Called client',
        user_id: 'user-1',
        created_at: today.toISOString(),
      },
    ]
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              active: true,
              credit_limit: 10000,
              credit_used: 1000,
            },
            error: null,
          }),
          update: jest.fn().mockReturnThis(),
        }
      }
      
      if (table === 'sales') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: mockPurchases,
            error: null,
          }),
        }
      }
      
      if (table === 'credit_plans') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: mockCreditPlans,
            error: null,
          }),
        }
      }
      
      if (table === 'installments') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: mockInstallments,
            error: null,
          }),
        }
      }
      
      if (table === 'client_action_logs') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: mockActionLogs,
            error: null,
          }),
          insert: jest.fn().mockResolvedValue({ error: null }),
        }
      }
      
      if (table === 'client_deactivations') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        }
      }
      
      if (table === 'audit_log') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        }
      }
      
      if (table === 'collection_actions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      
      if (table === 'client_ratings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    // Deactivate the client
    await deactivateClient(clientId, reason, notes, userId)
    
    // Fetch the client profile after deactivation to verify historical data is preserved
    const profile = await fetchClientProfile(clientId)
    
    // Verify historical data is still accessible
    expect(profile.purchaseHistory).toHaveLength(1)
    expect(profile.purchaseHistory[0].saleNumber).toBe('S001')
    expect(profile.purchaseHistory[0].total).toBe(1000)
    
    expect(profile.creditHistory).toHaveLength(1)
    expect(profile.creditHistory[0].id).toBe('plan-1')
    expect(profile.creditHistory[0].total_amount).toBe(1000)
    
    expect(profile.installments).toHaveLength(1)
    expect(profile.installments[0].id).toBe('inst-1')
    expect(profile.installments[0].amount).toBe(500)
    
    expect(profile.actionLogs).toHaveLength(1)
    expect(profile.actionLogs[0].action_type).toBe('LLAMADA')
    
    // Verify credit summary is preserved
    expect(profile.creditSummary.creditLimit).toBe(10000)
    expect(profile.creditSummary.creditUsed).toBe(1000)
  })
})

/**
 * Unit tests for reactivateClient function
 * 
 * Tests the client reactivation logic for:
 * - Setting active = true on clients table
 * - Creating REACTIVACION action log entry
 * - Clearing deactivation fields
 * - Error handling for invalid inputs
 * - Rollback on action log creation failure
 */

import { reactivateClient } from './client-service'

describe('reactivateClient', () => {
  let mockSupabase: any
  
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
  
  it('should successfully reactivate an inactive client', async () => {
    const clientId = 'client-123'
    const userId = 'user-456'
    const description = 'Cliente regresó a la zona'
    
    let clientsUpdateCalled = false
    let actionLogInsertCalled = false
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              active: false,
            },
            error: null,
          }),
          update: jest.fn().mockImplementation((data: any) => {
            clientsUpdateCalled = true
            expect(data.active).toBe(true)
            expect(data.deactivation_reason).toBeNull()
            expect(data.deactivated_at).toBeNull()
            expect(data.deactivated_by).toBeNull()
            return {
              eq: jest.fn().mockResolvedValue({ error: null }),
            }
          }),
        }
      }
      
      if (table === 'client_action_logs') {
        return {
          insert: jest.fn().mockImplementation((data: any) => {
            actionLogInsertCalled = true
            expect(data.client_id).toBe(clientId)
            expect(data.action_type).toBe('REACTIVACION')
            expect(data.description).toBe(description)
            expect(data.user_id).toBe(userId)
            expect(data.created_at).toBeDefined()
            return Promise.resolve({ error: null })
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    await reactivateClient(clientId, description, userId)
    
    expect(clientsUpdateCalled).toBe(true)
    expect(actionLogInsertCalled).toBe(true)
  })
  
  it('should throw error when client is not found', async () => {
    const clientId = 'non-existent'
    const userId = 'user-456'
    const description = 'Test description'
    
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
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    await expect(
      reactivateClient(clientId, description, userId)
    ).rejects.toThrow('Client not found')
  })
  
  it('should throw error when client is already active', async () => {
    const clientId = 'client-123'
    const userId = 'user-456'
    const description = 'Test description'
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              active: true,
            },
            error: null,
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    await expect(
      reactivateClient(clientId, description, userId)
    ).rejects.toThrow('Client is already active')
  })
  
  it('should throw error when client update fails', async () => {
    const clientId = 'client-123'
    const userId = 'user-456'
    const description = 'Test description'
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              active: false,
            },
            error: null,
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: { message: 'Database error' },
            }),
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    await expect(
      reactivateClient(clientId, description, userId)
    ).rejects.toThrow('Failed to reactivate client')
  })
  
  it('should rollback client update if action log creation fails', async () => {
    const clientId = 'client-123'
    const userId = 'user-456'
    const description = 'Test description'
    
    let rollbackCalled = false
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              active: false,
            },
            error: null,
          }),
          update: jest.fn().mockImplementation((data: any) => {
            if (data.active === false) {
              // This is the rollback
              rollbackCalled = true
            }
            return {
              eq: jest.fn().mockResolvedValue({ error: null }),
            }
          }),
        }
      }
      
      if (table === 'client_action_logs') {
        return {
          insert: jest.fn().mockResolvedValue({
            error: { message: 'Failed to insert action log' },
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    await expect(
      reactivateClient(clientId, description, userId)
    ).rejects.toThrow('Failed to create reactivation action log')
    
    expect(rollbackCalled).toBe(true)
  })
  
  it('should clear all deactivation fields when reactivating', async () => {
    const clientId = 'client-123'
    const userId = 'user-456'
    const description = 'Cliente regresó'
    
    let updateData: any = null
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              active: false,
              deactivation_reason: 'MUDADO',
              deactivated_at: new Date().toISOString(),
              deactivated_by: 'other-user',
            },
            error: null,
          }),
          update: jest.fn().mockImplementation((data: any) => {
            updateData = data
            return {
              eq: jest.fn().mockResolvedValue({ error: null }),
            }
          }),
        }
      }
      
      if (table === 'client_action_logs') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    
    await reactivateClient(clientId, description, userId)
    
    // Verify all deactivation fields are cleared
    expect(updateData).not.toBeNull()
    expect(updateData.active).toBe(true)
    expect(updateData.deactivation_reason).toBeNull()
    expect(updateData.deactivated_at).toBeNull()
    expect(updateData.deactivated_by).toBeNull()
  })
})
