/**
 * Date Utilities
 *
 * Safe date formatting functions that handle null/undefined/invalid dates
 */

import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Safely format a date string, returning fallback if invalid.
 *
 * TIMEZONE FIX: date-only strings ("YYYY-MM-DD") are parsed as local noon
 * (T12:00:00) to avoid UTC midnight → day-before shift in UTC-5 zones.
 */
export function formatSafeDate(
  date: string | null | undefined,
  formatStr: string = 'dd/MM/yyyy',
  fallback: string = '-'
): string {
  if (!date) return fallback
  try {
    // date-only strings (YYYY-MM-DD) must be parsed as local noon
    // to avoid UTC midnight → day-before shift in UTC-5 zones
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(date)
    const parsed = isDateOnly ? new Date(date + 'T12:00:00') : new Date(date)
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
