/**
 * Property-Based Tests for Export Service
 * 
 * Tests universal properties that must hold for all valid inputs:
 * - Property 19: Export Contains All Filtered Clients
 * - Property 20: Export Column Completeness
 * 
 * Uses fast-check library for property-based testing
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import * as fc from 'fast-check'
import { exportClients, generateExportFilename } from './export-service'
import { ClientFilters } from '@/lib/types/crm'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))

// Mock the client-service
jest.mock('./client-service', () => ({
  filterClients: jest.fn(),
}))

describe('exportClients - Property-Based Tests', () => {
  let mockSupabase: any
  let mockFilterClients: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = {
      from: jest.fn(),
    }
    
    const { createServerClient } = require('@/lib/supabase/server')
    createServerClient.mockResolvedValue(mockSupabase)
    
    const clientService = require('./client-service')
    mockFilterClients = clientService.filterClients
  })
  
  /**
   * Property 19: Export Contains All Filtered Clients
   * **Validates: Requirements 9.1**
   * 
   * For any set of filter criteria, the generated CSV export must contain
   * exactly the clients that match those criteria and no others.
   */
  it('Property 19: export contains exactly all filtered clients', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          filters: fc.record({
            debtStatus: fc.option(fc.constantFrom('AL_DIA', 'CON_DEUDA', 'MOROSO'), { nil: undefined }),
            rating: fc.option(fc.array(fc.constantFrom('A', 'B', 'C', 'D'), { minLength: 1, maxLength: 4 }), { nil: undefined }),
          }),
          clients: fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 50 }),
              dni: fc.string({ minLength: 8, maxLength: 11 }),
              phone: fc.string({ minLength: 10, maxLength: 15 }),
              address: fc.string({ minLength: 5, maxLength: 100 }),
              credit_limit: fc.float({ min: 0, max: 100000, noNaN: true }),
              credit_used: fc.float({ min: 0, max: 50000, noNaN: true }),
              rating: fc.option(fc.constantFrom('A', 'B', 'C', 'D'), { nil: null }),
              last_purchase_date: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() }), { nil: null }),
              active: fc.boolean(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          userRole: fc.constantFrom('admin', 'vendedor'),
        }),
        async ({ filters, clients, userRole }) => {
          // Mock filterClients to return the generated clients
          mockFilterClients.mockResolvedValue(clients)
          
          // Mock installments query
          mockSupabase.from.mockImplementation((table: string) => {
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
          
          // Generate CSV export
          const csv = await exportClients(filters, userRole)
          
          // Parse CSV to extract rows
          const lines = csv.split('\n')
          const headers = lines[0]
          const dataRows = lines.slice(1).filter(line => line.trim() !== '')
          
          // Property 1: Number of data rows must equal number of filtered clients
          expect(dataRows.length).toBe(clients.length)
          
          // Property 2: Each client must appear exactly once in the export
          const clientNames = clients.map(c => c.name)
          dataRows.forEach((row) => {
            // Parse the row to extract the name (first column)
            const columns = parseCSVRow(row)
            const name = columns[0]
            expect(clientNames).toContain(name)
          })
          
          // Property 3: No duplicate clients in export
          const exportedNames = dataRows.map((row) => {
            const columns = parseCSVRow(row)
            return columns[0]
          })
          const uniqueNames = new Set(exportedNames)
          expect(uniqueNames.size).toBe(exportedNames.length)
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * Property 20: Export Column Completeness
   * **Validates: Requirements 9.2**
   * 
   * For any generated CSV export, each row must contain all required columns:
   * name, DNI, phone, address, credit limit, credit used, total debt,
   * overdue debt, rating, last purchase, and status.
   */
  it('Property 20: export contains all required columns', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          filters: fc.record({
            debtStatus: fc.option(fc.constantFrom('AL_DIA', 'CON_DEUDA', 'MOROSO'), { nil: undefined }),
          }),
          clients: fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 50 }),
              dni: fc.string({ minLength: 8, maxLength: 11 }),
              phone: fc.string({ minLength: 10, maxLength: 15 }),
              address: fc.string({ minLength: 5, maxLength: 100 }),
              credit_limit: fc.float({ min: 0, max: 100000, noNaN: true }),
              credit_used: fc.float({ min: 0, max: 50000, noNaN: true }),
              rating: fc.option(fc.constantFrom('A', 'B', 'C', 'D'), { nil: null }),
              last_purchase_date: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() }), { nil: null }),
              active: fc.boolean(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          userRole: fc.constantFrom('admin', 'vendedor'),
        }),
        async ({ filters, clients, userRole }) => {
          // Mock filterClients to return the generated clients
          mockFilterClients.mockResolvedValue(clients)
          
          // Mock installments query
          mockSupabase.from.mockImplementation((table: string) => {
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
          
          // Generate CSV export
          const csv = await exportClients(filters, userRole)
          
          // Parse CSV
          const lines = csv.split('\n')
          const headers = lines[0].split(',')
          const dataRows = lines.slice(1).filter(line => line.trim() !== '')
          
          // Property 1: Headers must contain all required columns
          const requiredHeaders = [
            'Nombre',
            'DNI',
            'Teléfono',
            'Dirección',
            'Límite de Crédito',
            'Crédito Usado',
            'Deuda Total',
            'Deuda Vencida',
            'Calificación',
            'Última Compra',
            'Estado',
          ]
          
          expect(headers.length).toBe(requiredHeaders.length)
          requiredHeaders.forEach((header) => {
            expect(headers).toContain(header)
          })
          
          // Property 2: Each data row must have the same number of columns as headers
          dataRows.forEach((row) => {
            // Count columns (accounting for quoted fields with commas)
            const columns = parseCSVRow(row)
            expect(columns.length).toBe(headers.length)
          })
          
          // Property 3: Each row must have non-empty values for required fields
          dataRows.forEach((row) => {
            const columns = parseCSVRow(row)
            
            // Name (column 0) must not be empty
            expect(columns[0]).toBeTruthy()
            
            // Status (column 10) must not be empty
            expect(columns[10]).toBeTruthy()
            expect(['Activo', 'Inactivo']).toContain(columns[10])
          })
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * Additional Property Test: Data masking for non-admin users
   * 
   * For any non-admin user, sensitive data (DNI, phone) must be masked
   * in the export.
   */
  it('Property: non-admin users receive masked sensitive data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          filters: fc.record({}),
          clients: fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 50 }),
              dni: fc.string({ minLength: 8, maxLength: 11 }),
              phone: fc.string({ minLength: 10, maxLength: 15 }),
              address: fc.string({ minLength: 5, maxLength: 100 }),
              credit_limit: fc.float({ min: 0, max: 100000, noNaN: true }),
              credit_used: fc.float({ min: 0, max: 50000, noNaN: true }),
              rating: fc.option(fc.constantFrom('A', 'B', 'C', 'D'), { nil: null }),
              last_purchase_date: fc.option(
                fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
                { nil: null }
              ),
              active: fc.boolean(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
        }),
        async ({ filters, clients }) => {
          // Mock filterClients to return the generated clients
          mockFilterClients.mockResolvedValue(clients)
          
          // Mock installments query
          mockSupabase.from.mockImplementation((table: string) => {
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
          
          // Generate CSV export for non-admin user
          const csv = await exportClients(filters, 'vendedor')
          
          // Parse CSV
          const lines = csv.split('\n')
          const dataRows = lines.slice(1).filter(line => line.trim() !== '')
          
          // Property: DNI and phone columns must be masked (contain ****)
          dataRows.forEach((row, index) => {
            const columns = parseCSVRow(row)
            const dni = columns[1] // DNI is column 1
            const phone = columns[2] // Phone is column 2
            
            // Both should contain **** for masking
            expect(dni).toContain('****')
            expect(phone).toContain('****')
          })
        }
      ),
      { numRuns: 30 }
    )
  })
  
  /**
   * Additional Property Test: Admin users receive unmasked data
   * 
   * For any admin user, sensitive data (DNI, phone) must NOT be masked
   * in the export.
   */
  it('Property: admin users receive unmasked sensitive data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          filters: fc.record({}),
          clients: fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 50 }),
              dni: fc.string({ minLength: 8, maxLength: 11 }),
              phone: fc.string({ minLength: 10, maxLength: 15 }),
              address: fc.string({ minLength: 5, maxLength: 100 }),
              credit_limit: fc.float({ min: 0, max: 100000, noNaN: true }),
              credit_used: fc.float({ min: 0, max: 50000, noNaN: true }),
              rating: fc.option(fc.constantFrom('A', 'B', 'C', 'D'), { nil: null }),
              last_purchase_date: fc.option(
                fc.date({ min: new Date('2020-01-01'), max: new Date() }).filter(d => !isNaN(d.getTime())),
                { nil: null }
              ),
              active: fc.boolean(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
        }),
        async ({ filters, clients }) => {
          // Mock filterClients to return the generated clients
          mockFilterClients.mockResolvedValue(clients)
          
          // Mock installments query
          mockSupabase.from.mockImplementation((table: string) => {
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
          
          // Generate CSV export for admin user
          const csv = await exportClients(filters, 'admin')
          
          // Parse CSV
          const lines = csv.split('\n')
          const dataRows = lines.slice(1).filter(line => line.trim() !== '')
          
          // Property: DNI and phone columns must match original data (not masked)
          dataRows.forEach((row, index) => {
            const columns = parseCSVRow(row)
            const dni = columns[1] // DNI is column 1
            const phone = columns[2] // Phone is column 2
            const client = clients[index]
            
            // Should match original data
            expect(dni).toBe(client.dni)
            expect(phone).toBe(client.phone)
          })
        }
      ),
      { numRuns: 30 }
    )
  })
  
  /**
   * Test: Export filename generation
   */
  it('generates valid export filename with timestamp', () => {
    const filename = generateExportFilename()
    
    // Should match pattern: clientes_YYYY-MM-DD_HH-mm-ss.csv
    expect(filename).toMatch(/^clientes_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/)
  })
})

/**
 * Helper function to parse CSV row accounting for quoted fields
 */
function parseCSVRow(row: string): string[] {
  const columns: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i]
    
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of column
      columns.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  // Add last column
  columns.push(current)
  
  return columns
}
