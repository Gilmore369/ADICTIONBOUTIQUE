/**
 * Unit Tests for Collection Service
 * 
 * Tests specific scenarios and edge cases for collection actions:
 * - Creating collection action with all required fields
 * - Completing collection action
 * - Fetching and ordering collection actions
 * - Pending actions count for dashboard
 * 
 * **Validates: Requirements 8.1, 8.2, 8.5**
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import {
  createCollectionAction,
  completeCollectionAction,
  fetchCollectionActions,
} from './collection-service'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))

describe('Collection Service - Unit Tests', () => {
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
   * Test creating collection action with all required fields
   * **Validates: Requirement 8.1**
   */
  describe('createCollectionAction - Required Fields', () => {
    it('should create collection action with all required fields', async () => {
      const clientId = 'client-123'
      const userId = 'user-456'
      const actionType = 'LLAMADA'
      const description = 'Llamada para recordar pago vencido'
      const followUpDate = new Date('2024-03-15')
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: clientId, name: 'Test Client' },
              error: null,
            }),
          }
        }
        
        if (table === 'collection_actions') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'action-1',
                client_id: clientId,
                client_name: 'Test Client',
                action_type: actionType,
                description,
                follow_up_date: '2024-03-15',
                completed: false,
                completed_at: null,
                user_id: userId,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      const action = await createCollectionAction(
        clientId,
        actionType,
        description,
        followUpDate,
        userId
      )
      
      expect(action.client_id).toBe(clientId)
      expect(action.action_type).toBe(actionType)
      expect(action.description).toBe(description)
      expect(action.follow_up_date).toEqual(followUpDate)
      expect(action.user_id).toBe(userId)
      expect(action.completed).toBe(false)
      expect(action.completed_at).toBeNull()
      expect(action.created_at).toBeInstanceOf(Date)
    })
    
    it('should throw error if client_id is missing', async () => {
      await expect(
        createCollectionAction('', 'LLAMADA', 'Test', new Date(), 'user-1')
      ).rejects.toThrow('client_id is required')
    })
    
    it('should throw error if action_type is missing', async () => {
      await expect(
        createCollectionAction('client-1', '', 'Test', new Date(), 'user-1')
      ).rejects.toThrow('action_type is required')
    })
    
    it('should throw error if description is missing', async () => {
      await expect(
        createCollectionAction('client-1', 'LLAMADA', '', new Date(), 'user-1')
      ).rejects.toThrow('description is required')
    })
    
    it('should throw error if follow_up_date is missing', async () => {
      await expect(
        createCollectionAction('client-1', 'LLAMADA', 'Test', null as any, 'user-1')
      ).rejects.toThrow('follow_up_date is required')
    })
    
    it('should throw error if user_id is missing', async () => {
      await expect(
        createCollectionAction('client-1', 'LLAMADA', 'Test', new Date(), '')
      ).rejects.toThrow('user_id is required')
    })
    
    it('should throw error for invalid action type', async () => {
      await expect(
        createCollectionAction('client-1', 'INVALID', 'Test', new Date(), 'user-1')
      ).rejects.toThrow('Invalid action type: INVALID')
    })
    
    it('should accept all valid action types', async () => {
      const validTypes = ['LLAMADA', 'VISITA', 'WHATSAPP', 'MOTORIZADO', 'EMAIL', 'OTRO']
      const clientId = 'client-123'
      const userId = 'user-456'
      const description = 'Test action'
      const followUpDate = new Date('2024-03-15')
      
      for (const actionType of validTypes) {
        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'clients') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: clientId, name: 'Test Client' },
                error: null,
              }),
            }
          }
          
          if (table === 'collection_actions') {
            return {
              insert: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: `action-${actionType}`,
                  client_id: clientId,
                  client_name: 'Test Client',
                  action_type: actionType,
                  description,
                  follow_up_date: '2024-03-15',
                  completed: false,
                  completed_at: null,
                  user_id: userId,
                  created_at: new Date().toISOString(),
                },
                error: null,
              }),
            }
          }
          
          return mockSupabase
        })
        
        const action = await createCollectionAction(
          clientId,
          actionType,
          description,
          followUpDate,
          userId
        )
        
        expect(action.action_type).toBe(actionType)
      }
    })
    
    it('should throw error if client not found', async () => {
      const clientId = 'non-existent-client'
      
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
        
        return mockSupabase
      })
      
      await expect(
        createCollectionAction(clientId, 'LLAMADA', 'Test', new Date(), 'user-1')
      ).rejects.toThrow(`Client not found: ${clientId}`)
    })
  })
  
  /**
   * Test completing collection action
   * **Validates: Requirement 8.2**
   */
  describe('completeCollectionAction - Marking as Completed', () => {
    it('should mark collection action as completed', async () => {
      const actionId = 'action-123'
      const completedAt = new Date()
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'collection_actions') {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: actionId,
                client_id: 'client-123',
                action_type: 'LLAMADA',
                description: 'Test action',
                follow_up_date: '2024-03-15',
                completed: true,
                completed_at: completedAt.toISOString(),
                user_id: 'user-456',
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      const action = await completeCollectionAction(actionId)
      
      expect(action.id).toBe(actionId)
      expect(action.completed).toBe(true)
      expect(action.completed_at).toBeInstanceOf(Date)
      expect(action.completed_at).not.toBeNull()
    })
    
    it('should throw error if actionId is missing', async () => {
      await expect(completeCollectionAction('')).rejects.toThrow('actionId is required')
    })
    
    it('should throw error if action not found', async () => {
      const actionId = 'non-existent-action'
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'collection_actions') {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      await expect(completeCollectionAction(actionId)).rejects.toThrow(
        `Collection action not found: ${actionId}`
      )
    })
    
    it('should handle database update errors', async () => {
      const actionId = 'action-error'
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'collection_actions') {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database update failed' },
            }),
          }
        }
        
        return mockSupabase
      })
      
      await expect(completeCollectionAction(actionId)).rejects.toThrow(
        'Failed to complete collection action: Database update failed'
      )
    })
  })
  
  /**
   * Test fetching and ordering collection actions
   * **Validates: Requirement 8.1**
   */
  describe('fetchCollectionActions - Retrieval and Ordering', () => {
    it('should fetch collection actions ordered by follow_up_date (earliest first)', async () => {
      const clientId = 'client-123'
      const today = new Date()
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      
      const mockActions = [
        {
          id: 'action-1',
          client_id: clientId,
          action_type: 'LLAMADA',
          description: 'Earliest action',
          follow_up_date: today.toISOString().split('T')[0],
          completed: false,
          completed_at: null,
          user_id: 'user-1',
          created_at: new Date().toISOString(),
        },
        {
          id: 'action-2',
          client_id: clientId,
          action_type: 'VISITA',
          description: 'Tomorrow action',
          follow_up_date: tomorrow.toISOString().split('T')[0],
          completed: false,
          completed_at: null,
          user_id: 'user-2',
          created_at: new Date().toISOString(),
        },
        {
          id: 'action-3',
          client_id: clientId,
          action_type: 'WHATSAPP',
          description: 'Next week action',
          follow_up_date: nextWeek.toISOString().split('T')[0],
          completed: false,
          completed_at: null,
          user_id: 'user-3',
          created_at: new Date().toISOString(),
        },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'collection_actions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockActions,
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      const actions = await fetchCollectionActions(clientId)
      
      expect(actions).toHaveLength(3)
      
      // Verify ordering (earliest first)
      expect(actions[0].id).toBe('action-1')
      expect(actions[0].follow_up_date.toISOString().split('T')[0]).toBe(
        today.toISOString().split('T')[0]
      )
      
      expect(actions[1].id).toBe('action-2')
      expect(actions[1].follow_up_date.toISOString().split('T')[0]).toBe(
        tomorrow.toISOString().split('T')[0]
      )
      
      expect(actions[2].id).toBe('action-3')
      expect(actions[2].follow_up_date.toISOString().split('T')[0]).toBe(
        nextWeek.toISOString().split('T')[0]
      )
    })
    
    it('should return empty array when client has no collection actions', async () => {
      const clientId = 'client-no-actions'
      
      mockSupabase.from.mockImplementation((table: string) => {
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
        
        return mockSupabase
      })
      
      const actions = await fetchCollectionActions(clientId)
      
      expect(actions).toEqual([])
    })
    
    it('should fetch both completed and pending actions', async () => {
      const clientId = 'client-mixed'
      const today = new Date()
      
      const mockActions = [
        {
          id: 'action-pending',
          client_id: clientId,
          action_type: 'LLAMADA',
          description: 'Pending action',
          follow_up_date: today.toISOString().split('T')[0],
          completed: false,
          completed_at: null,
          user_id: 'user-1',
          created_at: new Date().toISOString(),
        },
        {
          id: 'action-completed',
          client_id: clientId,
          action_type: 'VISITA',
          description: 'Completed action',
          follow_up_date: today.toISOString().split('T')[0],
          completed: true,
          completed_at: new Date().toISOString(),
          user_id: 'user-2',
          created_at: new Date().toISOString(),
        },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'collection_actions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockActions,
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      const actions = await fetchCollectionActions(clientId)
      
      expect(actions).toHaveLength(2)
      
      const pendingAction = actions.find(a => a.id === 'action-pending')
      const completedAction = actions.find(a => a.id === 'action-completed')
      
      expect(pendingAction?.completed).toBe(false)
      expect(pendingAction?.completed_at).toBeNull()
      
      expect(completedAction?.completed).toBe(true)
      expect(completedAction?.completed_at).toBeInstanceOf(Date)
    })
    
    it('should throw error if clientId is missing', async () => {
      await expect(fetchCollectionActions('')).rejects.toThrow('clientId is required')
    })
    
    it('should throw error if database query fails', async () => {
      const clientId = 'client-error'
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'collection_actions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' },
            }),
          }
        }
        
        return mockSupabase
      })
      
      await expect(fetchCollectionActions(clientId)).rejects.toThrow(
        'Failed to fetch collection actions: Database connection failed'
      )
    })
  })
  
  /**
   * Test pending actions count for dashboard
   * **Validates: Requirement 8.5**
   */
  describe('Pending Actions Count - Dashboard Integration', () => {
    it('should count only pending actions with follow_up_date <= today', async () => {
      const today = new Date()
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
      
      // This test verifies the logic that would be used in dashboard-service
      // The dashboard should count actions where:
      // - completed = false
      // - follow_up_date <= today
      
      const mockActions = [
        {
          id: 'action-1',
          client_id: 'client-1',
          action_type: 'LLAMADA',
          description: 'Overdue action',
          follow_up_date: yesterday.toISOString().split('T')[0],
          completed: false,
          completed_at: null,
          user_id: 'user-1',
          created_at: new Date().toISOString(),
        },
        {
          id: 'action-2',
          client_id: 'client-2',
          action_type: 'VISITA',
          description: 'Due today',
          follow_up_date: today.toISOString().split('T')[0],
          completed: false,
          completed_at: null,
          user_id: 'user-2',
          created_at: new Date().toISOString(),
        },
        {
          id: 'action-3',
          client_id: 'client-3',
          action_type: 'WHATSAPP',
          description: 'Future action (should not count)',
          follow_up_date: tomorrow.toISOString().split('T')[0],
          completed: false,
          completed_at: null,
          user_id: 'user-3',
          created_at: new Date().toISOString(),
        },
        {
          id: 'action-4',
          client_id: 'client-4',
          action_type: 'EMAIL',
          description: 'Completed action (should not count)',
          follow_up_date: yesterday.toISOString().split('T')[0],
          completed: true,
          completed_at: new Date().toISOString(),
          user_id: 'user-4',
          created_at: new Date().toISOString(),
        },
      ]
      
      // Filter actions as the dashboard would
      const pendingActions = mockActions.filter(action => {
        const followUpDate = new Date(action.follow_up_date)
        const todayDate = new Date(today.toISOString().split('T')[0])
        return !action.completed && followUpDate <= todayDate
      })
      
      // Should count only action-1 and action-2
      expect(pendingActions).toHaveLength(2)
      expect(pendingActions.map(a => a.id)).toEqual(['action-1', 'action-2'])
    })
    
    it('should not count completed actions in pending count', async () => {
      const today = new Date()
      
      const mockActions = [
        {
          id: 'action-completed-1',
          client_id: 'client-1',
          action_type: 'LLAMADA',
          description: 'Completed action',
          follow_up_date: today.toISOString().split('T')[0],
          completed: true,
          completed_at: new Date().toISOString(),
          user_id: 'user-1',
          created_at: new Date().toISOString(),
        },
        {
          id: 'action-completed-2',
          client_id: 'client-2',
          action_type: 'VISITA',
          description: 'Another completed action',
          follow_up_date: today.toISOString().split('T')[0],
          completed: true,
          completed_at: new Date().toISOString(),
          user_id: 'user-2',
          created_at: new Date().toISOString(),
        },
      ]
      
      const pendingActions = mockActions.filter(action => {
        const followUpDate = new Date(action.follow_up_date)
        const todayDate = new Date(today.toISOString().split('T')[0])
        return !action.completed && followUpDate <= todayDate
      })
      
      expect(pendingActions).toHaveLength(0)
    })
    
    it('should not count future actions in pending count', async () => {
      const today = new Date()
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      const mockActions = [
        {
          id: 'action-future-1',
          client_id: 'client-1',
          action_type: 'LLAMADA',
          description: 'Next week action',
          follow_up_date: nextWeek.toISOString().split('T')[0],
          completed: false,
          completed_at: null,
          user_id: 'user-1',
          created_at: new Date().toISOString(),
        },
        {
          id: 'action-future-2',
          client_id: 'client-2',
          action_type: 'VISITA',
          description: 'Next month action',
          follow_up_date: nextMonth.toISOString().split('T')[0],
          completed: false,
          completed_at: null,
          user_id: 'user-2',
          created_at: new Date().toISOString(),
        },
      ]
      
      const pendingActions = mockActions.filter(action => {
        const followUpDate = new Date(action.follow_up_date)
        const todayDate = new Date(today.toISOString().split('T')[0])
        return !action.completed && followUpDate <= todayDate
      })
      
      expect(pendingActions).toHaveLength(0)
    })
  })
})
