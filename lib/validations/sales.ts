import { z } from 'zod'

/**
 * Sale item validation schema
 * Validates individual items in a sale
 */
export const saleItemSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be positive'),
  unit_price: z.number().positive('Unit price must be positive')
})

/**
 * Sale validation schema
 * Validates sale creation with type-specific requirements
 * Includes date validation to prevent undefined/Invalid Date errors
 */
export const saleSchema = z.object({
  store_id: z.string().min(1, 'Store ID is required'),
  client_id: z.string().uuid('Invalid client ID').optional(),
  sale_type: z.enum(['CONTADO', 'CREDITO'], {
    errorMap: () => ({ message: 'Sale type must be CONTADO or CREDITO' })
  }),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
  discount: z.number().nonnegative('Discount cannot be negative').default(0),
  installments: z.number().int('Installments must be an integer').min(1).max(6).optional(),
  sale_date: z.string().datetime('Invalid sale date format').optional().default(() => new Date().toISOString())
}).refine(
  (data) => {
    // Credit sales require client_id and installments
    if (data.sale_type === 'CREDITO') {
      return data.client_id && data.installments
    }
    return true
  },
  {
    message: 'Credit sales require client_id and installments',
    path: ['sale_type']
  }
).refine(
  (data) => {
    // Validate sale_date is a valid ISO date string
    if (data.sale_date) {
      const date = new Date(data.sale_date)
      return !isNaN(date.getTime())
    }
    return true
  },
  {
    message: 'Sale date must be a valid ISO date string',
    path: ['sale_date']
  }
)

/**
 * Installment date validation helper
 * Ensures installment dates are valid ISO format and not undefined
 */
export function validateInstallmentDates(installments: Array<{ due_date: string }>): boolean {
  return installments.every(inst => {
    if (!inst.due_date) return false
    const date = new Date(inst.due_date)
    return !isNaN(date.getTime())
  })
}

/**
 * Generate installment dates for credit sales
 * Creates dates +30 days apart, ensuring valid ISO format
 */
export function generateInstallmentDates(saleDate: string, count: number): string[] {
  const dates: string[] = []
  const baseDate = new Date(saleDate)
  
  // Validate base date
  if (isNaN(baseDate.getTime())) {
    throw new Error('Invalid sale date')
  }
  
  for (let i = 1; i <= count; i++) {
    const dueDate = new Date(baseDate)
    dueDate.setDate(dueDate.getDate() + (30 * i))
    
    // Ensure valid date
    if (isNaN(dueDate.getTime())) {
      throw new Error(`Invalid installment date generated for installment ${i}`)
    }
    
    dates.push(dueDate.toISOString())
  }
  
  return dates
}

export type SaleItem = z.infer<typeof saleItemSchema>
export type Sale = z.infer<typeof saleSchema>
