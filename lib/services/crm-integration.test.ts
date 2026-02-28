/**
 * Integration Tests for CRM System
 * 
 * Tests complete workflows across multiple services:
 * - Create client → add purchases → calculate rating → view profile
 * - Filter → export flow
 * - Deactivation → reactivation flow
 * - Collection action creation → completion flow
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { fetchClientProfile } from './client-service'
import { calculateClientRating } from './rating-service'
import { filterClients } from './client-service'
import { exportClients } from './export-service'
import { deactivateClient, reactivateClient } from './client-service'
import { createCollectionAction, completeCollectionAction } from './collection-service'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
  createClient: jest.fn(),
}))

describe('CRM Integration Tests', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = {
      from: jest.fn(),
    }
    
    const { createServerClient, createClient } = require('@/lib/supabase/server')
    createServerClient.mockResolvedValue(mockSupabase)
    createClient.mockResolvedValue(mockSupabase)
  })
  
  /**
   * Integration Test: Complete client lifecycle workflow
   * 
   * Tests: create client → add purchases → calculate rating → view profile
   * 
   * Note: This is a simplified integration test that verifies the services
   * can work together. Full end-to-end testing would require a test database.
   */
  it('completes full client lifecycle: create → purchases → rating → profile', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    
    // Mock complete client data with purchases and installments
    const clientData = {
      id: clientId,
      name: 'Juan Pérez',
      dni: '12345678',
      phone: '1234567890',
      address: 'Calle Principal 123',
      credit_limit: 10000,
      credit_used: 5000,
      active: true,
      rating: 'B',
      rating_score: 75,
      last_purchase_date: new Date('2024-01-15'),
    }
    
    const purchases = [
      {
        id: 'p1',
        sale_number: 'V-001',
        created_at: '2024-01-15T00:00:00Z',
        total: 1000,
        sale_type: 'CREDITO',
        payment_status: 'PAID',
        voided: false,
      },
      {
        id: 'p2',
        sale_number: 'V-002',
        created_at: '2024-02-20T00:00:00Z',
        total: 2000,
        sale_type: 'CREDITO',
        payment_status: 'PARTIAL',
        voided: false,
      },
    ]
    
    const installments = [
      {
        id: 'inst1',
        plan_id: 'plan1',
        installment_number: 1,
        amount: 500,
        paid_amount: 500,
        due_date: new Date('2024-02-01'),
        status: 'PAID',
        paid_at: new Date('2024-01-30'),
        credit_plans: {
          sale_number: 'V-001',
        },
      },
      {
        id: 'inst2',
        plan_id: 'plan2',
        installment_number: 1,
        amount: 1000,
        paid_amount: 500,
        due_date: new Date('2024-03-15'),
        status: 'PARTIAL',
        paid_at: null,
        credit_plans: {
          sale_number: 'V-002',
        },
      },
    ]
    
    // Mock all database queries for rating calculation
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: clientData,
            error: null,
          }),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }
      }
      
      if (table === 'sales') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [...purchases].reverse(), // Return in descending order (most recent first)
            error: null,
          }),
        }
      }
      
      if (table === 'installments') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: installments,
            error: null,
          }),
        }
      }
      
      if (table === 'credit_plans') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }
      }
      
      if (table === 'client_action_logs') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }
      }
      
      if (table === 'collection_actions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [],
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
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
    
    // Step 1: Calculate rating based on purchase history
    const rating = await calculateClientRating(clientId)
    
    // Verify rating was calculated
    expect(rating).toBeTruthy()
    expect(rating.client_id).toBe(clientId)
    expect(rating.score).toBeGreaterThanOrEqual(0)
    expect(rating.score).toBeLessThanOrEqual(100)
    expect(['A', 'B', 'C', 'D']).toContain(rating.rating)
    
    // Step 2: Fetch complete client profile
    const profile = await fetchClientProfile(clientId)
    
    // Verify profile contains all expected data
    expect(profile.client.id).toBe(clientId)
    expect(profile.client.name).toBe('Juan Pérez')
    expect(profile.purchaseHistory.length).toBe(2)
    
    // Verify credit summary calculations
    expect(profile.creditSummary.creditLimit).toBe(10000)
    expect(profile.creditSummary.creditUsed).toBe(5000)
    expect(profile.creditSummary.creditAvailable).toBe(5000)
    
    // Verify purchases are sorted by date (most recent first)
    // purchaseHistory[0] should be the most recent (2024-02-20)
    // purchaseHistory[1] should be older (2024-01-15)
    expect(profile.purchaseHistory[0].date.getTime()).toBeGreaterThanOrEqual(
      profile.purchaseHistory[1].date.getTime()
    )
  })
  
  /**
   * Integration Test: Filter and export workflow
   * 
   * Tests: apply filters → export filtered data to CSV
   * 
   * Note: This test verifies the filter and export services work together.
   */
  it('completes filter and export workflow', async () => {
    const clients = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Cliente A',
        dni: '12345678',
        phone: '1234567890',
        address: 'Dirección A',
        credit_limit: 10000,
        credit_used: 8000,
        rating: 'C',
        last_purchase_date: new Date('2023-12-01'),
        active: true,
      },
      {
        id: '223e4567-e89b-12d3-a456-426614174001',
        name: 'Cliente B',
        dni: '87654321',
        phone: '0987654321',
        address: 'Dirección B',
        credit_limit: 15000,
        credit_used: 5000,
        rating: 'A',
        last_purchase_date: new Date('2024-02-15'),
        active: true,
      },
    ]
    
    // Mock filter query - return clients with debt
    const clientsWithDebt = clients.filter(c => c.credit_used > 0)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gt: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
        }
        
        // The final call in the chain should return the data
        // Since there's no explicit order() call in the mock chain, 
        // we need to handle the case where the query is executed directly
        Object.assign(mockQuery, {
          then: (resolve: any) => resolve({ data: clientsWithDebt, error: null }),
        })
        
        return mockQuery
      }
      
      if (table === 'installments') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
    
    // Step 1: Apply filters (e.g., clients with debt)
    const filters = {
      debtStatus: 'CON_DEUDA' as const,
    }
    
    const filteredClients = await filterClients(filters)
    
    // Verify filtering worked
    expect(filteredClients.length).toBe(2)
    expect(filteredClients.every(c => c.credit_used > 0)).toBe(true)
    
    // Step 2: Export filtered clients to CSV
    const csv = await exportClients(filters, 'admin')
    
    // Verify CSV structure
    expect(csv).toBeTruthy()
    expect(csv).toContain('Nombre')
    expect(csv).toContain('DNI')
    expect(csv).toContain('Cliente A')
    expect(csv).toContain('Cliente B')
    
    // Verify CSV has correct number of rows (header + data)
    const lines = csv.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(3) // Header + at least 2 clients
  })
  
  /**
   * Integration Test: Deactivation and reactivation workflow
   * 
   * Tests: deactivate client → verify inactive → reactivate → verify active
   */
  it('completes deactivation and reactivation workflow', async () => {
    const clientId = '323e4567-e89b-12d3-a456-426614174002'
    const userId = '423e4567-e89b-12d3-a456-426614174003'
    
    let clientActive = true
    let deactivationRecord: any = null
    let reactivationLog: any = null
    
    // Mock database operations
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
              active: clientActive,
            },
            error: null,
          }),
          update: jest.fn().mockImplementation((data: any) => {
            clientActive = data.active
            return {
              eq: jest.fn().mockResolvedValue({
                data: { ...data, id: clientId },
                error: null,
              }),
            }
          }),
        }
      }
      
      if (table === 'client_deactivations') {
        return {
          insert: jest.fn().mockImplementation((data: any) => {
            deactivationRecord = data
            return {
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { ...data, id: 'deact1' },
                error: null,
              }),
            }
          }),
        }
      }
      
      if (table === 'client_action_logs') {
        return {
          insert: jest.fn().mockImplementation((data: any) => {
            reactivationLog = data
            return {
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { ...data, id: 'log1' },
                error: null,
              }),
            }
          }),
        }
      }
      
      if (table === 'audit_log') {
        return {
          insert: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
    
    // Step 1: Verify client is initially active
    expect(clientActive).toBe(true)
    
    // Step 2: Deactivate client
    await deactivateClient(clientId, 'MUDADO', 'Se mudó a otra ciudad', userId)
    
    // Step 3: Verify client is now inactive
    expect(clientActive).toBe(false)
    expect(deactivationRecord).toBeTruthy()
    expect(deactivationRecord.client_id).toBe(clientId)
    expect(deactivationRecord.reason).toBe('MUDADO')
    expect(deactivationRecord.deactivated_by).toBe(userId)
    
    // Step 4: Reactivate client
    await reactivateClient(clientId, 'Cliente regresó', userId)
    
    // Step 5: Verify client is active again
    expect(clientActive).toBe(true)
    expect(reactivationLog).toBeTruthy()
    expect(reactivationLog.action_type).toBe('REACTIVACION')
    expect(reactivationLog.client_id).toBe(clientId)
  })
  
  /**
   * Integration Test: Collection action workflow
   * 
   * Tests: create collection action → mark as completed
   * 
   * Note: This test verifies the collection service workflow.
   */
  it('completes collection action creation and completion workflow', async () => {
    const clientId = '523e4567-e89b-12d3-a456-426614174004'
    const userId = '623e4567-e89b-12d3-a456-426614174005'
    const actionId = 'action1'
    
    let collectionAction: any = null
    let isCompleted = false
    let completedAt: Date | null = null
    
    // Mock database operations
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: clientId,
              name: 'Test Client',
            },
            error: null,
          }),
        }
      }
      
      if (table === 'collection_actions') {
        return {
          insert: jest.fn().mockImplementation((data: any) => {
            collectionAction = {
              ...data,
              id: actionId,
              completed: false,
              completed_at: null,
            }
            return {
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: collectionAction,
                error: null,
              }),
            }
          }),
          update: jest.fn().mockImplementation((data: any) => {
            isCompleted = data.completed
            completedAt = data.completed_at ? new Date(data.completed_at) : null
            collectionAction = {
              ...collectionAction,
              ...data,
            }
            return {
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: collectionAction,
                error: null,
              }),
            }
          }),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: collectionAction,
            error: null,
          }),
        }
      }
      
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
    
    // Step 1: Create collection action
    const action = await createCollectionAction(
      clientId,
      'LLAMADA',
      'Llamar para recordar pago',
      new Date('2024-03-20'),
      userId
    )
    
    // Step 2: Verify action was created
    expect(action).toBeTruthy()
    expect(action.client_id).toBe(clientId)
    expect(action.action_type).toBe('LLAMADA')
    expect(action.description).toBe('Llamar para recordar pago')
    expect(action.completed).toBe(false)
    expect(action.completed_at).toBeNull()
    
    // Step 3: Complete the action
    await completeCollectionAction(actionId)
    
    // Step 4: Verify action is marked as completed
    expect(isCompleted).toBe(true)
    expect(completedAt).toBeInstanceOf(Date)
    expect(completedAt).toBeTruthy()
  })
  
  /**
   * Integration Test: Error handling across services
   * 
   * Tests: proper error propagation and handling
   */
  it('handles errors properly across service boundaries', async () => {
    const nonExistentClientId = '999e4567-e89b-12d3-a456-426614174999'
    
    // Mock database to return error
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
    
    // Verify error is thrown when fetching non-existent client
    await expect(fetchClientProfile(nonExistentClientId)).rejects.toThrow()
    
    // Verify error is thrown when calculating rating for non-existent client
    await expect(calculateClientRating(nonExistentClientId)).rejects.toThrow()
  })
})
