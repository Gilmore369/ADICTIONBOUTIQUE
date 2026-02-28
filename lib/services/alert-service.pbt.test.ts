/**
 * Property-Based Tests for Alert Generation
 * 
 * Tests universal properties that must hold for all valid inputs:
 * - Property 6: Alert Generation Idempotence
 * - Property 7: Overdue Alert Generation
 * - Property 8: Birthday Alert Generation
 * - Property 23: Alert Uniqueness
 * 
 * **Validates: Requirements 3.2, 3.5, 3.7, 3.8**
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import * as fc from 'fast-check'
import { generateAlerts } from './alert-service'
import { AlertType, AlertPriority } from '@/lib/types/crm'
import { addDays, subDays } from 'date-fns'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn()
}))

describe('Alert Generation - Property-Based Tests', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
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
  
  /**
   * Property 6: Alert Generation Idempotence
   * 
   * For any specific date, generating alerts multiple times must produce 
   * the same set of alerts (same IDs, types, clients, and messages).
   * 
   * **Validates: Requirements 3.7**
   */
  describe('Property 6: Alert Generation Idempotence', () => {
    it('should generate identical alerts when called multiple times on the same date', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary test data
          fc.record({
            birthdayClients: fc.array(
              fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 50 }),
                daysUntilBirthday: fc.integer({ min: 0, max: 7 })
              }),
              { maxLength: 5 }
            ),
            inactiveClients: fc.array(
              fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 50 }),
                daysSinceLastPurchase: fc.integer({ min: 91, max: 365 })
              }),
              { maxLength: 5 }
            ),
            upcomingInstallments: fc.array(
              fc.integer({ min: 100, max: 10000 }).chain(amount =>
                fc.record({
                  id: fc.uuid(),
                  clientId: fc.uuid(),
                  clientName: fc.string({ minLength: 1, maxLength: 50 }),
                  amount: fc.constant(amount),
                  paidAmount: fc.integer({ min: 0, max: amount - 1 }),
                  daysUntilDue: fc.integer({ min: 0, max: 7 })
                })
              ),
              { maxLength: 5 }
            ),
            overdueInstallments: fc.array(
              fc.integer({ min: 100, max: 10000 }).chain(amount =>
                fc.record({
                  id: fc.uuid(),
                  clientId: fc.uuid(),
                  clientName: fc.string({ minLength: 1, maxLength: 50 }),
                  amount: fc.constant(amount),
                  paidAmount: fc.integer({ min: 0, max: amount - 1 }),
                  daysOverdue: fc.integer({ min: 1, max: 365 })
                })
              ),
              { maxLength: 5 }
            )
          }),
          async (testData) => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            
            // Setup mock data
            setupMockSupabase(testData, today)
            
            // Generate alerts twice
            const alerts1 = await generateAlerts()
            
            // Reset and setup again with same data
            jest.clearAllMocks()
            const { createServerClient } = require('@/lib/supabase/server')
            ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
            setupMockSupabase(testData, today)
            
            const alerts2 = await generateAlerts()
            
            // Verify idempotence: same alerts in same order
            expect(alerts1.length).toBe(alerts2.length)
            
            for (let i = 0; i < alerts1.length; i++) {
              expect(alerts1[i].id).toBe(alerts2[i].id)
              expect(alerts1[i].type).toBe(alerts2[i].type)
              expect(alerts1[i].clientId).toBe(alerts2[i].clientId)
              expect(alerts1[i].clientName).toBe(alerts2[i].clientName)
              expect(alerts1[i].message).toBe(alerts2[i].message)
              expect(alerts1[i].priority).toBe(alerts2[i].priority)
              expect(alerts1[i].amount).toBe(alerts2[i].amount)
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })
  
  /**
   * Property 7: Overdue Alert Generation
   * 
   * For any installment with due date before current date and status 
   * PENDING, PARTIAL, or OVERDUE, the alert generation must include 
   * an OVERDUE alert for that installment.
   * 
   * **Validates: Requirements 3.5**
   */
  describe('Property 7: Overdue Alert Generation', () => {
    it('should always generate OVERDUE alert for any installment past due date', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.integer({ min: 100, max: 10000 }).chain(amount =>
              fc.record({
                id: fc.uuid(),
                clientId: fc.uuid(),
                clientName: fc.string({ minLength: 1, maxLength: 50 }),
                amount: fc.constant(amount),
                paidAmount: fc.integer({ min: 0, max: amount - 1 }),
                daysOverdue: fc.integer({ min: 1, max: 365 }),
                status: fc.constantFrom('PENDING', 'PARTIAL', 'OVERDUE')
              })
            ),
            { minLength: 1, maxLength: 10 }
          ),
          async (overdueInstallments) => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            
            // Setup mock with only overdue installments
            setupMockSupabase({
              birthdayClients: [],
              inactiveClients: [],
              upcomingInstallments: [],
              overdueInstallments
            }, today)
            
            const alerts = await generateAlerts()
            
            // Verify: Every overdue installment must have a corresponding alert
            const overdueAlerts = alerts.filter(a => a.type === AlertType.OVERDUE)
            expect(overdueAlerts.length).toBe(overdueInstallments.length)
            
            // Verify each installment has an alert
            for (const inst of overdueInstallments) {
              const alert = overdueAlerts.find(a => a.id === `overdue-${inst.id}`)
              expect(alert).toBeDefined()
              expect(alert?.priority).toBe(AlertPriority.HIGH)
              expect(alert?.clientId).toBe(inst.clientId)
              expect(alert?.clientName).toBe(inst.clientName)
              expect(alert?.amount).toBe(Math.max(0, inst.amount - inst.paidAmount))
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })
  
  /**
   * Property 8: Birthday Alert Generation
   * 
   * For any active client with a birthday between 0 and 7 days in the future,
   * the alert generation must include a BIRTHDAY alert for that client.
   * 
   * **Validates: Requirements 3.2**
   */
  describe('Property 8: Birthday Alert Generation', () => {
    it('should always generate BIRTHDAY alert for clients with birthday within 0-7 days', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              daysUntilBirthday: fc.integer({ min: 0, max: 7 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (birthdayClients) => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            
            // Setup mock with only birthday clients
            setupMockSupabase({
              birthdayClients,
              inactiveClients: [],
              upcomingInstallments: [],
              overdueInstallments: []
            }, today)
            
            const alerts = await generateAlerts()
            
            // Verify: Every birthday client must have a corresponding alert
            const birthdayAlerts = alerts.filter(a => a.type === AlertType.BIRTHDAY)
            expect(birthdayAlerts.length).toBe(birthdayClients.length)
            
            // Verify each client has an alert
            for (const client of birthdayClients) {
              const alert = birthdayAlerts.find(a => a.id === `birthday-${client.id}`)
              expect(alert).toBeDefined()
              expect(alert?.priority).toBe(AlertPriority.MEDIUM)
              expect(alert?.clientId).toBe(client.id)
              expect(alert?.clientName).toBe(client.name)
              expect(alert?.message).toMatch(/Cumpleaños en \d+ día/)
            }
          }
        ),
        { numRuns: 50 }
      )
    })
    
    it('should NOT generate BIRTHDAY alert for clients with birthday more than 7 days away', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              daysUntilBirthday: fc.integer({ min: 8, max: 357 }) // Avoid 358-365 which wraps to within 7 days
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (birthdayClients) => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            
            // Setup mock with clients whose birthdays are too far away
            setupMockSupabase({
              birthdayClients,
              inactiveClients: [],
              upcomingInstallments: [],
              overdueInstallments: []
            }, today)
            
            const alerts = await generateAlerts()
            
            // Verify: No birthday alerts should be generated
            const birthdayAlerts = alerts.filter(a => a.type === AlertType.BIRTHDAY)
            expect(birthdayAlerts.length).toBe(0)
          }
        ),
        { numRuns: 50 }
      )
    })
  })
  
  /**
   * Property 23: Alert Uniqueness
   * 
   * For any generated set of alerts, no two alerts should have the same ID
   * (alerts are unique by type and entity).
   * 
   * **Validates: Requirements 3.8**
   */
  describe('Property 23: Alert Uniqueness', () => {
    it('should generate unique alert IDs for all alerts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            birthdayClients: fc.array(
              fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 50 }),
                daysUntilBirthday: fc.integer({ min: 0, max: 7 })
              }),
              { maxLength: 10 }
            ),
            inactiveClients: fc.array(
              fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 50 }),
                daysSinceLastPurchase: fc.integer({ min: 91, max: 365 })
              }),
              { maxLength: 10 }
            ),
            upcomingInstallments: fc.array(
              fc.integer({ min: 100, max: 10000 }).chain(amount =>
                fc.record({
                  id: fc.uuid(),
                  clientId: fc.uuid(),
                  clientName: fc.string({ minLength: 1, maxLength: 50 }),
                  amount: fc.constant(amount),
                  paidAmount: fc.integer({ min: 0, max: amount - 1 }),
                  daysUntilDue: fc.integer({ min: 0, max: 7 })
                })
              ),
              { maxLength: 10 }
            ),
            overdueInstallments: fc.array(
              fc.integer({ min: 100, max: 10000 }).chain(amount =>
                fc.record({
                  id: fc.uuid(),
                  clientId: fc.uuid(),
                  clientName: fc.string({ minLength: 1, maxLength: 50 }),
                  amount: fc.constant(amount),
                  paidAmount: fc.integer({ min: 0, max: amount - 1 }),
                  daysOverdue: fc.integer({ min: 1, max: 365 })
                })
              ),
              { maxLength: 10 }
            )
          }),
          async (testData) => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            
            setupMockSupabase(testData, today)
            
            const alerts = await generateAlerts()
            
            // Verify: All alert IDs must be unique
            const alertIds = alerts.map(a => a.id)
            const uniqueIds = new Set(alertIds)
            
            expect(alertIds.length).toBe(uniqueIds.size)
            
            // Verify ID format matches expected patterns
            for (const alert of alerts) {
              switch (alert.type) {
                case AlertType.BIRTHDAY:
                  expect(alert.id).toMatch(/^birthday-/)
                  break
                case AlertType.INACTIVITY:
                  expect(alert.id).toMatch(/^inactivity-/)
                  break
                case AlertType.INSTALLMENT:
                  expect(alert.id).toMatch(/^installment-/)
                  break
                case AlertType.OVERDUE:
                  expect(alert.id).toMatch(/^overdue-/)
                  break
              }
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })
  
  // Helper function to setup mock Supabase with test data
  function setupMockSupabase(testData: any, today: Date) {
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
          const birthdayData = testData.birthdayClients.map((client: any) => {
            const birthdayDate = addDays(today, client.daysUntilBirthday)
            return {
              id: client.id,
              name: client.name,
              birthday: birthdayDate.toISOString().split('T')[0]
            }
          })
          
          mockChain.not = jest.fn().mockResolvedValue({ 
            data: birthdayData,
            error: null 
          })
        } else {
          // Second call for inactive clients
          const inactiveData = testData.inactiveClients.map((client: any) => {
            const lastPurchaseDate = subDays(today, client.daysSinceLastPurchase)
            return {
              id: client.id,
              name: client.name,
              last_purchase_date: lastPurchaseDate.toISOString()
            }
          })
          
          mockChain.not = jest.fn().mockResolvedValue({ 
            data: inactiveData,
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
          const upcomingData = testData.upcomingInstallments.map((inst: any) => {
            const dueDate = addDays(today, inst.daysUntilDue)
            return {
              id: inst.id,
              amount: inst.amount,
              paid_amount: inst.paidAmount,
              due_date: dueDate.toISOString(),
              credit_plans: {
                clients: {
                  id: inst.clientId,
                  name: inst.clientName
                }
              }
            }
          })
          
          mockChain.lte = jest.fn().mockResolvedValue({ 
            data: upcomingData,
            error: null 
          })
        } else {
          // Second call for overdue installments
          const overdueData = testData.overdueInstallments.map((inst: any) => {
            const dueDate = subDays(today, inst.daysOverdue)
            return {
              id: inst.id,
              amount: inst.amount,
              paid_amount: inst.paidAmount,
              due_date: dueDate.toISOString(),
              credit_plans: {
                clients: {
                  id: inst.clientId,
                  name: inst.clientName
                }
              }
            }
          })
          
          mockChain.lt = jest.fn().mockResolvedValue({ 
            data: overdueData,
            error: null 
          })
        }
        
        return mockChain
      }
      
      return mockSupabase
    })
  }
})
