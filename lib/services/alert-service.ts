/**
 * Alert Service
 * 
 * Generates automated alerts for client events including:
 * - Birthday alerts (7 days before birthday)
 * - Inactivity alerts (no purchases > threshold days)
 * - Installment due alerts (7 days before due date)
 * - Overdue alerts (past due date)
 * 
 * Ensures idempotence and unique alert IDs.
 */

import { createServerClient } from '@/lib/supabase/server'
import { Alert, AlertType, AlertPriority } from '@/lib/types/crm'
import { differenceInDays, addDays } from 'date-fns'

/**
 * Generate all alerts for the current date
 * 
 * Generates alerts for birthdays, inactivity, upcoming installments, and overdue installments.
 * Alert generation is idempotent - calling multiple times on the same date produces the same alerts.
 * 
 * @returns Array of all active alerts sorted by priority (HIGH, MEDIUM, LOW)
 * 
 * @example
 * ```typescript
 * const alerts = await generateAlerts()
 * const highPriority = alerts.filter(a => a.priority === 'HIGH')
 * console.log(`${highPriority.length} high priority alerts`)
 * ```
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 */
export async function generateAlerts(): Promise<Alert[]> {
  const supabase = await createServerClient()
  const alerts: Alert[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Normalize to start of day for consistent comparisons
  
  // Fetch system configuration
  const configResult = await supabase
    .from('system_config')
    .select('key, value')
    .eq('key', 'inactivity_threshold_days')
    .maybeSingle()
  
  const inactivityThreshold = parseInt(configResult?.data?.value || '90')
  
  // Step 1: Birthday alerts (7 days before)
  // Requirement 3.2: Generate BIRTHDAY alert 0-7 days before birthday with MEDIUM priority
  const birthdayClientsResult = await supabase
    .from('clients')
    .select('id, name, birthday')
    .eq('active', true)
    .not('birthday', 'is', null)
  
  if (birthdayClientsResult.data) {
    for (const client of birthdayClientsResult.data) {
      // Parse birthday as date-only string (YYYY-MM-DD)
      const birthdayStr = client.birthday.split('T')[0] // Handle both date and datetime formats
      const [year, month, day] = birthdayStr.split('-').map(Number)
      
      // Calculate next birthday occurrence
      const nextBirthday = new Date(today.getFullYear(), month - 1, day)
      nextBirthday.setHours(0, 0, 0, 0)
      
      // If birthday already passed this year, use next year
      if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1)
      }
      
      const daysUntil = differenceInDays(nextBirthday, today)
      
      // Generate alert if birthday is within 0-7 days
      if (daysUntil >= 0 && daysUntil <= 7) {
        alerts.push({
          id: `birthday-${client.id}`,
          type: AlertType.BIRTHDAY,
          clientId: client.id,
          clientName: client.name,
          message: `Cumpleaños en ${daysUntil} día${daysUntil !== 1 ? 's' : ''}`,
          priority: AlertPriority.MEDIUM,
          dueDate: nextBirthday,
          amount: null,
          createdAt: today,
        })
      }
    }
  }
  
  // Step 2: Inactivity alerts
  // Requirement 3.3: Generate INACTIVITY alert for clients with no purchases > threshold days with LOW priority
  const inactiveClientsResult = await supabase
    .from('clients')
    .select('id, name, last_purchase_date')
    .eq('active', true)
    .not('last_purchase_date', 'is', null)
  
  if (inactiveClientsResult.data) {
    for (const client of inactiveClientsResult.data) {
      const lastPurchaseDate = new Date(client.last_purchase_date)
      const daysSince = differenceInDays(today, lastPurchaseDate)
      
      // Generate alert if inactive for more than threshold days
      if (daysSince > inactivityThreshold) {
        alerts.push({
          id: `inactivity-${client.id}`,
          type: AlertType.INACTIVITY,
          clientId: client.id,
          clientName: client.name,
          message: `Sin compras hace ${daysSince} día${daysSince !== 1 ? 's' : ''}`,
          priority: AlertPriority.LOW,
          dueDate: null,
          amount: null,
          createdAt: today,
        })
      }
    }
  }
  
  // Step 3: Installment due alerts (7 days before)
  // Requirement 3.4: Generate INSTALLMENT alert 0-7 days before due date with MEDIUM priority
  const upcomingInstallmentsResult = await supabase
    .from('installments')
    .select(`
      id,
      amount,
      paid_amount,
      due_date,
      credit_plans!inner(
        client_id,
        clients!inner(
          id,
          name
        )
      )
    `)
    .in('status', ['PENDING', 'PARTIAL'])
    .gte('due_date', today.toISOString())
    .lte('due_date', addDays(today, 7).toISOString())
  
  if (upcomingInstallmentsResult.data) {
    for (const inst of upcomingInstallmentsResult.data) {
      const dueDate = new Date(inst.due_date)
      dueDate.setHours(0, 0, 0, 0)
      const daysUntil = differenceInDays(dueDate, today)
      const pendingAmount = inst.amount - (inst.paid_amount || 0)
      
      alerts.push({
        id: `installment-${inst.id}`,
        type: AlertType.INSTALLMENT,
        clientId: inst.credit_plans.clients.id,
        clientName: inst.credit_plans.clients.name,
        message: `Cuota vence en ${daysUntil} día${daysUntil !== 1 ? 's' : ''}`,
        priority: AlertPriority.MEDIUM,
        dueDate: dueDate,
        amount: pendingAmount,
        createdAt: today,
      })
    }
  }
  
  // Step 4: Overdue alerts
  // Requirement 3.5: Generate OVERDUE alert for installments past due date with HIGH priority
  const overdueInstallmentsResult = await supabase
    .from('installments')
    .select(`
      id,
      amount,
      paid_amount,
      due_date,
      credit_plans!inner(
        client_id,
        clients!inner(
          id,
          name
        )
      )
    `)
    .in('status', ['PENDING', 'PARTIAL', 'OVERDUE'])
    .lt('due_date', today.toISOString())
  
  if (overdueInstallmentsResult.data) {
    for (const inst of overdueInstallmentsResult.data) {
      const dueDate = new Date(inst.due_date)
      dueDate.setHours(0, 0, 0, 0)
      const daysOverdue = differenceInDays(today, dueDate)
      const pendingAmount = inst.amount - (inst.paid_amount || 0)
      
      alerts.push({
        id: `overdue-${inst.id}`,
        type: AlertType.OVERDUE,
        clientId: inst.credit_plans.clients.id,
        clientName: inst.credit_plans.clients.name,
        message: `Cuota vencida hace ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''}`,
        priority: AlertPriority.HIGH,
        dueDate: dueDate,
        amount: pendingAmount,
        createdAt: today,
      })
    }
  }
  
  // Sort alerts by priority (HIGH > MEDIUM > LOW)
  const priorityOrder = {
    [AlertPriority.HIGH]: 0,
    [AlertPriority.MEDIUM]: 1,
    [AlertPriority.LOW]: 2,
  }
  
  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
  
  return alerts
}
