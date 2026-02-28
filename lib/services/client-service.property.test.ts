/**
 * Property-Based Tests for fetchClientProfile function
 * 
 * Tests universal properties that must hold for all valid inputs:
 * - Property 3: Credit Available Calculation
 * - Property 13: Installments Ordered by Due Date
 * - Property 14: Purchase History Ordered by Date
 * - Property 21: Days Overdue Calculation
 * 
 * Uses fast-check library for property-based testing
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import * as fc from 'fast-check'
import { fetchClientProfile } from './client-service'
import { differenceInDays } from 'date-fns'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))

describe('fetchClientProfile - Property-Based Tests', () => {
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
   * Property 3: Credit Available Calculation
   * **Validates: Requirements 10.4**
   * 
   * For any client with credit information, the available credit must equal
   * credit limit minus credit used.
   */
  it('Property 3: creditAvailable = creditLimit - creditUsed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          creditLimit: fc.integer({ min: 0, max: 100000 }),
          creditUsed: fc.integer({ min: 0, max: 100000 }),
        }),
        async ({ clientId, creditLimit, creditUsed }) => {
          // Setup mock to return client with specified credit values
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: clientId,
                    name: 'Test Client',
                    credit_limit: creditLimit,
                    credit_used: creditUsed,
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
          
          // Property: creditAvailable = creditLimit - creditUsed
          const expectedAvailable = creditLimit - creditUsed
          expect(profile.creditSummary.creditAvailable).toBe(expectedAvailable)
          expect(profile.creditSummary.creditLimit).toBe(creditLimit)
          expect(profile.creditSummary.creditUsed).toBe(creditUsed)
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * Property 13: Installments Ordered by Due Date
   * **Validates: Requirements 1.3**
   * 
   * For any client profile, the installments array must be sorted by due date
   * in ascending order (earliest first).
   */
  it('Property 13: installments are ordered by due date (earliest first)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          installments: fc.array(
            fc.record({
              id: fc.uuid(),
              installmentNumber: fc.integer({ min: 1, max: 12 }),
              amount: fc.integer({ min: 100, max: 10000 }),
              // Use integer timestamps to avoid invalid dates
              dueDateTimestamp: fc.integer({ 
                min: new Date('2020-01-01').getTime(), 
                max: new Date('2030-12-31').getTime() 
              }),
              paidAmount: fc.integer({ min: 0, max: 10000 }),
              status: fc.constantFrom('PENDING', 'PARTIAL', 'PAID', 'OVERDUE'),
              paidAtTimestamp: fc.option(
                fc.integer({ 
                  min: new Date('2020-01-01').getTime(), 
                  max: new Date('2030-12-31').getTime() 
                }), 
                { nil: null }
              ),
            }),
            { minLength: 2, maxLength: 20 }
          ),
        }),
        async ({ clientId, installments }) => {
          // Setup mock to return client with installments
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
                    credit_used: 5000,
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
                  data: installments.map((inst) => ({
                    id: inst.id,
                    installment_number: inst.installmentNumber,
                    amount: inst.amount,
                    due_date: new Date(inst.dueDateTimestamp).toISOString(),
                    paid_amount: inst.paidAmount,
                    status: inst.status,
                    paid_at: inst.paidAtTimestamp ? new Date(inst.paidAtTimestamp).toISOString() : null,
                    credit_plans: {
                      id: 'plan-1',
                      sale_number: 'S001',
                      client_id: clientId,
                    },
                  })),
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
          
          // Property: installments are sorted by due date ascending
          for (let i = 0; i < profile.installments.length - 1; i++) {
            const current = profile.installments[i].dueDate
            const next = profile.installments[i + 1].dueDate
            expect(current.getTime()).toBeLessThanOrEqual(next.getTime())
          }
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * Property 14: Purchase History Ordered by Date
   * **Validates: Requirements 1.4**
   * 
   * For any client profile, the purchase history array must be sorted by date
   * in descending order (most recent first).
   */
  it('Property 14: purchase history is ordered by date (most recent first)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          purchases: fc.array(
            fc.record({
              id: fc.uuid(),
              saleNumber: fc.string({ minLength: 3, maxLength: 10 }),
              // Use integer timestamps to avoid invalid dates and ensure uniqueness
              createdAtTimestamp: fc.integer({ 
                min: new Date('2020-01-01').getTime(), 
                max: new Date('2030-12-31').getTime() 
              }),
              total: fc.integer({ min: 100, max: 50000 }),
              saleType: fc.constantFrom('CONTADO', 'CREDITO'),
              paymentStatus: fc.constantFrom('PAID', 'PENDING', 'PARTIAL'),
            }),
            { minLength: 2, maxLength: 20 }
          ),
        }),
        async ({ clientId, purchases }) => {
          // Sort purchases by date descending (most recent first) to simulate database order
          const sortedPurchases = [...purchases].sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp)
          
          // Setup mock to return client with purchases
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
                    credit_used: 5000,
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
                  data: sortedPurchases.map((p) => ({
                    id: p.id,
                    sale_number: p.saleNumber,
                    created_at: new Date(p.createdAtTimestamp).toISOString(),
                    total: p.total,
                    sale_type: p.saleType,
                    payment_status: p.paymentStatus,
                  })),
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
          
          // Property: purchase history is sorted by date descending (most recent first)
          for (let i = 0; i < profile.purchaseHistory.length - 1; i++) {
            const current = profile.purchaseHistory[i].date
            const next = profile.purchaseHistory[i + 1].date
            expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime())
          }
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * Property 21: Days Overdue Calculation
   * **Validates: Requirements 11.1**
   * 
   * For any installment with due_date before current date, the calculated
   * days overdue must equal the difference in days between current date and due_date.
   */
  it('Property 21: daysOverdue = currentDate - dueDate for overdue installments', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.uuid(),
          installments: fc.array(
            fc.record({
              id: fc.uuid(),
              installmentNumber: fc.integer({ min: 1, max: 12 }),
              amount: fc.integer({ min: 100, max: 10000 }),
              // Use integer timestamps to avoid invalid dates
              dueDateTimestamp: fc.integer({ 
                min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).getTime(), // 1 year ago
                max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).getTime()  // 1 year from now
              }),
              paidAmount: fc.integer({ min: 0, max: 5000 }),
              status: fc.constantFrom('PENDING', 'PARTIAL', 'OVERDUE'),
            }),
            { minLength: 1, maxLength: 15 }
          ),
        }),
        async ({ clientId, installments }) => {
          // Setup mock to return client with installments
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
                    credit_used: 5000,
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
                  data: installments.map((inst) => ({
                    id: inst.id,
                    installment_number: inst.installmentNumber,
                    amount: inst.amount,
                    due_date: new Date(inst.dueDateTimestamp).toISOString(),
                    paid_amount: inst.paidAmount,
                    status: inst.status,
                    paid_at: null,
                    credit_plans: {
                      id: 'plan-1',
                      sale_number: 'S001',
                      client_id: clientId,
                    },
                  })),
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
          const today = new Date()
          
          // Property: daysOverdue calculation is correct
          for (const installment of profile.installments) {
            const expectedDaysOverdue = installment.dueDate < today
              ? differenceInDays(today, installment.dueDate)
              : 0
            
            expect(installment.daysOverdue).toBe(expectedDaysOverdue)
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})

/**
 * Property-Based Tests for filterClients function
 * 
 * Tests universal properties that must hold for all valid inputs:
 * - Property 9: Filter Results Match All Criteria
 * - Property 22: Filtered Results Alphabetical Order
 * 
 * Uses fast-check library for property-based testing
 */

describe('filterClients - Property-Based Tests', () => {
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
   * Property 9: Filter Results Match All Criteria
   * **Validates: Requirements 5.1**
   * 
   * For any set of filter criteria and any client in the filtered results,
   * that client must satisfy ALL specified filter conditions (AND logic).
   */
  it('Property 9: all filtered clients match ALL specified criteria (AND logic)', async () => {
    const { filterClients } = await import('./client-service')
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate a set of clients with various properties
          clients: fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 30 }),
              active: fc.boolean(),
              credit_used: fc.integer({ min: 0, max: 50000 }),
              credit_limit: fc.integer({ min: 0, max: 100000 }),
              rating: fc.constantFrom('A', 'B', 'C', 'D', null),
              birthday: fc.option(
                fc.date({ 
                  min: new Date('1950-01-01'), 
                  max: new Date('2005-12-31') 
                }),
                { nil: null }
              ),
              last_purchase_date: fc.option(
                fc.date({ 
                  min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
                  max: new Date() 
                }),
                { nil: null }
              ),
              deactivation_reason: fc.option(
                fc.constantFrom('FALLECIDO', 'MUDADO', 'DESAPARECIDO', 'OTRO'),
                { nil: null }
              ),
            }),
            { minLength: 5, maxLength: 30 }
          ),
          // Generate filter criteria
          filters: fc.record({
            status: fc.option(
              fc.constantFrom('ACTIVO', 'INACTIVO', 'BAJA'),
              { nil: undefined }
            ),
            rating: fc.option(
              fc.array(fc.constantFrom('A', 'B', 'C', 'D'), { minLength: 1, maxLength: 4 }),
              { nil: undefined }
            ),
            birthdayMonth: fc.option(
              fc.integer({ min: 1, max: 12 }),
              { nil: undefined }
            ),
            daysSinceLastPurchase: fc.option(
              fc.integer({ min: 30, max: 180 }),
              { nil: undefined }
            ),
          }),
        }),
        async ({ clients, filters }) => {
          // Setup mock to return the generated clients
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              const queryMock = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                not: jest.fn().mockReturnThis(),
              }
              
              // Apply server-side filters to simulate database behavior
              let filteredClients = [...clients]
              
              // Apply status filter
              if (filters.status === 'ACTIVO') {
                filteredClients = filteredClients.filter((c: any) => c.active === true)
              } else if (filters.status === 'INACTIVO' || filters.status === 'BAJA') {
                filteredClients = filteredClients.filter((c: any) => c.active === false)
              }
              
              // Apply rating filter (server-side via SQL IN clause)
              if (filters.rating && filters.rating.length > 0) {
                filteredClients = filteredClients.filter((c: any) => 
                  c.rating && filters.rating!.includes(c.rating)
                )
              }
              
              // Apply deactivation reason filter
              if (filters.deactivationReason && filters.deactivationReason.length > 0) {
                filteredClients = filteredClients.filter((c: any) => 
                  c.deactivation_reason && filters.deactivationReason!.includes(c.deactivation_reason)
                )
              }
              
              // Return clients with ratings
              const clientsWithRatings = filteredClients.map((c: any) => ({
                ...c,
                birthday: c.birthday ? c.birthday.toISOString() : null,
                last_purchase_date: c.last_purchase_date ? c.last_purchase_date.toISOString() : null,
                client_ratings: c.rating ? { rating: c.rating, score: 75 } : null,
              }))
              
              // Simulate the query chain returning data
              Object.assign(queryMock, {
                then: (resolve: any) => resolve({ data: clientsWithRatings, error: null }),
              })
              
              return queryMock
            }
            
            if (table === 'installments') {
              return {
                select: jest.fn().mockReturnThis(),
                in: jest.fn().mockResolvedValue({ data: [], error: null }),
              }
            }
            
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const result = await filterClients(filters as any)
          
          // Property: Every client in the result must match ALL filter criteria
          const today = new Date()
          
          for (const client of result) {
            // Check status filter
            if (filters.status === 'ACTIVO') {
              expect(client.active).toBe(true)
            } else if (filters.status === 'INACTIVO' || filters.status === 'BAJA') {
              expect(client.active).toBe(false)
            }
            
            // Check rating filter
            if (filters.rating && filters.rating.length > 0) {
              expect(filters.rating).toContain(client.rating)
            }
            
            // Check birthday month filter
            if (filters.birthdayMonth !== undefined) {
              expect(client.birthday).not.toBeNull()
              if (client.birthday) {
                const birthdayDate = new Date(client.birthday)
                expect(birthdayDate.getMonth() + 1).toBe(filters.birthdayMonth)
              }
            }
            
            // Check days since last purchase filter
            if (filters.daysSinceLastPurchase !== undefined) {
              expect(client.last_purchase_date).not.toBeNull()
              if (client.last_purchase_date) {
                const lastPurchaseDate = new Date(client.last_purchase_date)
                const daysSince = differenceInDays(today, lastPurchaseDate)
                expect(daysSince).toBeGreaterThan(filters.daysSinceLastPurchase)
              }
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * Property 22: Filtered Results Alphabetical Order
   * **Validates: Requirements 5.10**
   * 
   * For any set of filtered clients, the results must be sorted alphabetically
   * by client name in ascending order.
   */
  it('Property 22: filtered clients are sorted alphabetically by name', async () => {
    const { filterClients } = await import('./client-service')
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate clients with random names
          clients: fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 30 }),
              active: fc.boolean(),
              credit_used: fc.integer({ min: 0, max: 50000 }),
              credit_limit: fc.integer({ min: 0, max: 100000 }),
              rating: fc.constantFrom('A', 'B', 'C', 'D', null),
              birthday: fc.option(
                fc.date({ 
                  min: new Date('1950-01-01'), 
                  max: new Date('2005-12-31') 
                }),
                { nil: null }
              ),
              last_purchase_date: fc.option(
                fc.date({ 
                  min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
                  max: new Date() 
                }),
                { nil: null }
              ),
              deactivation_reason: fc.option(
                fc.constantFrom('FALLECIDO', 'MUDADO', 'DESAPARECIDO', 'OTRO'),
                { nil: null }
              ),
            }),
            { minLength: 3, maxLength: 20 }
          ),
          // Generate simple filter to ensure we get some results
          filters: fc.record({
            status: fc.option(
              fc.constantFrom('ACTIVO', 'INACTIVO'),
              { nil: undefined }
            ),
          }),
        }),
        async ({ clients, filters }) => {
          // Setup mock to return the generated clients
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              const queryMock = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                not: jest.fn().mockReturnThis(),
              }
              
              // Return clients with ratings
              const clientsWithRatings = clients.map((c: any) => ({
                ...c,
                birthday: c.birthday ? c.birthday.toISOString() : null,
                last_purchase_date: c.last_purchase_date ? c.last_purchase_date.toISOString() : null,
                client_ratings: c.rating ? { rating: c.rating, score: 75 } : null,
              }))
              
              // Simulate the query chain returning data
              Object.assign(queryMock, {
                then: (resolve: any) => resolve({ data: clientsWithRatings, error: null }),
              })
              
              return queryMock
            }
            
            if (table === 'installments') {
              return {
                select: jest.fn().mockReturnThis(),
                in: jest.fn().mockResolvedValue({ data: [], error: null }),
              }
            }
            
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const result = await filterClients(filters as any)
          
          // Property: Results are sorted alphabetically by name (case-insensitive)
          for (let i = 0; i < result.length - 1; i++) {
            const currentName = (result[i].name || '').toLowerCase()
            const nextName = (result[i + 1].name || '').toLowerCase()
            
            // Use localeCompare to match the implementation's sorting logic
            expect(currentName.localeCompare(nextName)).toBeLessThanOrEqual(0)
          }
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * Additional Property Test: Empty Filters Return All Clients
   * 
   * When no filters are applied, all clients should be returned (sorted alphabetically).
   */
  it('Property: empty filters return all clients sorted alphabetically', async () => {
    const { filterClients } = await import('./client-service')
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 30 }),
            active: fc.boolean(),
            credit_used: fc.integer({ min: 0, max: 50000 }),
            credit_limit: fc.integer({ min: 0, max: 100000 }),
            rating: fc.constantFrom('A', 'B', 'C', 'D', null),
            birthday: fc.option(
              fc.date({ 
                min: new Date('1950-01-01'), 
                max: new Date('2005-12-31') 
              }),
              { nil: null }
            ),
            last_purchase_date: fc.option(
              fc.date({ 
                min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
                max: new Date() 
              }),
              { nil: null }
            ),
            deactivation_reason: fc.option(
              fc.constantFrom('FALLECIDO', 'MUDADO', 'DESAPARECIDO', 'OTRO'),
              { nil: null }
            ),
          }),
          { minLength: 2, maxLength: 15 }
        ),
        async (clients) => {
          // Setup mock to return the generated clients
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'clients') {
              const queryMock = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                not: jest.fn().mockReturnThis(),
              }
              
              // Return clients with ratings
              const clientsWithRatings = clients.map((c: any) => ({
                ...c,
                birthday: c.birthday ? c.birthday.toISOString() : null,
                last_purchase_date: c.last_purchase_date ? c.last_purchase_date.toISOString() : null,
                client_ratings: c.rating ? { rating: c.rating, score: 75 } : null,
              }))
              
              // Simulate the query chain returning data
              Object.assign(queryMock, {
                then: (resolve: any) => resolve({ data: clientsWithRatings, error: null }),
              })
              
              return queryMock
            }
            
            if (table === 'installments') {
              return {
                select: jest.fn().mockReturnThis(),
                in: jest.fn().mockResolvedValue({ data: [], error: null }),
              }
            }
            
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const result = await filterClients({})
          
          // Property: All clients are returned
          expect(result.length).toBe(clients.length)
          
          // Property: Results are sorted alphabetically
          for (let i = 0; i < result.length - 1; i++) {
            const currentName = (result[i].name || '').toLowerCase()
            const nextName = (result[i + 1].name || '').toLowerCase()
            expect(currentName.localeCompare(nextName)).toBeLessThanOrEqual(0)
          }
        }
      ),
      { numRuns: 30 }
    )
  })
})
