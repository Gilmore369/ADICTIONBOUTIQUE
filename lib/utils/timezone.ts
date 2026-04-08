/**
 * Timezone utilities for Peru (America/Lima, UTC-5)
 *
 * RULE: Always use these helpers instead of raw new Date() when you
 * need a "today" string or date boundaries for Supabase queries.
 */

export const PERU_TZ = 'America/Lima'

/** Returns current date in Peru as "YYYY-MM-DD" */
export function getTodayPeru(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: PERU_TZ })
}

/** Returns current datetime string in Peru as ISO-like "YYYY-MM-DDTHH:mm:ss" */
export function getNowPeru(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: PERU_TZ }).replace(' ', 'T')
}

/**
 * Returns the UTC ISO string that corresponds to Peru midnight (00:00 Lima)
 * for the given YYYY-MM-DD date string.
 * Peru is UTC-5, so Lima midnight = 05:00 UTC.
 */
export function peruMidnightUTC(dateStr: string): string {
  return `${dateStr}T05:00:00.000Z`
}

/**
 * Returns the UTC ISO string that corresponds to Peru end-of-day (23:59:59 Lima)
 * for the given YYYY-MM-DD date string.
 * Peru end-of-day = 04:59:59 UTC next day.
 */
export function peruEndOfDayUTC(dateStr: string): string {
  // 23:59:59 Lima = 04:59:59 UTC next day
  const d = new Date(`${dateStr}T05:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCSeconds(d.getUTCSeconds() - 1)
  return d.toISOString()
}

/**
 * Format a date value for display in Peru locale.
 * Handles both date-only strings (YYYY-MM-DD) and full ISO timestamps.
 */
export function formatDatePeru(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }
): string {
  if (!date) return '-'
  try {
    const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(date + 'T12:00:00')   // local noon avoids UTC day-shift
      : new Date(date)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('es-PE', { timeZone: PERU_TZ, ...options })
  } catch {
    return '-'
  }
}

/** Same as formatDatePeru but includes time */
export function formatDateTimePeru(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }
): string {
  if (!date) return '-'
  try {
    const d = new Date(date as string)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleString('es-PE', { timeZone: PERU_TZ, ...options })
  } catch {
    return '-'
  }
}
