/**
 * Unit tests for generateAlerts function
 * 
 * Tests the alert generation logic for:
 * - Birthday alerts (7 days before birthday, MEDIUM priority)
 * - Inactivity alerts (no purchases > threshold days, LOW priority)
 * - Installment due alerts (7 days before due date, MEDIUM priority)
 * - Overdue alerts (past due date, HIGH priority)
 * - Idempotence (same alerts for same date)
 * - Unique alert IDs
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { generateAlerts } from './alert-service'
import { AlertType, AlertPriority } from '@/lib/types/crm'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn()
}))

describe('generateAlerts', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()
    
    // Create mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis()
    }
    
    const { createServerClient } = require('@/lib/supabase/server')
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
  })
  
  it('should generate birthday alert for client with birthday in 7 days', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const birthdayIn7Days = new Date(today)
    birthdayIn7Days.setDate(birthdayIn7Days.getDate() + 7)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          not: jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'client-1',
                name: 'Ana María Torres',
                birthday: birthdayIn7Days.toISOString().split('T')[0]
              }
            ],
            error: null 
          })
        }
      }
      if (table === 'installments') {
        return {
          ...mockSupabase,
          lte: jest.fn().mockResolvedValue({ data: [], error: null }),
          lt: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const birthdayAlerts = alerts.filter(a => a.type === AlertType.BIRTHDAY)
    expect(birthdayAlerts).toHaveLength(1)
    expect(birthdayAlerts[0].clientId).toBe('client-1')
    expect(birthdayAlerts[0].clientName).toBe('Ana María Torres')
    expect(birthdayAlerts[0].priority).toBe(AlertPriority.MEDIUM)
    expect(birthdayAlerts[0].message).toBe('Cumpleaños en 7 días')
    expect(birthdayAlerts[0].id).toBe('birthday-client-1')
  })
  
  it('should generate birthday alert for client with birthday today', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          not: jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'client-1',
                name: 'Birthday Today',
                birthday: today.toISOString().split('T')[0]
              }
            ],
            error: null 
          })
        }
      }
      if (table === 'installments') {
        return {
          ...mockSupabase,
          lte: jest.fn().mockResolvedValue({ data: [], error: null }),
          lt: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const birthdayAlerts = alerts.filter(a => a.type === AlertType.BIRTHDAY)
    expect(birthdayAlerts).toHaveLength(1)
    expect(birthdayAlerts[0].message).toBe('Cumpleaños en 0 días')
  })
  
  it('should not generate birthday alert for client with birthday in 8 days', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const birthdayIn8Days = new Date(today)
    birthdayIn8Days.setDate(birthdayIn8Days.getDate() + 8)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          not: jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'client-1',
                name: 'Birthday Too Far',
                birthday: birthdayIn8Days.toISOString().split('T')[0]
              }
            ],
            error: null 
          })
        }
      }
      if (table === 'installments') {
        return {
          ...mockSupabase,
          lte: jest.fn().mockResolvedValue({ data: [], error: null }),
          lt: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const birthdayAlerts = alerts.filter(a => a.type === AlertType.BIRTHDAY)
    expect(birthdayAlerts).toHaveLength(0)
  })
  
  it('should generate inactivity alert for client with no purchases in 91 days', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const lastPurchase = new Date(today)
    lastPurchase.setDate(lastPurchase.getDate() - 91)
    
    let clientsCallCount = 0
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        clientsCallCount++
        const mockChain = {
          ...mockSupabase,
          not: jest.fn().mockReturnThis()
        }
        
        // First call for birthday clients
        if (clientsCallCount === 1) {
          mockChain.not = jest.fn().mockResolvedValue({ data: [], error: null })
        } else {
          // Second call for inactive clients
          mockChain.not = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'client-1',
                name: 'Inactive Client',
                last_purchase_date: lastPurchase.toISOString()
              }
            ],
            error: null 
          })
        }
        
        return mockChain
      }
      if (table === 'installments') {
        return {
          ...mockSupabase,
          lte: jest.fn().mockResolvedValue({ data: [], error: null }),
          lt: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const inactivityAlerts = alerts.filter(a => a.type === AlertType.INACTIVITY)
    expect(inactivityAlerts).toHaveLength(1)
    expect(inactivityAlerts[0].clientId).toBe('client-1')
    expect(inactivityAlerts[0].priority).toBe(AlertPriority.LOW)
    expect(inactivityAlerts[0].message).toBe('Sin compras hace 91 días')
    expect(inactivityAlerts[0].id).toBe('inactivity-client-1')
  })
  
  it('should not generate inactivity alert for client with purchase 89 days ago', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const lastPurchase = new Date(today)
    lastPurchase.setDate(lastPurchase.getDate() - 89)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        const mockChain = {
          ...mockSupabase,
          not: jest.fn().mockReturnThis()
        }
        
        // First call for birthday clients
        if (mockSupabase.not.mock.calls.length === 0) {
          mockChain.not = jest.fn().mockResolvedValue({ data: [], error: null })
        } else {
          // Second call for inactive clients
          mockChain.not = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'client-1',
                name: 'Active Client',
                last_purchase_date: lastPurchase.toISOString()
              }
            ],
            error: null 
          })
        }
        
        return mockChain
      }
      if (table === 'installments') {
        return {
          ...mockSupabase,
          lte: jest.fn().mockResolvedValue({ data: [], error: null }),
          lt: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const inactivityAlerts = alerts.filter(a => a.type === AlertType.INACTIVITY)
    expect(inactivityAlerts).toHaveLength(0)
  })
  
  it('should generate installment due alert for installment due in 5 days', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() + 5)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          not: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'installments') {
        const mockChain = {
          ...mockSupabase,
          lte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis()
        }
        
        // First call for upcoming installments
        if (mockSupabase.lte.mock.calls.length === 0) {
          mockChain.lte = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'inst-1',
                amount: 500,
                paid_amount: 0,
                due_date: dueDate.toISOString(),
                credit_plans: {
                  clients: {
                    id: 'client-1',
                    name: 'Client With Due Installment'
                  }
                }
              }
            ],
            error: null 
          })
        } else {
          // Second call for overdue installments
          mockChain.lt = jest.fn().mockResolvedValue({ data: [], error: null })
        }
        
        return mockChain
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const installmentAlerts = alerts.filter(a => a.type === AlertType.INSTALLMENT)
    expect(installmentAlerts).toHaveLength(1)
    expect(installmentAlerts[0].clientId).toBe('client-1')
    expect(installmentAlerts[0].priority).toBe(AlertPriority.MEDIUM)
    expect(installmentAlerts[0].message).toBe('Cuota vence en 5 días')
    expect(installmentAlerts[0].amount).toBe(500)
    expect(installmentAlerts[0].id).toBe('installment-inst-1')
  })
  
  it('should generate overdue alert for installment past due date', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() - 10)
    
    let installmentsCallCount = 0
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          not: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'installments') {
        installmentsCallCount++
        const mockChain = {
          ...mockSupabase,
          lte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis()
        }
        
        // First call for upcoming installments
        if (installmentsCallCount === 1) {
          mockChain.lte = jest.fn().mockResolvedValue({ data: [], error: null })
        } else {
          // Second call for overdue installments
          mockChain.lt = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'inst-1',
                amount: 1000,
                paid_amount: 300,
                due_date: dueDate.toISOString(),
                credit_plans: {
                  clients: {
                    id: 'client-1',
                    name: 'Client With Overdue'
                  }
                }
              }
            ],
            error: null 
          })
        }
        
        return mockChain
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const overdueAlerts = alerts.filter(a => a.type === AlertType.OVERDUE)
    expect(overdueAlerts).toHaveLength(1)
    expect(overdueAlerts[0].clientId).toBe('client-1')
    expect(overdueAlerts[0].priority).toBe(AlertPriority.HIGH)
    expect(overdueAlerts[0].message).toBe('Cuota vencida hace 10 días')
    expect(overdueAlerts[0].amount).toBe(700) // 1000 - 300
    expect(overdueAlerts[0].id).toBe('overdue-inst-1')
  })
  
  it('should sort alerts by priority (HIGH, MEDIUM, LOW)', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const birthdayDate = new Date(today)
    birthdayDate.setDate(birthdayDate.getDate() + 3)
    
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() + 5)
    
    const overdueDate = new Date(today)
    overdueDate.setDate(overdueDate.getDate() - 10)
    
    const lastPurchase = new Date(today)
    lastPurchase.setDate(lastPurchase.getDate() - 100)
    
    let clientsCallCount = 0
    let installmentsCallCount = 0
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        clientsCallCount++
        const mockChain = {
          ...mockSupabase,
          not: jest.fn().mockReturnThis()
        }
        
        // First call for birthday clients
        if (clientsCallCount === 1) {
          mockChain.not = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'client-1',
                name: 'Birthday Client',
                birthday: birthdayDate.toISOString().split('T')[0]
              }
            ],
            error: null 
          })
        } else {
          // Second call for inactive clients
          mockChain.not = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'client-2',
                name: 'Inactive Client',
                last_purchase_date: lastPurchase.toISOString()
              }
            ],
            error: null 
          })
        }
        
        return mockChain
      }
      if (table === 'installments') {
        installmentsCallCount++
        const mockChain = {
          ...mockSupabase,
          lte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis()
        }
        
        // First call for upcoming installments
        if (installmentsCallCount === 1) {
          mockChain.lte = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'inst-1',
                amount: 500,
                paid_amount: 0,
                due_date: dueDate.toISOString(),
                credit_plans: {
                  clients: {
                    id: 'client-3',
                    name: 'Client With Due'
                  }
                }
              }
            ],
            error: null 
          })
        } else {
          // Second call for overdue installments
          mockChain.lt = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'inst-2',
                amount: 1000,
                paid_amount: 0,
                due_date: overdueDate.toISOString(),
                credit_plans: {
                  clients: {
                    id: 'client-4',
                    name: 'Client With Overdue'
                  }
                }
              }
            ],
            error: null 
          })
        }
        
        return mockChain
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    expect(alerts).toHaveLength(4)
    expect(alerts[0].priority).toBe(AlertPriority.HIGH) // Overdue first
    expect(alerts[1].priority).toBe(AlertPriority.MEDIUM) // Birthday
    expect(alerts[2].priority).toBe(AlertPriority.MEDIUM) // Installment due
    expect(alerts[3].priority).toBe(AlertPriority.LOW) // Inactivity last
  })
  
  it('should generate unique alert IDs based on type and entity', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() + 3)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          not: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'installments') {
        const mockChain = {
          ...mockSupabase,
          lte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis()
        }
        
        // First call for upcoming installments
        if (mockSupabase.lte.mock.calls.length === 0) {
          mockChain.lte = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'inst-1',
                amount: 500,
                paid_amount: 0,
                due_date: dueDate.toISOString(),
                credit_plans: {
                  clients: {
                    id: 'client-1',
                    name: 'Client 1'
                  }
                }
              },
              {
                id: 'inst-2',
                amount: 300,
                paid_amount: 0,
                due_date: dueDate.toISOString(),
                credit_plans: {
                  clients: {
                    id: 'client-1',
                    name: 'Client 1'
                  }
                }
              }
            ],
            error: null 
          })
        } else {
          mockChain.lt = jest.fn().mockResolvedValue({ data: [], error: null })
        }
        
        return mockChain
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const alertIds = alerts.map(a => a.id)
    const uniqueIds = new Set(alertIds)
    
    expect(alertIds.length).toBe(uniqueIds.size) // All IDs should be unique
    expect(alerts[0].id).toBe('installment-inst-1')
    expect(alerts[1].id).toBe('installment-inst-2')
  })
  
  it('should use default inactivity threshold of 90 days if config not found', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const lastPurchase = new Date(today)
    lastPurchase.setDate(lastPurchase.getDate() - 91)
    
    let clientsCallCount = 0
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: null,
            error: null 
          })
        }
      }
      if (table === 'clients') {
        clientsCallCount++
        const mockChain = {
          ...mockSupabase,
          not: jest.fn().mockReturnThis()
        }
        
        // First call for birthday clients
        if (clientsCallCount === 1) {
          mockChain.not = jest.fn().mockResolvedValue({ data: [], error: null })
        } else {
          // Second call for inactive clients
          mockChain.not = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'client-1',
                name: 'Inactive Client',
                last_purchase_date: lastPurchase.toISOString()
              }
            ],
            error: null 
          })
        }
        
        return mockChain
      }
      if (table === 'installments') {
        return {
          ...mockSupabase,
          lte: jest.fn().mockResolvedValue({ data: [], error: null }),
          lt: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const inactivityAlerts = alerts.filter(a => a.type === AlertType.INACTIVITY)
    expect(inactivityAlerts).toHaveLength(1) // Should use default 90 days
  })
  
  it('should generate installment due alert for installment due today (0 days)', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          not: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'installments') {
        const mockChain = {
          ...mockSupabase,
          lte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis()
        }
        
        // First call for upcoming installments
        if (mockSupabase.lte.mock.calls.length === 0) {
          mockChain.lte = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'inst-1',
                amount: 250,
                paid_amount: 0,
                due_date: today.toISOString(),
                credit_plans: {
                  clients: {
                    id: 'client-1',
                    name: 'Client Due Today'
                  }
                }
              }
            ],
            error: null 
          })
        } else {
          mockChain.lt = jest.fn().mockResolvedValue({ data: [], error: null })
        }
        
        return mockChain
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const installmentAlerts = alerts.filter(a => a.type === AlertType.INSTALLMENT)
    expect(installmentAlerts).toHaveLength(1)
    expect(installmentAlerts[0].message).toBe('Cuota vence en 0 días')
    expect(installmentAlerts[0].amount).toBe(250)
  })
  
  it('should generate installment due alert for PARTIAL status installment', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() + 3)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          not: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'installments') {
        const mockChain = {
          ...mockSupabase,
          lte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis()
        }
        
        // First call for upcoming installments
        if (mockSupabase.lte.mock.calls.length === 0) {
          mockChain.lte = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'inst-1',
                amount: 1000,
                paid_amount: 400,
                due_date: dueDate.toISOString(),
                credit_plans: {
                  clients: {
                    id: 'client-1',
                    name: 'Client With Partial Payment'
                  }
                }
              }
            ],
            error: null 
          })
        } else {
          mockChain.lt = jest.fn().mockResolvedValue({ data: [], error: null })
        }
        
        return mockChain
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const installmentAlerts = alerts.filter(a => a.type === AlertType.INSTALLMENT)
    expect(installmentAlerts).toHaveLength(1)
    expect(installmentAlerts[0].amount).toBe(600) // 1000 - 400
    expect(installmentAlerts[0].message).toBe('Cuota vence en 3 días')
  })
  
  it('should generate overdue alert for installment overdue by 1 day', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() - 1)
    
    let installmentsCallCount = 0
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          not: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'installments') {
        installmentsCallCount++
        const mockChain = {
          ...mockSupabase,
          lte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis()
        }
        
        // First call for upcoming installments
        if (installmentsCallCount === 1) {
          mockChain.lte = jest.fn().mockResolvedValue({ data: [], error: null })
        } else {
          // Second call for overdue installments
          mockChain.lt = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'inst-1',
                amount: 500,
                paid_amount: 0,
                due_date: dueDate.toISOString(),
                credit_plans: {
                  clients: {
                    id: 'client-1',
                    name: 'Client Overdue 1 Day'
                  }
                }
              }
            ],
            error: null 
          })
        }
        
        return mockChain
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const overdueAlerts = alerts.filter(a => a.type === AlertType.OVERDUE)
    expect(overdueAlerts).toHaveLength(1)
    expect(overdueAlerts[0].message).toBe('Cuota vencida hace 1 día')
    expect(overdueAlerts[0].priority).toBe(AlertPriority.HIGH)
  })
  
  it('should handle birthday crossing year boundary', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Set birthday to 5 days from now, but in previous year
    const birthdayDate = new Date(today)
    birthdayDate.setDate(birthdayDate.getDate() + 5)
    const birthdayStr = `1990-${String(birthdayDate.getMonth() + 1).padStart(2, '0')}-${String(birthdayDate.getDate()).padStart(2, '0')}`
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          not: jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'client-1',
                name: 'Birthday Client',
                birthday: birthdayStr
              }
            ],
            error: null 
          })
        }
      }
      if (table === 'installments') {
        return {
          ...mockSupabase,
          lte: jest.fn().mockResolvedValue({ data: [], error: null }),
          lt: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const birthdayAlerts = alerts.filter(a => a.type === AlertType.BIRTHDAY)
    expect(birthdayAlerts).toHaveLength(1)
    expect(birthdayAlerts[0].message).toBe('Cumpleaños en 5 días')
  })
  
  it('should use custom inactivity threshold from config', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const lastPurchase = new Date(today)
    lastPurchase.setDate(lastPurchase.getDate() - 61)
    
    let clientsCallCount = 0
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '60' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        clientsCallCount++
        const mockChain = {
          ...mockSupabase,
          not: jest.fn().mockReturnThis()
        }
        
        // First call for birthday clients
        if (clientsCallCount === 1) {
          mockChain.not = jest.fn().mockResolvedValue({ data: [], error: null })
        } else {
          // Second call for inactive clients
          mockChain.not = jest.fn().mockResolvedValue({ 
            data: [
              {
                id: 'client-1',
                name: 'Inactive Client',
                last_purchase_date: lastPurchase.toISOString()
              }
            ],
            error: null 
          })
        }
        
        return mockChain
      }
      if (table === 'installments') {
        return {
          ...mockSupabase,
          lte: jest.fn().mockResolvedValue({ data: [], error: null }),
          lt: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    const inactivityAlerts = alerts.filter(a => a.type === AlertType.INACTIVITY)
    expect(inactivityAlerts).toHaveLength(1)
    expect(inactivityAlerts[0].message).toBe('Sin compras hace 61 días')
  })
  
  it('should not generate alerts for inactive clients', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const birthdayDate = new Date(today)
    birthdayDate.setDate(birthdayDate.getDate() + 3)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          ...mockSupabase,
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { key: 'inactivity_threshold_days', value: '90' },
            error: null 
          })
        }
      }
      if (table === 'clients') {
        return {
          ...mockSupabase,
          not: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      if (table === 'installments') {
        return {
          ...mockSupabase,
          lte: jest.fn().mockResolvedValue({ data: [], error: null }),
          lt: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      }
      return mockSupabase
    })
    
    const alerts = await generateAlerts()
    
    // Should have no alerts since all clients are inactive (active = false)
    expect(alerts).toHaveLength(0)
  })
})
