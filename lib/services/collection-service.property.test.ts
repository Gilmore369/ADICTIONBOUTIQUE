/**
 * Property-Based Tests for Collection Service
 * 
 * Tests universal properties that must hold for all valid inputs:
 * - Property 27: Collection Action Required Fields
 * - Property 28: Completed Action Timestamp
 * 
 * Uses fast-check library for property-based testing
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import * as fc from 'fast-check'
import { createCollectionAction, completeCollectionAction } from './collection-service'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))

describe('Collection Service - Property-Based Tests', () => {
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
   * Property 27: Collection Action Required Fields
   * **Validates: Requirements 8.1**
   * 
   * For any created collection action, the record must include client_id,
   * action_type, description, and follow_up_date; records missing any of
   * these fields must be rejected.
   */
  describe('Property 27: Collection Action Required Fields', () => {
    it('accepts collection action with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            clientId: fc.uuid(),
            actionType: fc.constantFrom(
              'LLAMADA',
              'VISITA',
              'WHATSAPP',
              'MOTORIZADO',
              'EMAIL',
              'OTRO'
            ),
            description: fc.string({ minLength: 5, maxLength: 200 }),
            followUpDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).filter(d => !isNaN(d.getTime())),
            userId: fc.uuid(),
            clientName: fc.string({ minLength: 3, maxLength: 50 }),
          }),
          async ({ clientId, actionType, description, followUpDate, userId, clientName }) => {
            // Setup mock to return client data
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'clients') {
                return {
                  select: jest.fn().mockReturnThis(),
                  eq: jest.fn().mockReturnThis(),
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: clientId,
                      name: clientName,
                    },
                    error: null,
                  }),
                }
              }
              
              if (table === 'collection_actions') {
                return {
                  insert: jest.fn().mockReturnThis(),
                  select: jest.fn().mockReturnThis(),
                  single: jest.fn().mockImplementation(() => {
                    const now = new Date()
                    return Promise.resolve({
                      data: {
                        id: fc.sample(fc.uuid(), 1)[0],
                        client_id: clientId,
                        client_name: clientName,
                        action_type: actionType,
                        description,
                        follow_up_date: followUpDate.toISOString().split('T')[0],
                        completed: false,
                        completed_at: null,
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
            
            const collectionAction = await createCollectionAction(
              clientId,
              actionType,
              description,
              followUpDate,
              userId
            )
            
            // Property 1: All required fields must be present
            expect(collectionAction.client_id).toBe(clientId)
            expect(collectionAction.action_type).toBe(actionType)
            expect(collectionAction.description).toBe(description)
            expect(collectionAction.follow_up_date).toBeInstanceOf(Date)
            
            // Property 2: Additional fields must be present
            expect(collectionAction.id).toBeTruthy()
            expect(collectionAction.user_id).toBe(userId)
            expect(collectionAction.created_at).toBeInstanceOf(Date)
            expect(collectionAction.completed).toBe(false)
            expect(collectionAction.completed_at).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })
    
    it('rejects collection action with missing client_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            actionType: fc.constantFrom('LLAMADA', 'VISITA', 'WHATSAPP', 'MOTORIZADO', 'EMAIL', 'OTRO'),
            description: fc.string({ minLength: 5, maxLength: 200 }),
            followUpDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).filter(d => !isNaN(d.getTime())),
            userId: fc.uuid(),
          }),
          async ({ actionType, description, followUpDate, userId }) => {
            // Property: Missing client_id must throw error
            await expect(
              createCollectionAction(
                '', // Empty client_id
                actionType,
                description,
                followUpDate,
                userId
              )
            ).rejects.toThrow('client_id is required')
          }
        ),
        { numRuns: 50 }
      )
    })
    
    it('rejects collection action with missing action_type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            clientId: fc.uuid(),
            description: fc.string({ minLength: 5, maxLength: 200 }),
            followUpDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).filter(d => !isNaN(d.getTime())),
            userId: fc.uuid(),
          }),
          async ({ clientId, description, followUpDate, userId }) => {
            // Property: Missing action_type must throw error
            await expect(
              createCollectionAction(
                clientId,
                '', // Empty action_type
                description,
                followUpDate,
                userId
              )
            ).rejects.toThrow('action_type is required')
          }
        ),
        { numRuns: 50 }
      )
    })
    
    it('rejects collection action with missing description', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            clientId: fc.uuid(),
            actionType: fc.constantFrom('LLAMADA', 'VISITA', 'WHATSAPP', 'MOTORIZADO', 'EMAIL', 'OTRO'),
            followUpDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).filter(d => !isNaN(d.getTime())),
            userId: fc.uuid(),
          }),
          async ({ clientId, actionType, followUpDate, userId }) => {
            // Property: Missing description must throw error
            await expect(
              createCollectionAction(
                clientId,
                actionType,
                '', // Empty description
                followUpDate,
                userId
              )
            ).rejects.toThrow('description is required')
          }
        ),
        { numRuns: 50 }
      )
    })
    
    it('rejects collection action with missing follow_up_date', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            clientId: fc.uuid(),
            actionType: fc.constantFrom('LLAMADA', 'VISITA', 'WHATSAPP', 'MOTORIZADO', 'EMAIL', 'OTRO'),
            description: fc.string({ minLength: 5, maxLength: 200 }),
            userId: fc.uuid(),
          }),
          async ({ clientId, actionType, description, userId }) => {
            // Property: Missing follow_up_date must throw error
            await expect(
              createCollectionAction(
                clientId,
                actionType,
                description,
                null as any, // Null follow_up_date
                userId
              )
            ).rejects.toThrow('follow_up_date is required')
          }
        ),
        { numRuns: 50 }
      )
    })
    
    it('rejects collection action with invalid action_type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            clientId: fc.uuid(),
            invalidActionType: fc.string({ minLength: 1, maxLength: 20 }).filter(
              s => !['LLAMADA', 'VISITA', 'WHATSAPP', 'MOTORIZADO', 'EMAIL', 'OTRO'].includes(s)
            ),
            description: fc.string({ minLength: 5, maxLength: 200 }),
            followUpDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).filter(d => !isNaN(d.getTime())),
            userId: fc.uuid(),
          }),
          async ({ clientId, invalidActionType, description, followUpDate, userId }) => {
            // Property: Invalid action_type must throw error
            await expect(
              createCollectionAction(
                clientId,
                invalidActionType,
                description,
                followUpDate,
                userId
              )
            ).rejects.toThrow(/Invalid action type/)
          }
        ),
        { numRuns: 50 }
      )
    })
  })
  
  /**
   * Property 28: Completed Action Timestamp
   * **Validates: Requirements 8.4**
   * 
   * For any collection action marked as completed, the completed_at field
   * must be set to the current timestamp.
   */
  describe('Property 28: Completed Action Timestamp', () => {
    it('sets completed_at timestamp when action is completed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            actionId: fc.uuid(),
            clientId: fc.uuid(),
            actionType: fc.constantFrom('LLAMADA', 'VISITA', 'WHATSAPP', 'MOTORIZADO', 'EMAIL', 'OTRO'),
            description: fc.string({ minLength: 5, maxLength: 200 }),
            followUpDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).filter(d => !isNaN(d.getTime())),
            userId: fc.uuid(),
          }),
          async ({ actionId, clientId, actionType, description, followUpDate, userId }) => {
            const testStartTime = new Date()
            
            // Setup mock to return completed collection action
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'collection_actions') {
                return {
                  update: jest.fn().mockReturnThis(),
                  eq: jest.fn().mockReturnThis(),
                  select: jest.fn().mockReturnThis(),
                  single: jest.fn().mockImplementation(() => {
                    const now = new Date()
                    return Promise.resolve({
                      data: {
                        id: actionId,
                        client_id: clientId,
                        action_type: actionType,
                        description,
                        follow_up_date: followUpDate.toISOString().split('T')[0],
                        completed: true,
                        completed_at: now.toISOString(),
                        user_id: userId,
                        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
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
            
            const completedAction = await completeCollectionAction(actionId)
            
            const testEndTime = new Date()
            
            // Property 1: completed must be true
            expect(completedAction.completed).toBe(true)
            
            // Property 2: completed_at must be present and be a valid Date
            expect(completedAction.completed_at).toBeInstanceOf(Date)
            expect(completedAction.completed_at).toBeTruthy()
            
            // Property 3: completed_at must be within the test execution timeframe
            // (allowing for small time differences due to execution)
            expect(completedAction.completed_at!.getTime()).toBeGreaterThanOrEqual(
              testStartTime.getTime() - 1000
            )
            expect(completedAction.completed_at!.getTime()).toBeLessThanOrEqual(
              testEndTime.getTime() + 1000
            )
            
            // Property 4: All other fields must remain unchanged
            expect(completedAction.id).toBe(actionId)
            expect(completedAction.client_id).toBe(clientId)
            expect(completedAction.action_type).toBe(actionType)
            expect(completedAction.description).toBe(description)
            expect(completedAction.user_id).toBe(userId)
          }
        ),
        { numRuns: 100 }
      )
    })
    
    it('rejects completion with missing actionId', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            // Property: Missing actionId must throw error
            await expect(
              completeCollectionAction('')
            ).rejects.toThrow('actionId is required')
          }
        ),
        { numRuns: 10 }
      )
    })
    
    it('maintains completed_at timestamp on already completed action', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            actionId: fc.uuid(),
            clientId: fc.uuid(),
            actionType: fc.constantFrom('LLAMADA', 'VISITA', 'WHATSAPP', 'MOTORIZADO', 'EMAIL', 'OTRO'),
            description: fc.string({ minLength: 5, maxLength: 200 }),
            followUpDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).filter(d => !isNaN(d.getTime())),
            userId: fc.uuid(),
            originalCompletedAt: fc.date({ min: new Date('2024-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
          }),
          async ({ actionId, clientId, actionType, description, followUpDate, userId, originalCompletedAt }) => {
            // Setup mock to return already completed collection action
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'collection_actions') {
                return {
                  update: jest.fn().mockReturnThis(),
                  eq: jest.fn().mockReturnThis(),
                  select: jest.fn().mockReturnThis(),
                  single: jest.fn().mockImplementation(() => {
                    // Return with new timestamp (simulating database behavior)
                    const now = new Date()
                    return Promise.resolve({
                      data: {
                        id: actionId,
                        client_id: clientId,
                        action_type: actionType,
                        description,
                        follow_up_date: followUpDate.toISOString().split('T')[0],
                        completed: true,
                        completed_at: now.toISOString(), // New timestamp
                        user_id: userId,
                        created_at: new Date(Date.now() - 86400000).toISOString(),
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
            
            const completedAction = await completeCollectionAction(actionId)
            
            // Property 1: completed must remain true
            expect(completedAction.completed).toBe(true)
            
            // Property 2: completed_at must still be present and valid
            expect(completedAction.completed_at).toBeInstanceOf(Date)
            expect(completedAction.completed_at).toBeTruthy()
            
            // Property 3: Action can be completed multiple times without error
            expect(completedAction.id).toBe(actionId)
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})
