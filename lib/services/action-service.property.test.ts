/**
 * Property-Based Tests for Action Service
 * 
 * Tests universal properties that must hold for all valid inputs:
 * - Property 17: Action Log Timestamp Presence
 * - Property 18: Reactivation Changes Status
 * 
 * Uses fast-check library for property-based testing
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import * as fc from 'fast-check'
import { createActionLog } from './action-service'
import { ActionType } from '@/lib/types/crm'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))

describe('createActionLog - Property-Based Tests', () => {
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
   * Property 17: Action Log Timestamp Presence
   * **Validates: Requirements 7.3**
   * 
   * For any created action log, the record must include a valid user_id
   * and a created_at timestamp equal to the current date and time.
   */
  it('Property 17: action log includes valid user_id and created_at timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          actionType: fc.constantFrom(
            ActionType.NOTA,
            ActionType.LLAMADA,
            ActionType.VISITA,
            ActionType.MENSAJE
          ),
          description: fc.string({ minLength: 5, maxLength: 200 }),
          userId: fc.uuid(),
        }),
        async ({ clientId, actionType, description, userId }) => {
          const testStartTime = new Date()
          
          // Setup mock to return client data
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
            
            if (table === 'client_action_logs') {
              return {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockImplementation(() => {
                  const now = new Date()
                  return Promise.resolve({
                    data: {
                      id: fc.sample(fc.uuid(), 1)[0],
                      client_id: clientId,
                      action_type: actionType,
                      description,
                      user_id: userId,
                      created_at: now.toISOString(),
                    },
                    error: null,
                  })
                }),
              }
            }
            
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const actionLog = await createActionLog(clientId, actionType, description, userId)
          
          const testEndTime = new Date()
          
          // Property 1: user_id must be present and match the provided userId
          expect(actionLog.user_id).toBe(userId)
          expect(actionLog.user_id).toBeTruthy()
          
          // Property 2: created_at must be present and be a valid Date
          expect(actionLog.created_at).toBeInstanceOf(Date)
          expect(actionLog.created_at).toBeTruthy()
          
          // Property 3: created_at must be within the test execution timeframe
          // (allowing for small time differences due to execution)
          expect(actionLog.created_at.getTime()).toBeGreaterThanOrEqual(testStartTime.getTime() - 1000)
          expect(actionLog.created_at.getTime()).toBeLessThanOrEqual(testEndTime.getTime() + 1000)
          
          // Property 4: All required fields must be present
          expect(actionLog.id).toBeTruthy()
          expect(actionLog.client_id).toBe(clientId)
          expect(actionLog.action_type).toBe(actionType)
          expect(actionLog.description).toBe(description)
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * Property 18: Reactivation Changes Status
   * **Validates: Requirements 7.5**
   * 
   * For any inactive client, creating an action log with type REACTIVACION
   * must change the client's active status to true.
   */
  it('Property 18: REACTIVACION action changes inactive client to active', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          description: fc.string({ minLength: 5, maxLength: 200 }),
          userId: fc.uuid(),
          clientName: fc.string({ minLength: 3, maxLength: 50 }),
        }),
        async ({ clientId, description, userId, clientName }) => {
          let clientActive = false
          let clientDeactivationReason: string | null = 'MUDADO'
          let clientDeactivatedAt: string | null = new Date().toISOString()
          let clientDeactivatedBy: string | null = fc.sample(fc.uuid(), 1)[0]
          
          // Setup mock to return inactive client and handle reactivation
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              const selectMock = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: clientId,
                    name: clientName,
                    active: clientActive,
                  },
                  error: null,
                }),
              }
              
              const updateMock = {
                update: jest.fn().mockImplementation((data: any) => {
                  // Simulate the update by changing the client state
                  clientActive = data.active
                  clientDeactivationReason = data.deactivation_reason
                  clientDeactivatedAt = data.deactivated_at
                  clientDeactivatedBy = data.deactivated_by
                  
                  return {
                    eq: jest.fn().mockResolvedValue({
                      data: {
                        id: clientId,
                        name: clientName,
                        active: data.active,
                        deactivation_reason: data.deactivation_reason,
                        deactivated_at: data.deactivated_at,
                        deactivated_by: data.deactivated_by,
                      },
                      error: null,
                    }),
                  }
                }),
              }
              
              // Return different mocks based on the method chain
              return {
                ...selectMock,
                ...updateMock,
              }
            }
            
            if (table === 'client_action_logs') {
              return {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockImplementation(() => {
                  const now = new Date()
                  return Promise.resolve({
                    data: {
                      id: fc.sample(fc.uuid(), 1)[0],
                      client_id: clientId,
                      action_type: ActionType.REACTIVACION,
                      description,
                      user_id: userId,
                      created_at: now.toISOString(),
                    },
                    error: null,
                  })
                }),
              }
            }
            
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          // Verify client is inactive before reactivation
          expect(clientActive).toBe(false)
          
          // Create REACTIVACION action log
          const actionLog = await createActionLog(
            clientId,
            ActionType.REACTIVACION,
            description,
            userId
          )
          
          // Property 1: Client must be active after REACTIVACION
          expect(clientActive).toBe(true)
          
          // Property 2: Deactivation fields must be cleared
          expect(clientDeactivationReason).toBeNull()
          expect(clientDeactivatedAt).toBeNull()
          expect(clientDeactivatedBy).toBeNull()
          
          // Property 3: Action log must be created with REACTIVACION type
          expect(actionLog.action_type).toBe(ActionType.REACTIVACION)
          expect(actionLog.client_id).toBe(clientId)
          expect(actionLog.user_id).toBe(userId)
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * Additional Property Test: REACTIVACION on already active client
   * 
   * For any active client, creating a REACTIVACION action log should not
   * cause errors and should maintain the active status.
   */
  it('Property: REACTIVACION on active client maintains active status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          description: fc.string({ minLength: 5, maxLength: 200 }),
          userId: fc.uuid(),
          clientName: fc.string({ minLength: 3, maxLength: 50 }),
        }),
        async ({ clientId, description, userId, clientName }) => {
          let clientActive = true
          
          // Setup mock to return active client
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              const selectMock = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: clientId,
                    name: clientName,
                    active: clientActive,
                  },
                  error: null,
                }),
              }
              
              const updateMock = {
                update: jest.fn().mockImplementation((data: any) => {
                  // Simulate the update
                  clientActive = data.active
                  
                  return {
                    eq: jest.fn().mockResolvedValue({
                      data: {
                        id: clientId,
                        name: clientName,
                        active: data.active,
                      },
                      error: null,
                    }),
                  }
                }),
              }
              
              return {
                ...selectMock,
                ...updateMock,
              }
            }
            
            if (table === 'client_action_logs') {
              return {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockImplementation(() => {
                  const now = new Date()
                  return Promise.resolve({
                    data: {
                      id: fc.sample(fc.uuid(), 1)[0],
                      client_id: clientId,
                      action_type: ActionType.REACTIVACION,
                      description,
                      user_id: userId,
                      created_at: now.toISOString(),
                    },
                    error: null,
                  })
                }),
              }
            }
            
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          // Verify client is active before action
          expect(clientActive).toBe(true)
          
          // Create REACTIVACION action log
          const actionLog = await createActionLog(
            clientId,
            ActionType.REACTIVACION,
            description,
            userId
          )
          
          // Property: Client must remain active
          expect(clientActive).toBe(true)
          
          // Property: Action log must be created successfully
          expect(actionLog.action_type).toBe(ActionType.REACTIVACION)
          expect(actionLog.client_id).toBe(clientId)
          expect(actionLog.user_id).toBe(userId)
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * Additional Property Test: Non-REACTIVACION actions don't change client status
   * 
   * For any action type other than REACTIVACION, creating an action log
   * should not change the client's active status.
   */
  it('Property: non-REACTIVACION actions do not change client status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          actionType: fc.constantFrom(
            ActionType.NOTA,
            ActionType.LLAMADA,
            ActionType.VISITA,
            ActionType.MENSAJE
          ),
          description: fc.string({ minLength: 5, maxLength: 200 }),
          userId: fc.uuid(),
          clientName: fc.string({ minLength: 3, maxLength: 50 }),
          initialActiveStatus: fc.boolean(),
        }),
        async ({ clientId, actionType, description, userId, clientName, initialActiveStatus }) => {
          let clientActive = initialActiveStatus
          let updateCalled = false
          
          // Setup mock to return client and track if update is called
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: clientId,
                    name: clientName,
                    active: clientActive,
                  },
                  error: null,
                }),
                update: jest.fn().mockImplementation(() => {
                  updateCalled = true
                  return {
                    eq: jest.fn().mockResolvedValue({
                      data: { id: clientId, name: clientName, active: clientActive },
                      error: null,
                    }),
                  }
                }),
              }
            }
            
            if (table === 'client_action_logs') {
              return {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockImplementation(() => {
                  const now = new Date()
                  return Promise.resolve({
                    data: {
                      id: fc.sample(fc.uuid(), 1)[0],
                      client_id: clientId,
                      action_type: actionType,
                      description,
                      user_id: userId,
                      created_at: now.toISOString(),
                    },
                    error: null,
                  })
                }),
              }
            }
            
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const initialStatus = clientActive
          
          // Create action log with non-REACTIVACION type
          const actionLog = await createActionLog(clientId, actionType, description, userId)
          
          // Property 1: Client status must not change
          expect(clientActive).toBe(initialStatus)
          
          // Property 2: Update should not be called for non-REACTIVACION actions
          expect(updateCalled).toBe(false)
          
          // Property 3: Action log must be created with correct type
          expect(actionLog.action_type).toBe(actionType)
          expect(actionLog.client_id).toBe(clientId)
        }
      ),
      { numRuns: 100 }
    )
  })
})
