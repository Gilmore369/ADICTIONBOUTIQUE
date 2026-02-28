/**
 * Formatting utilities
 */

/**
 * Format number with thousands separator (comma)
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with comma separator
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  return value.toLocaleString('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Format number with thousands separator (no currency symbol)
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return value.toLocaleString('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}
