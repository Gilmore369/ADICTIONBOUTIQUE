/**
 * Validation schemas for catalog entities
 * 
 * Provides Zod schemas for validating catalog data (lines, categories, brands, sizes, suppliers)
 */

import { z } from 'zod'

/**
 * Line validation schema
 */
export const lineSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().optional()
})

/**
 * Category validation schema
 */
export const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  line_id: z.string().uuid('Invalid line ID'),
  description: z.string().optional()
})

/**
 * Brand validation schema
 */
export const brandSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().optional()
})

/**
 * Size validation schema
 */
export const sizeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be less than 50 characters'),
  category_id: z.string().uuid('Invalid category ID'),
})

/**
 * Supplier validation schema
 */
export const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional()
})

/**
 * Product validation schema
 * 
 * Validates product data including:
 * - Barcode uniqueness (must be checked at application level)
 * - Required fields: name, price, line_id, category_id
 * - Price must be positive
 * - Optional fields: description, brand_id, supplier_id, size, color, etc.
 * 
 * Requirements: 4.2, 4.7, 10.1
 */
export const productSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required').max(100, 'Barcode must be less than 100 characters'),
  name: z.string().min(1, 'Name is required').max(200, 'Name must be less than 200 characters'),
  description: z.string().optional(),
  line_id: z.string().uuid('Invalid line ID'),
  category_id: z.string().uuid('Invalid category ID'),
  brand_id: z.string().uuid('Invalid brand ID').optional().or(z.literal('')),
  supplier_id: z.string().uuid('Invalid supplier ID').optional().or(z.literal('')),
  size: z.string().max(50, 'Size must be less than 50 characters').optional(),
  color: z.string().max(50, 'Color must be less than 50 characters').optional(),
  presentation: z.string().max(100, 'Presentation must be less than 100 characters').optional(),
  purchase_price: z.number().nonnegative('Purchase price must be non-negative').optional(),
  price: z.number().positive('Price must be positive'),
  min_stock: z.number().int('Min stock must be an integer').nonnegative('Min stock must be non-negative').default(0),
  entry_date: z.string().optional(), // ISO date string
  image_url: z.string().url('Invalid image URL').optional().or(z.literal('')),
  active: z.boolean().default(true)
})

/**
 * Client validation schema
 * 
 * Validates client data including:
 * - DNI uniqueness (must be checked at application level)
 * - Required fields: name
 * - credit_limit and credit_used must be non-negative
 * - lat/lng coordinates must be valid (optional)
 * - Email format validation
 * 
 * Requirements: 10.6
 */
export const clientSchema = z.object({
  dni: z.string().min(1, 'DNI is required').max(20, 'DNI must be less than 20 characters'),
  name: z.string().min(1, 'Name is required').max(200, 'Name must be less than 200 characters'),
  phone: z.string().max(20, 'Phone must be less than 20 characters').optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  address: z.string().max(500, 'Address must be less than 500 characters').optional(),
  lat: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional(),
  lng: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional(),
  credit_limit: z.number()
    .nonnegative('Credit limit must be non-negative')
    .default(0),
  credit_used: z.number()
    .nonnegative('Credit used must be non-negative')
    .default(0),
  dni_photo_url: z.string().url('Invalid DNI photo URL').optional().or(z.literal('')),
  client_photo_url: z.string().url('Invalid client photo URL').optional().or(z.literal('')),
  birthday: z.string().optional(), // ISO date string
  active: z.boolean().default(true)
}).refine(data => {
  // If lat is provided, lng must also be provided (and vice versa)
  if ((data.lat !== undefined && data.lng === undefined) || 
      (data.lng !== undefined && data.lat === undefined)) {
    return false
  }
  return true
}, {
  message: 'Both latitude and longitude must be provided together',
  path: ['lat']
})
