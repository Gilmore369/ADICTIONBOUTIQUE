/**
 * Utilidades para formateo de moneda
 * Moneda: Sol Peruano (PEN)
 */

/**
 * Formatea un número como moneda peruana (S/)
 * @param amount - Monto a formatear
 * @param showDecimals - Si debe mostrar decimales (default: true)
 * @returns String formateado como S/ 1,234.56
 */
export function formatCurrency(amount: number, showDecimals: boolean = true): string {
  // Asegurar que el monto no sea negativo para crédito disponible
  const absoluteAmount = Math.abs(amount)
  
  const formatted = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(absoluteAmount)
  
  // Reemplazar el símbolo PEN por S/
  return formatted.replace('PEN', 'S/').trim()
}

/**
 * Formatea un número con separadores de miles
 * @param amount - Monto a formatear
 * @param decimals - Número de decimales (default: 2)
 * @returns String formateado como 1,234.56
 */
export function formatNumber(amount: number, decimals: number = 2): string {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

/**
 * Calcula el crédito disponible (nunca negativo)
 * @param creditLimit - Límite de crédito
 * @param creditUsed - Crédito usado
 * @returns Crédito disponible (mínimo 0)
 */
export function calculateAvailableCredit(creditLimit: number, creditUsed: number): number {
  const available = creditLimit - creditUsed
  return Math.max(0, available) // Nunca retornar negativo
}

/**
 * Calcula el porcentaje de utilización de crédito
 * @param creditLimit - Límite de crédito
 * @param creditUsed - Crédito usado
 * @returns Porcentaje de utilización (0-100+)
 */
export function calculateCreditUtilization(creditLimit: number, creditUsed: number): number {
  if (creditLimit === 0) return 0
  return (creditUsed / creditLimit) * 100
}

/**
 * Calcula el crédito disponible y retorna objeto con valores formateados
 * @param creditLimit - Límite de crédito
 * @param creditUsed - Crédito usado
 * @returns Objeto con crédito disponible
 */
export function getAvailableCredit(creditLimit: number, creditUsed: number) {
  return {
    available: calculateAvailableCredit(creditLimit, creditUsed),
    utilization: calculateCreditUtilization(creditLimit, creditUsed)
  }
}

/**
 * Obtiene el color según el nivel de utilización de crédito
 * @param creditLimit - Límite de crédito
 * @param creditUsed - Crédito usado
 * @returns Color CSS para el indicador
 */
export function getCreditColor(creditLimit: number, creditUsed: number): string {
  const utilization = calculateCreditUtilization(creditLimit, creditUsed)
  
  if (utilization >= 90) return 'text-red-600'
  if (utilization >= 75) return 'text-orange-600'
  if (utilization >= 50) return 'text-yellow-600'
  return 'text-green-600'
}
