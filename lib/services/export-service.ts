/**
 * Export Service
 * 
 * Provides functions for exporting client data to CSV format.
 * Handles data formatting, masking sensitive information, and file generation.
 */

import { createServerClient } from '@/lib/supabase/server'
import { ClientFilters } from '@/lib/types/crm'
import { filterClients } from './client-service'
import { format } from 'date-fns'

/**
 * Export clients to CSV format
 * 
 * Generates a CSV file with filtered client data including:
 * - name, DNI, phone, address
 * - credit_limit, credit_used, total_debt, overdue_debt
 * - rating, last_purchase, status
 * 
 * Dates are formatted as ISO 8601 (YYYY-MM-DD)
 * Amounts are formatted with two decimals
 * Sensitive data (DNI, phone) is masked for non-admin users
 * 
 * @param filters - Client filter criteria
 * @param userRole - Role of the user requesting the export ('admin' or other)
 * @returns CSV string with client data
 * 
 * @example
 * ```typescript
 * const csv = await exportClients({ debtStatus: 'MOROSO' }, 'admin')
 * // Returns CSV with all clients matching filters
 * ```
 */
export async function exportClients(
  filters: ClientFilters,
  userRole: string
): Promise<string> {
  const supabase = await createServerClient()
  
  // Get filtered clients
  const clients = await filterClients(filters)
  
  if (clients.length === 0) {
    throw new Error('No hay clientes para exportar')
  }
  
  // Get client IDs for fetching debt information
  const clientIds = clients.map((c) => c.id)
  
  // Fetch installments to calculate total debt and overdue debt
  const { data: installments, error: instError } = await supabase
    .from('installments')
    .select(`
      id,
      amount,
      paid_amount,
      due_date,
      status,
      credit_plans!inner(client_id)
    `)
    .in('credit_plans.client_id', clientIds)
  
  if (instError) {
    throw new Error(`Failed to fetch installments: ${instError.message}`)
  }
  
  // Calculate debt by client
  const debtByClient = new Map<string, { totalDebt: number; overdueDebt: number }>()
  const today = new Date()
  
  installments?.forEach((inst) => {
    const clientId = inst.credit_plans.client_id
    const remainingAmount = inst.amount - inst.paid_amount
    
    if (!debtByClient.has(clientId)) {
      debtByClient.set(clientId, { totalDebt: 0, overdueDebt: 0 })
    }
    
    const debt = debtByClient.get(clientId)!
    
    // Add to total debt if not fully paid
    if (inst.status !== 'PAID') {
      debt.totalDebt += remainingAmount
    }
    
    // Add to overdue debt if past due date
    const dueDate = new Date(inst.due_date)
    if (
      dueDate < today &&
      (inst.status === 'PENDING' || inst.status === 'PARTIAL' || inst.status === 'OVERDUE')
    ) {
      debt.overdueDebt += remainingAmount
    }
  })
  
  // Define CSV headers
  const headers = [
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
  
  // Build CSV rows
  const rows = clients.map((client) => {
    const debt = debtByClient.get(client.id) || { totalDebt: 0, overdueDebt: 0 }
    const isAdmin = userRole === 'admin'
    
    // Mask sensitive data for non-admin users
    const dni = isAdmin ? client.dni : maskDNI(client.dni)
    const phone = isAdmin ? client.phone : maskPhone(client.phone)
    
    // Format dates as ISO 8601 (YYYY-MM-DD)
    const lastPurchase = client.last_purchase_date
      ? format(new Date(client.last_purchase_date), 'yyyy-MM-dd')
      : ''
    
    // Format amounts with two decimals
    const creditLimit = formatAmount(client.credit_limit || 0)
    const creditUsed = formatAmount(client.credit_used || 0)
    const totalDebt = formatAmount(debt.totalDebt)
    const overdueDebt = formatAmount(debt.overdueDebt)
    
    // Determine status
    const status = client.active ? 'Activo' : 'Inactivo'
    
    // Get rating
    const rating = client.rating || ''
    
    return [
      escapeCSV(client.name || ''),
      escapeCSV(dni || ''),
      escapeCSV(phone || ''),
      escapeCSV(client.address || ''),
      creditLimit,
      creditUsed,
      totalDebt,
      overdueDebt,
      rating,
      lastPurchase,
      status,
    ]
  })
  
  // Build CSV string
  const csvLines = [headers.join(',')]
  rows.forEach((row) => {
    csvLines.push(row.join(','))
  })
  
  return csvLines.join('\n')
}

/**
 * Generate filename for export with current date and time
 * 
 * @returns Filename in format: clientes_YYYY-MM-DD_HH-mm-ss.csv
 * 
 * @example
 * ```typescript
 * const filename = generateExportFilename()
 * // Returns: "clientes_2024-01-15_14-30-45.csv"
 * ```
 */
export function generateExportFilename(): string {
  const now = new Date()
  const dateStr = format(now, 'yyyy-MM-dd_HH-mm-ss')
  return `clientes_${dateStr}.csv`
}

/**
 * Mask DNI for non-admin users
 * Shows only last 4 digits
 * 
 * @param dni - Full DNI
 * @returns Masked DNI (e.g., "****5678")
 */
function maskDNI(dni: string | null): string {
  if (!dni) return ''
  if (dni.length <= 4) return '****'
  return '****' + dni.slice(-4)
}

/**
 * Mask phone number for non-admin users
 * Shows only last 4 digits
 * 
 * @param phone - Full phone number
 * @returns Masked phone (e.g., "****5678")
 */
function maskPhone(phone: string | null): string {
  if (!phone) return ''
  if (phone.length <= 4) return '****'
  return '****' + phone.slice(-4)
}

/**
 * Format amount with two decimals
 * 
 * @param amount - Numeric amount
 * @returns Formatted string with 2 decimals
 */
function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

/**
 * Escape CSV field value
 * Wraps in quotes if contains comma, newline, or quote
 * Escapes internal quotes by doubling them
 * 
 * @param value - Field value
 * @returns Escaped CSV field
 */
function escapeCSV(value: string): string {
  if (!value) return ''
  
  // Check if value needs escaping
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    // Escape quotes by doubling them
    const escaped = value.replace(/"/g, '""')
    return `"${escaped}"`
  }
  
  return value
}
