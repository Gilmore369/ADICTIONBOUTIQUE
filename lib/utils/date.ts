/**
 * Date Utilities
 * 
 * Safe date formatting functions that handle null/undefined/invalid dates
 */

import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Safely format a date string, returning fallback if invalid
 */
export function formatSafeDate(
  date: string | null | undefined,
  formatStr: string = 'dd/MM/yyyy',
  fallback: string = '-'
): string {
  if (!date) return fallback
  
  try {
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) return fallback
    return format(parsed, formatStr, { locale: es })
  } catch {
    return fallback
  }
}

/**
 * Safely get timestamp from date string
 */
export function getSafeTimestamp(date: string | null | undefined): number {
  if (!date) return 0
  
  try {
    const parsed = new Date(date)
    return isNaN(parsed.getTime()) ? 0 : parsed.getTime()
  } catch {
    return 0
  }
}

/**
 * Check if date string is valid
 */
export function isValidDate(date: string | null | undefined): boolean {
  if (!date) return false
  
  try {
    const parsed = new Date(date)
    return !isNaN(parsed.getTime())
  } catch {
    return false
  }
}
