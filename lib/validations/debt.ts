/**
 * Validation schemas for debt management entities
 * 
 * Provides Zod schemas for validating credit plans, installments, and payments
 */

import { z } from 'zod'

/**
 * Credit plan validation schema
 * 
 * Validates credit plan data including:
 * - installments_count must be between 1 and 6
 * - total_amount must be positive
 * - installment_amount must be positive
 * - sale_id and client_id must be valid UUIDs
 * 
 * Requirements: 6.1
 */
export const creditPlanSchema = z.object({
  sale_id: z.string().uuid('Invalid sale ID'),
  client_id: z.string().uuid('Invalid client ID'),
  total_amount: z.number().positive('Total amount must be positive'),
  installments_count: z.number()
    .int('Installments count must be an integer')
    .min(1, 'Installments count must be at least 1')
    .max(6, 'Installments count must be at most 6'),
  installment_amount: z.number().positive('Installment amount must be positive'),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED'], {
    errorMap: () => ({ message: 'Status must be ACTIVE, COMPLETED, or CANCELLED' })
  }).default('ACTIVE')
})

/**
 * Installment validation schema
 * 
 * Validates installment data including:
 * - due_date must be valid ISO format
 * - amount must be positive
 * - paid_amount must be non-negative
 * - installment_number must be positive integer
 * 
 * Requirements: 6.2, 6.3, 10.4
 */
export const installmentSchema = z.object({
  plan_id: z.string().uuid('Invalid plan ID'),
  installment_number: z.number()
    .int('Installment number must be an integer')
    .positive('Installment number must be positive'),
  amount: z.number().positive('Amount must be positive'),
  due_date: z.string().datetime('Invalid due date format'),
  paid_amount: z.number()
    .nonnegative('Paid amount must be non-negative')
    .default(0),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'], {
    errorMap: () => ({ message: 'Status must be PENDING, PARTIAL, PAID, or OVERDUE' })
  }).default('PENDING'),
  paid_at: z.string().datetime('Invalid paid at format').optional()
}).refine(
  (data) => {
    // Validate due_date is a valid ISO date string
    const date = new Date(data.due_date)
    return !isNaN(date.getTime())
  },
  {
    message: 'Due date must be a valid ISO date string',
    path: ['due_date']
  }
).refine(
  (data) => {
    // paid_amount cannot exceed amount
    return data.paid_amount <= data.amount
  },
  {
    message: 'Paid amount cannot exceed installment amount',
    path: ['paid_amount']
  }
)

/**
 * Payment validation schema
 * 
 * Validates payment data including:
 * - amount must be positive
 * - payment_date must be valid ISO format
 * - client_id must be valid UUID
 * 
 * Requirements: 10.4, 10.5
 */
export const paymentSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  amount: z.number().positive('Amount must be positive'),
  payment_date: z.string().datetime('Invalid payment date format'),
  user_id: z.string().uuid('Invalid user ID'),
  receipt_url: z.string().url('Invalid receipt URL').optional().or(z.literal('')),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional()
}).refine(
  (data) => {
    // Validate payment_date is a valid ISO date string
    const date = new Date(data.payment_date)
    return !isNaN(date.getTime())
  },
  {
    message: 'Payment date must be a valid ISO date string',
    path: ['payment_date']
  }
)

/**
 * Collection action validation schema
 * 
 * Validates collection action data including:
 * - action_type must be valid enum
 * - result must be valid enum
 * - payment_promise_date must be valid ISO format (if provided)
 * 
 * Requirements: 10.6
 */
export const collectionActionSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  client_name: z.string().min(1, 'Client name is required'),
  action_type: z.enum([
    'LLAMADA', 
    'VISITA', 
    'WHATSAPP', 
    'EMAIL', 
    'SMS', 
    'CARTA', 
    'MOTORIZADO', 
    'VIDEOLLAMADA', 
    'OTRO'
  ], {
    errorMap: () => ({ message: 'Invalid action type' })
  }),
  result: z.enum([
    'COMPROMISO_PAGO',
    'PAGO_REALIZADO',
    'PAGO_PARCIAL',
    'SE_NIEGA_PAGAR',
    'NO_CONTESTA',
    'NUMERO_EQUIVOCADO',
    'SOLICITA_REFINANCIACION',
    'SOLICITA_DESCUENTO',
    'SOLICITA_PLAZO',
    'PROBLEMAS_ECONOMICOS',
    'RECLAMO_PRODUCTO',
    'CLIENTE_FALLECIDO',
    'CLIENTE_VIAJO',
    'REPROGRAMADO',
    'DERIVADO_LEGAL',
    'OTRO'
  ], {
    errorMap: () => ({ message: 'Invalid result' })
  }),
  payment_promise_date: z.string().datetime('Invalid payment promise date format').optional(),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
  user_id: z.string().uuid('Invalid user ID')
}).refine(
  (data) => {
    // If payment_promise_date is provided, validate it's a valid ISO date string
    if (data.payment_promise_date) {
      const date = new Date(data.payment_promise_date)
      return !isNaN(date.getTime())
    }
    return true
  },
  {
    message: 'Payment promise date must be a valid ISO date string',
    path: ['payment_promise_date']
  }
)

// Export TypeScript types
export type CreditPlan = z.infer<typeof creditPlanSchema>
export type Installment = z.infer<typeof installmentSchema>
export type Payment = z.infer<typeof paymentSchema>
export type CollectionAction = z.infer<typeof collectionActionSchema>
