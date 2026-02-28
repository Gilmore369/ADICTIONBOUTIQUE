/**
 * Unit Tests for Action Service
 * 
 * Tests specific scenarios and edge cases for action logging:
 * - Creating each action type (NOTA, LLAMADA, VISITA, MENSAJE, REACTIVACION)
 * - Reactivation flow for inactive clients
 * - Action log retrieval and ordering
 * 
 * **Validates: Requirements 7.1, 7.4**
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { createActionLog, fetchActionLogs } from './action-service'
import { ActionType } from '@/lib/types/crm'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))

describe('Action Service - Unit Tests', () => {
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
   * Test creating each action type
   * **Validates: Requirement 7.1**
   */
  describe('createActionLog - Action Types', () => {
    it('should create NOTA action log', async () => {
      const clientId = 'client-123'
      const userId = 'user-456'
      const description = 'Cliente solicitó información sobre nuevos productos'
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: clientId, name: 'Test Client', active: true },
              error: null,
            }),
          }
        }
        
        if (table === 'client_action_logs') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'log-1',
                client_id: clientId,
                action_type: ActionType.NOTA,
                description,
                user_id: userId,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      const actionLog = await createActionLog(clientId, ActionType.NOTA, description, userId)
      
      expect(actionLog.action_type).toBe(ActionType.NOTA)
      expect(actionLog.client_id).toBe(clientId)
      expect(actionLog.user_id).toBe(userId)
      expect(actionLog.description).toBe(description)
      expect(actionLog.created_at).toBeInstanceOf(Date)
    })
    
    it('should create LLAMADA action log', async () => {
      const clientId = 'client-123'
      const userId = 'user-456'
      const description = 'Llamada para recordar pago pendiente'
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: clientId, name: 'Test Client', active: true },
              error: null,
            }),
          }
        }
        
        if (table === 'client_action_logs') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'log-2',
                client_id: clientId,
                action_type: ActionType.LLAMADA,
                description,
                user_id: userId,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      const actionLog = await createActionLog(clientId, ActionType.LLAMADA, description, userId)
      
      expect(actionLog.action_type).toBe(ActionType.LLAMADA)
      expect(actionLog.client_id).toBe(clientId)
      expect(actionLog.user_id).toBe(userId)
      expect(actionLog.description).toBe(description)
    })
    
    it('should create VISITA action log', async () => {
      const clientId = 'client-123'
      const userId = 'user-456'
      const description = 'Visita al domicilio para entrega de producto'
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: clientId, name: 'Test Client', active: true },
              error: null,
            }),
          }
        }
        
        if (table === 'client_action_logs') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'log-3',
                client_id: clientId,
                action_type: ActionType.VISITA,
                description,
                user_id: userId,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      const actionLog = await createActionLog(clientId, ActionType.VISITA, description, userId)
      
      expect(actionLog.action_type).toBe(ActionType.VISITA)
      expect(actionLog.client_id).toBe(clientId)
      expect(actionLog.user_id).toBe(userId)
      expect(actionLog.description).toBe(description)
    })
    
    it('should create MENSAJE action log', async () => {
      const clientId = 'client-123'
      const userId = 'user-456'
      const description = 'Mensaje de WhatsApp enviado con promoción especial'
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: clientId, name: 'Test Client', active: true },
              error: null,
            }),
          }
        }
        
        if (table === 'client_action_logs') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'log-4',
                client_id: clientId,
                action_type: ActionType.MENSAJE,
                description,
                user_id: userId,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      const actionLog = await createActionLog(clientId, ActionType.MENSAJE, description, userId)
      
      expect(actionLog.action_type).toBe(ActionType.MENSAJE)
      expect(actionLog.client_id).toBe(clientId)
      expect(actionLog.user_id).toBe(userId)
      expect(actionLog.description).toBe(description)
    })
    
    it('should create REACTIVACION action log', async () => {
      const clientId = 'client-123'
      const userId = 'user-456'
      const description = 'Cliente regresó después de mudanza'
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: clientId, name: 'Test Client', active: false },
              error: null,
            }),
            update: jest.fn().mockImplementation(() => ({
              eq: jest.fn().mockResolvedValue({
                data: { id: clientId, name: 'Test Client', active: true },
                error: null,
              }),
            })),
          }
        }
        
        if (table === 'client_action_logs') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'log-5',
                client_id: clientId,
                action_type: ActionType.REACTIVACION,
                description,
                user_id: userId,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      const actionLog = await createActionLog(clientId, ActionType.REACTIVACION, description, userId)
      
      expect(actionLog.action_type).toBe(ActionType.REACTIVACION)
      expect(actionLog.client_id).toBe(clientId)
      expect(actionLog.user_id).toBe(userId)
      expect(actionLog.description).toBe(description)
    })
  })
  
  /**
   * Test reactivation flow
   * **Validates: Requirement 7.5**
   */
  describe('createActionLog - Reactivation Flow', () => {
    it('should reactivate inactive client when creating REACTIVACION action', async () => {
      const clientId = 'client-inactive'
      const userId = 'user-456'
      const description = 'Cliente volvió a la zona'
      
      let clientUpdated = false
      let updatedData: any = null
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          const selectMock = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: clientId,
                name: 'Inactive Client',
                active: false,
                deactivation_reason: 'MUDADO',
                deactivated_at: '2024-01-01T00:00:00Z',
                deactivated_by: 'admin-user',
              },
              error: null,
            }),
          }
          
          const updateMock = {
            update: jest.fn().mockImplementation((data: any) => {
              clientUpdated = true
              updatedData = data
              return {
                eq: jest.fn().mockResolvedValue({
                  data: { ...data, id: clientId },
                  error: null,
                }),
              }
            }),
          }
          
          return { ...selectMock, ...updateMock }
        }
        
        if (table === 'client_action_logs') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'log-reactivation',
                client_id: clientId,
                action_type: ActionType.REACTIVACION,
                description,
                user_id: userId,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      const actionLog = await createActionLog(clientId, ActionType.REACTIVACION, description, userId)
      
      // Verify action log was created
      expect(actionLog.action_type).toBe(ActionType.REACTIVACION)
      expect(actionLog.client_id).toBe(clientId)
      
      // Verify client was updated
      expect(clientUpdated).toBe(true)
      expect(updatedData).toEqual({
        active: true,
        deactivation_reason: null,
        deactivated_at: null,
        deactivated_by: null,
      })
    })
    
    it('should not fail when reactivating already active client', async () => {
      const clientId = 'client-active'
      const userId = 'user-456'
      const description = 'Registro de reactivación (cliente ya activo)'
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'clients') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: clientId,
                name: 'Active Client',
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
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'log-reactivation-2',
                client_id: clientId,
                action_type: ActionType.REACTIVACION,
                description,
                user_id: userId,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      // Should not throw error
      const actionLog = await createActionLog(clientId, ActionType.REACTIVACION, description, userId)
      
      expect(actionLog.action_type).toBe(ActionType.REACTIVACION)
      expect(actionLog.client_id).toBe(clientId)
    })
    
    it('should throw error if client not found during reactivation', async () => {
      const clientId = 'non-existent-client'
      const userId = 'user-456'
      const description = 'Intento de reactivación'
      
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
        createActionLog(clientId, ActionType.REACTIVACION, description, userId)
      ).rejects.toThrow('Client not found')
    })
  })
  
  /**
   * Test action log retrieval and ordering
   * **Validates: Requirement 7.4**
   */
  describe('fetchActionLogs - Retrieval and Ordering', () => {
    it('should fetch action logs ordered by date (most recent first)', async () => {
      const clientId = 'client-123'
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      
      const mockLogs = [
        {
          id: 'log-1',
          client_id: clientId,
          action_type: ActionType.NOTA,
          description: 'Most recent note',
          user_id: 'user-1',
          created_at: now.toISOString(),
        },
        {
          id: 'log-2',
          client_id: clientId,
          action_type: ActionType.LLAMADA,
          description: 'Yesterday call',
          user_id: 'user-2',
          created_at: yesterday.toISOString(),
        },
        {
          id: 'log-3',
          client_id: clientId,
          action_type: ActionType.VISITA,
          description: 'Last week visit',
          user_id: 'user-3',
          created_at: lastWeek.toISOString(),
        },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'client_action_logs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockLogs,
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      const actionLogs = await fetchActionLogs(clientId)
      
      expect(actionLogs).toHaveLength(3)
      
      // Verify ordering (most recent first)
      expect(actionLogs[0].id).toBe('log-1')
      expect(actionLogs[0].created_at.getTime()).toBe(now.getTime())
      
      expect(actionLogs[1].id).toBe('log-2')
      expect(actionLogs[1].created_at.getTime()).toBe(yesterday.getTime())
      
      expect(actionLogs[2].id).toBe('log-3')
      expect(actionLogs[2].created_at.getTime()).toBe(lastWeek.getTime())
    })
    
    it('should return empty array when client has no action logs', async () => {
      const clientId = 'client-no-logs'
      
      mockSupabase.from.mockImplementation((table: string) => {
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
        
        return mockSupabase
      })
      
      const actionLogs = await fetchActionLogs(clientId)
      
      expect(actionLogs).toEqual([])
    })
    
    it('should fetch all action types for a client', async () => {
      const clientId = 'client-all-types'
      const now = new Date()
      
      const mockLogs = [
        {
          id: 'log-1',
          client_id: clientId,
          action_type: ActionType.REACTIVACION,
          description: 'Reactivation',
          user_id: 'user-1',
          created_at: new Date(now.getTime() - 1000).toISOString(),
        },
        {
          id: 'log-2',
          client_id: clientId,
          action_type: ActionType.MENSAJE,
          description: 'Message sent',
          user_id: 'user-2',
          created_at: new Date(now.getTime() - 2000).toISOString(),
        },
        {
          id: 'log-3',
          client_id: clientId,
          action_type: ActionType.VISITA,
          description: 'Visit completed',
          user_id: 'user-3',
          created_at: new Date(now.getTime() - 3000).toISOString(),
        },
        {
          id: 'log-4',
          client_id: clientId,
          action_type: ActionType.LLAMADA,
          description: 'Phone call',
          user_id: 'user-4',
          created_at: new Date(now.getTime() - 4000).toISOString(),
        },
        {
          id: 'log-5',
          client_id: clientId,
          action_type: ActionType.NOTA,
          description: 'Note added',
          user_id: 'user-5',
          created_at: new Date(now.getTime() - 5000).toISOString(),
        },
      ]
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'client_action_logs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockLogs,
              error: null,
            }),
          }
        }
        
        return mockSupabase
      })
      
      const actionLogs = await fetchActionLogs(clientId)
      
      expect(actionLogs).toHaveLength(5)
      
      // Verify all action types are present
      const actionTypes = actionLogs.map(log => log.action_type)
      expect(actionTypes).toContain(ActionType.REACTIVACION)
      expect(actionTypes).toContain(ActionType.MENSAJE)
      expect(actionTypes).toContain(ActionType.VISITA)
      expect(actionTypes).toContain(ActionType.LLAMADA)
      expect(actionTypes).toContain(ActionType.NOTA)
    })
    
    it('should throw error if database query fails', async () => {
      const clientId = 'client-error'
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'client_action_logs') {
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
      
      await expect(fetchActionLogs(clientId)).rejects.toThrow(
        'Failed to fetch action logs: Database connection failed'
      )
    })
  })
  
  /**
   * Test validation and error handling
   */
  describe('createActionLog - Validation', () => {
    it('should throw error for invalid action type', async () => {
      const clientId = 'client-123'
      const userId = 'user-456'
      const description = 'Test description'
      const invalidActionType = 'INVALID_TYPE' as ActionType
      
      await expect(
        createActionLog(clientId, invalidActionType, description, userId)
      ).rejects.toThrow('Invalid action type')
    })
    
    it('should throw error if clientId is missing', async () => {
      const userId = 'user-456'
      const description = 'Test description'
      
      await expect(
        createActionLog('', ActionType.NOTA, description, userId)
      ).rejects.toThrow('clientId, description, and userId are required')
    })
    
    it('should throw error if description is missing', async () => {
      const clientId = 'client-123'
      const userId = 'user-456'
      
      await expect(
        createActionLog(clientId, ActionType.NOTA, '', userId)
      ).rejects.toThrow('clientId, description, and userId are required')
    })
    
    it('should throw error if userId is missing', async () => {
      const clientId = 'client-123'
      const description = 'Test description'
      
      await expect(
        createActionLog(clientId, ActionType.NOTA, description, '')
      ).rejects.toThrow('clientId, description, and userId are required')
    })
  })
})
