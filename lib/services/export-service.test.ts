/**
 * Unit Tests for Export Service
 * 
 * Tests specific examples and edge cases for export functionality:
 * - CSV generation with sample data
 * - Date and amount formatting
 * - Data masking for non-admin users
 * 
 * Requirements: 9.3, 9.4, 9.5
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
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

describe('exportClients - Unit Tests', () => {
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
   * Test CSV generation with sample data
   * Requirements: 9.1, 9.2
   */
  it('generates CSV with correct structure and sample data', async () => {
    const sampleClients = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Juan Pérez',
        dni: '12345678',
        phone: '1234567890',
        address: 'Calle Principal 123',
        credit_limit: 10000,
        credit_used: 5000,
        rating: 'A',
        last_purchase_date: new Date('2024-01-15'),
        active: true,
      },
      {
        id: '223e4567-e89b-12d3-a456-426614174001',
        name: 'María García',
        dni: '87654321',
        phone: '0987654321',
        address: 'Avenida Central 456',
        credit_limit: 15000,
        credit_used: 3000,
        rating: 'B',
        last_purchase_date: new Date('2024-02-20'),
        active: true,
      },
    ]
    
    mockFilterClients.mockResolvedValue(sampleClients)
    
    // Mock installments with debt data
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'installments') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'inst1',
                amount: 2000,
                paid_amount: 500,
                due_date: new Date('2024-03-01').toISOString(),
                status: 'PARTIAL',
                credit_plans: { client_id: '123e4567-e89b-12d3-a456-426614174000' },
              },
              {
                id: 'inst2',
                amount: 1500,
                paid_amount: 0,
                due_date: new Date('2023-12-01').toISOString(),
                status: 'OVERDUE',
                credit_plans: { client_id: '123e4567-e89b-12d3-a456-426614174000' },
              },
            ],
            error: null,
          }),
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
    
    const csv = await exportClients({}, 'admin')
    
    // Verify CSV structure
    const lines = csv.split('\n')
    expect(lines.length).toBe(3) // Header + 2 data rows
    
    // Verify headers
    const headers = lines[0]
    expect(headers).toContain('Nombre')
    expect(headers).toContain('DNI')
    expect(headers).toContain('Teléfono')
    expect(headers).toContain('Dirección')
    expect(headers).toContain('Límite de Crédito')
    expect(headers).toContain('Crédito Usado')
    expect(headers).toContain('Deuda Total')
    expect(headers).toContain('Deuda Vencida')
    expect(headers).toContain('Calificación')
    expect(headers).toContain('Última Compra')
    expect(headers).toContain('Estado')
    
    // Verify first client data
    expect(lines[1]).toContain('Juan Pérez')
    expect(lines[1]).toContain('12345678')
    expect(lines[1]).toContain('1234567890')
    expect(lines[1]).toContain('A')
    expect(lines[1]).toContain('Activo')
    
    // Verify second client data
    expect(lines[2]).toContain('María García')
    expect(lines[2]).toContain('87654321')
    expect(lines[2]).toContain('B')
  })
  
  /**
   * Test date formatting as ISO 8601 (YYYY-MM-DD)
   * Requirements: 9.3
   */
  it('formats dates as ISO 8601 (YYYY-MM-DD)', async () => {
    const sampleClients = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Client',
        dni: '12345678',
        phone: '1234567890',
        address: 'Test Address',
        credit_limit: 10000,
        credit_used: 0,
        rating: 'A',
        last_purchase_date: new Date('2024-03-15T14:30:00Z'),
        active: true,
      },
    ]
    
    mockFilterClients.mockResolvedValue(sampleClients)
    
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
    
    const csv = await exportClients({}, 'admin')
    
    // Verify date is formatted as YYYY-MM-DD (not including time)
    expect(csv).toContain('2024-03-15')
    expect(csv).not.toContain('14:30')
    // Check that the date doesn't have ISO timestamp format (no 'T' followed by time)
    expect(csv).not.toMatch(/2024-03-15T\d{2}:\d{2}/)
  })
  
  /**
   * Test amount formatting with two decimals
   * Requirements: 9.4
   */
  it('formats amounts with two decimals', async () => {
    const sampleClients = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Client',
        dni: '12345678',
        phone: '1234567890',
        address: 'Test Address',
        credit_limit: 10000.5,
        credit_used: 5000.75,
        rating: 'A',
        last_purchase_date: new Date('2024-01-15'),
        active: true,
      },
    ]
    
    mockFilterClients.mockResolvedValue(sampleClients)
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'installments') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'inst1',
                amount: 1234.567,
                paid_amount: 234.123,
                due_date: new Date('2024-03-01').toISOString(),
                status: 'PARTIAL',
                credit_plans: { client_id: '123e4567-e89b-12d3-a456-426614174000' },
              },
            ],
            error: null,
          }),
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
    
    const csv = await exportClients({}, 'admin')
    
    // Verify amounts are formatted with exactly 2 decimals
    expect(csv).toContain('10000.50') // credit_limit
    expect(csv).toContain('5000.75') // credit_used
    expect(csv).toContain('1000.44') // total debt (1234.567 - 234.123 = 1000.444 rounded to 1000.44)
  })
  
  /**
   * Test data masking for non-admin users
   * Requirements: 9.5
   */
  it('masks DNI and phone for non-admin users', async () => {
    const sampleClients = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Client',
        dni: '12345678',
        phone: '1234567890',
        address: 'Test Address',
        credit_limit: 10000,
        credit_used: 0,
        rating: 'A',
        last_purchase_date: new Date('2024-01-15'),
        active: true,
      },
    ]
    
    mockFilterClients.mockResolvedValue(sampleClients)
    
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
    
    const csv = await exportClients({}, 'vendedor')
    
    // Verify DNI is masked (shows only last 4 digits)
    expect(csv).toContain('****5678')
    expect(csv).not.toContain('12345678')
    
    // Verify phone is masked (shows only last 4 digits)
    expect(csv).toContain('****7890')
    expect(csv).not.toContain('1234567890')
    
    // Verify name and other fields are not masked
    expect(csv).toContain('Test Client')
    expect(csv).toContain('Test Address')
  })
  
  /**
   * Test that admin users see unmasked data
   * Requirements: 9.5
   */
  it('does not mask data for admin users', async () => {
    const sampleClients = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Client',
        dni: '12345678',
        phone: '1234567890',
        address: 'Test Address',
        credit_limit: 10000,
        credit_used: 0,
        rating: 'A',
        last_purchase_date: new Date('2024-01-15'),
        active: true,
      },
    ]
    
    mockFilterClients.mockResolvedValue(sampleClients)
    
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
    
    const csv = await exportClients({}, 'admin')
    
    // Verify DNI is NOT masked
    expect(csv).toContain('12345678')
    expect(csv).not.toContain('****5678')
    
    // Verify phone is NOT masked
    expect(csv).toContain('1234567890')
    expect(csv).not.toContain('****7890')
  })
  
  /**
   * Test CSV escaping for special characters
   * Requirements: 9.2
   */
  it('properly escapes CSV fields with special characters', async () => {
    const sampleClients = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Client, with comma',
        dni: '12345678',
        phone: '1234567890',
        address: 'Address with "quotes"',
        credit_limit: 10000,
        credit_used: 0,
        rating: 'A',
        last_purchase_date: new Date('2024-01-15'),
        active: true,
      },
    ]
    
    mockFilterClients.mockResolvedValue(sampleClients)
    
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
    
    const csv = await exportClients({}, 'admin')
    
    // Verify fields with commas are wrapped in quotes
    expect(csv).toContain('"Client, with comma"')
    
    // Verify fields with quotes have escaped quotes (doubled)
    expect(csv).toContain('"Address with ""quotes"""')
  })
  
  /**
   * Test handling of null/empty values
   * Requirements: 9.2
   */
  it('handles null and empty values correctly', async () => {
    const sampleClients = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Client',
        dni: null,
        phone: null,
        address: '',
        credit_limit: 10000,
        credit_used: 0,
        rating: null,
        last_purchase_date: null,
        active: true,
      },
    ]
    
    mockFilterClients.mockResolvedValue(sampleClients)
    
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
    
    const csv = await exportClients({}, 'admin')
    
    // Verify CSV is generated without errors
    expect(csv).toBeTruthy()
    expect(csv).toContain('Test Client')
    
    // Verify empty fields are handled (should have empty values between commas)
    const lines = csv.split('\n')
    const dataRow = lines[1]
    
    // Should have correct number of commas for all columns
    const commaCount = (dataRow.match(/,/g) || []).length
    expect(commaCount).toBe(10) // 11 columns = 10 commas
  })
  
  /**
   * Test error handling when no clients match filters
   * Requirements: 9.1
   */
  it('throws error when no clients match filters', async () => {
    mockFilterClients.mockResolvedValue([])
    
    await expect(exportClients({}, 'admin')).rejects.toThrow('No hay clientes para exportar')
  })
  
  /**
   * Test filename generation
   * Requirements: 9.6
   */
  it('generates filename with current date and time', () => {
    const filename = generateExportFilename()
    
    // Should match pattern: clientes_YYYY-MM-DD_HH-mm-ss.csv
    expect(filename).toMatch(/^clientes_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/)
    
    // Should start with "clientes_"
    expect(filename).toMatch(/^clientes_/)
    
    // Should end with ".csv"
    expect(filename).toMatch(/\.csv$/)
  })
})
