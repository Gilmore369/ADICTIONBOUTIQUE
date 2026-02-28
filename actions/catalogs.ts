/**
 * Server Actions for Catalog CRUD Operations
 * 
 * Provides server-side actions for managing catalog entities:
 * - Lines
 * - Categories
 * - Brands
 * - Sizes
 * - Suppliers
 * 
 * All actions include:
 * - Permission checks using RBAC
 * - Input validation with Zod
 * - Cache revalidation after mutations
 * - Structured error responses
 */

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkPermission } from '@/lib/auth/check-permission'
import { Permission } from '@/lib/auth/permissions'
import {
  lineSchema,
  categorySchema,
  brandSchema,
  sizeSchema,
  supplierSchema,
  productSchema,
  clientSchema
} from '@/lib/validations/catalogs'

/**
 * Standard response type for server actions
 */
type ActionResponse<T = any> = {
  success: boolean
  data?: T
  error?: string | Record<string, string[]>
}

// ============================================================================
// LINE ACTIONS
// ============================================================================

/**
 * Creates a new product line
 * 
 * @param data - Line data object or FormData
 * @returns ActionResponse with created line or error
 */
export async function createLine(data: FormData | { name: string; description?: string }): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Extract data from FormData or object
  const inputData = data instanceof FormData 
    ? {
        name: data.get('name'),
        description: data.get('description') || undefined
      }
    : data

  // Validate input
  const validated = lineSchema.safeParse(inputData)

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // Insert line
  const supabase = await createServerClient()
  const { data: result, error } = await supabase
    .from('lines')
    .insert(validated.data as any)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/lines')

  return { success: true, data: result }
}

/**
 * Updates an existing product line
 * 
 * @param id - Line ID
 * @param formData - Form data with updated line information
 * @returns ActionResponse with updated line or error
 */
export async function updateLine(id: string, formData: FormData): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Validate input
  const validated = lineSchema.partial().safeParse({
    name: formData.get('name') || undefined,
    description: formData.get('description') || undefined
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // Update line
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('lines')
    .update(validated.data as any)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/lines')
  revalidatePath(`/catalogs/lines/${id}`)

  return { success: true, data }
}

/**
 * Deletes a product line (soft delete by setting active = false)
 * 
 * @param id - Line ID
 * @returns ActionResponse with success status or error
 */
export async function deleteLine(id: string): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Soft delete by setting active = false
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('lines')
    .update({ active: false })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/lines')

  return { success: true }
}

// ============================================================================
// CATEGORY ACTIONS
// ============================================================================

/**
 * Creates a new product category
 * 
 * @param data - Category data object or FormData
 * @returns ActionResponse with created category or error
 */
export async function createCategory(data: FormData | { name: string; line_id: string; description?: string }): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Extract data from FormData or object
  const inputData = data instanceof FormData
    ? {
        name: data.get('name'),
        line_id: data.get('line_id'),
        description: data.get('description') || undefined
      }
    : data

  // Validate input
  const validated = categorySchema.safeParse(inputData)

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // Insert category
  const supabase = await createServerClient()
  const { data: result, error } = await supabase
    .from('categories')
    .insert(validated.data as any)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/categories')

  return { success: true, data: result }
}

/**
 * Updates an existing product category
 * 
 * @param id - Category ID
 * @param formData - Form data with updated category information
 * @returns ActionResponse with updated category or error
 */
export async function updateCategory(id: string, formData: FormData): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Validate input
  const validated = categorySchema.partial().safeParse({
    name: formData.get('name') || undefined,
    line_id: formData.get('line_id') || undefined,
    description: formData.get('description') || undefined
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // Update category
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('categories')
    .update(validated.data as any)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/categories')
  revalidatePath(`/catalogs/categories/${id}`)

  return { success: true, data }
}

/**
 * Deletes a product category (soft delete by setting active = false)
 * 
 * @param id - Category ID
 * @returns ActionResponse with success status or error
 */
export async function deleteCategory(id: string): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Soft delete by setting active = false
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('categories')
    .update({ active: false })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/categories')

  return { success: true }
}

// ============================================================================
// BRAND ACTIONS
// ============================================================================

/**
 * Creates a new brand with supplier relationships
 * 
 * @param data - Brand data object or FormData
 * @returns ActionResponse with created brand or error
 */
export async function createBrand(data: FormData | { name: string; description?: string; supplier_ids?: string[] }): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Extract data from FormData or object
  let inputData: { name: any; description?: any }
  let supplierIds: string[] = []
  
  if (data instanceof FormData) {
    inputData = {
      name: data.get('name'),
      description: data.get('description') || undefined
    }
    // Get all supplier_ids[] values
    supplierIds = data.getAll('supplier_ids[]').filter(Boolean) as string[]
  } else {
    inputData = {
      name: data.name,
      description: data.description
    }
    supplierIds = data.supplier_ids || []
  }

  // Validate at least one supplier is selected
  if (supplierIds.length === 0) {
    return { success: false, error: 'Debes seleccionar al menos un proveedor' }
  }

  // Validate input
  const validated = brandSchema.safeParse(inputData)

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  const supabase = await createServerClient()

  // Insert brand
  const { data: result, error } = await supabase
    .from('brands')
    .insert(validated.data as any)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Insert supplier-brand relationships
  const supplierBrandRecords = supplierIds.map(supplierId => ({
    brand_id: result.id,
    supplier_id: supplierId
  }))

  const { error: relationError } = await supabase
    .from('supplier_brands')
    .insert(supplierBrandRecords)

  if (relationError) {
    // Rollback: delete the brand if supplier relationships fail
    await supabase.from('brands').delete().eq('id', result.id)
    return { success: false, error: relationError.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/brands')

  return { success: true, data: result }
}

/**
 * Updates an existing brand and its supplier relationships
 * 
 * @param id - Brand ID
 * @param formData - Form data with updated brand information
 * @returns ActionResponse with updated brand or error
 */
export async function updateBrand(id: string, formData: FormData): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Extract supplier IDs
  const supplierIds = formData.getAll('supplier_ids[]').filter(Boolean) as string[]

  // Validate at least one supplier is selected
  if (supplierIds.length === 0) {
    return { success: false, error: 'Debes seleccionar al menos un proveedor' }
  }

  // Validate input
  const validated = brandSchema.partial().safeParse({
    name: formData.get('name') || undefined,
    description: formData.get('description') || undefined
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  const supabase = await createServerClient()

  // Update brand
  const { data, error } = await supabase
    .from('brands')
    .update(validated.data as any)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Update supplier relationships: delete old ones and insert new ones
  await supabase
    .from('supplier_brands')
    .delete()
    .eq('brand_id', id)

  const supplierBrandRecords = supplierIds.map(supplierId => ({
    brand_id: id,
    supplier_id: supplierId
  }))

  const { error: relationError } = await supabase
    .from('supplier_brands')
    .insert(supplierBrandRecords)

  if (relationError) {
    return { success: false, error: relationError.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/brands')
  revalidatePath(`/catalogs/brands/${id}`)

  return { success: true, data }
}

/**
 * Deletes a brand (soft delete by setting active = false)
 * 
 * @param id - Brand ID
 * @returns ActionResponse with success status or error
 */
export async function deleteBrand(id: string): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Soft delete by setting active = false
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('brands')
    .update({ active: false })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/brands')

  return { success: true }
}

// ============================================================================
// SIZE ACTIONS
// ============================================================================

/**
 * Creates a new size
 * 
 * @param data - Size data object or FormData
 * @returns ActionResponse with created size or error
 */
export async function createSize(data: FormData | { name: string; category_id: string }): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Extract data from FormData or object (NO description field - not in DB schema)
  const inputData = data instanceof FormData
    ? {
        name: data.get('name'),
        category_id: data.get('category_id')
      }
    : data

  // Validate input
  const validated = sizeSchema.safeParse(inputData)

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // Insert size (only name and category_id)
  const supabase = await createServerClient()
  const { data: result, error } = await supabase
    .from('sizes')
    .insert(validated.data as any)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/sizes')

  return { success: true, data: result }
}

/**
 * Updates an existing size
 * 
 * @param id - Size ID
 * @param formData - Form data with updated size information
 * @returns ActionResponse with updated size or error
 */
export async function updateSize(id: string, formData: FormData): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Validate input
  const validated = sizeSchema.partial().safeParse({
    name: formData.get('name') || undefined,
    category_id: formData.get('category_id') || undefined,
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // Update size
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('sizes')
    .update(validated.data as any)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/sizes')
  revalidatePath(`/catalogs/sizes/${id}`)

  return { success: true, data }
}

/**
 * Deletes a size (soft delete by setting active = false)
 * 
 * @param id - Size ID
 * @returns ActionResponse with success status or error
 */
export async function deleteSize(id: string): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Soft delete by setting active = false
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('sizes')
    .update({ active: false })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/sizes')

  return { success: true }
}

// ============================================================================
// SUPPLIER ACTIONS
// ============================================================================

/**
 * Creates a new supplier
 * 
 * @param formData - Form data containing supplier information
 * @returns ActionResponse with created supplier or error
 */
export async function createSupplier(formData: FormData): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Validate input
  const validated = supplierSchema.safeParse({
    name: formData.get('name'),
    contact_name: formData.get('contact_name') || undefined,
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    address: formData.get('address') || undefined,
    notes: formData.get('notes') || undefined
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // Insert supplier
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('suppliers')
    .insert(validated.data as any)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/suppliers')

  return { success: true, data }
}

/**
 * Updates an existing supplier
 * 
 * @param id - Supplier ID
 * @param formData - Form data with updated supplier information
 * @returns ActionResponse with updated supplier or error
 */
export async function updateSupplier(id: string, formData: FormData): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Validate input
  const validated = supplierSchema.partial().safeParse({
    name: formData.get('name') || undefined,
    contact_name: formData.get('contact_name') || undefined,
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    address: formData.get('address') || undefined,
    notes: formData.get('notes') || undefined
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // Update supplier
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('suppliers')
    .update(validated.data as any)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/suppliers')
  revalidatePath(`/catalogs/suppliers/${id}`)

  return { success: true, data }
}

/**
 * Deletes a supplier (soft delete by setting active = false)
 * 
 * @param id - Supplier ID
 * @returns ActionResponse with success status or error
 */
export async function deleteSupplier(id: string): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Soft delete by setting active = false
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('suppliers')
    .update({ active: false })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/suppliers')

  return { success: true }
}

// ============================================================================
// PRODUCT ACTIONS
// ============================================================================

/**
 * Creates a new product
 * 
 * Validates barcode uniqueness before creating the product.
 * Requirements: 4.1, 4.2
 * 
 * @param formData - Form data containing product information
 * @returns ActionResponse with created product or error
 */
export async function createProduct(formData: FormData): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Parse numeric and boolean fields
  const purchasePrice = formData.get('purchase_price')
  const price = formData.get('price')
  const minStock = formData.get('min_stock')
  const active = formData.get('active')

  // Validate input
  const validated = productSchema.safeParse({
    barcode: formData.get('barcode'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    line_id: formData.get('line_id'),
    category_id: formData.get('category_id'),
    brand_id: formData.get('brand_id') || undefined,
    supplier_id: formData.get('supplier_id') || undefined,
    size: formData.get('size') || undefined,
    color: formData.get('color') || undefined,
    presentation: formData.get('presentation') || undefined,
    purchase_price: purchasePrice ? Number(purchasePrice) : undefined,
    price: price ? Number(price) : undefined,
    min_stock: minStock ? Number(minStock) : 0,
    entry_date: formData.get('entry_date') || undefined,
    image_url: formData.get('image_url') || undefined,
    active: active === 'true' || active === true
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // Check barcode uniqueness
  const supabase = await createServerClient()
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('barcode', validated.data.barcode)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'Barcode already exists' }
  }

  // Insert product
  const { data, error } = await supabase
    .from('products')
    .insert(validated.data as any)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/products')
  revalidatePath('/api/products/search', 'page')

  return { success: true, data }
}

/**
 * Updates an existing product
 * 
 * Requirements: 4.1, 4.2
 * 
 * @param id - Product ID
 * @param formData - Form data with updated product information
 * @returns ActionResponse with updated product or error
 */
export async function updateProduct(id: string, formData: FormData): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Parse numeric and boolean fields
  const purchasePrice = formData.get('purchase_price')
  const price = formData.get('price')
  const minStock = formData.get('min_stock')
  const active = formData.get('active')

  // Validate input (partial update)
  const validated = productSchema.partial().safeParse({
    barcode: formData.get('barcode') || undefined,
    name: formData.get('name') || undefined,
    description: formData.get('description') || undefined,
    line_id: formData.get('line_id') || undefined,
    category_id: formData.get('category_id') || undefined,
    brand_id: formData.get('brand_id') || undefined,
    supplier_id: formData.get('supplier_id') || undefined,
    size: formData.get('size') || undefined,
    color: formData.get('color') || undefined,
    presentation: formData.get('presentation') || undefined,
    purchase_price: purchasePrice ? Number(purchasePrice) : undefined,
    price: price ? Number(price) : undefined,
    min_stock: minStock ? Number(minStock) : undefined,
    entry_date: formData.get('entry_date') || undefined,
    image_url: formData.get('image_url') || undefined,
    active: active !== null && active !== undefined ? (active === 'true' || active === true) : undefined
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // If barcode is being updated, check uniqueness
  const supabase = await createServerClient()
  if (validated.data.barcode) {
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('barcode', validated.data.barcode)
      .neq('id', id)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'Barcode already exists' }
    }
  }

  // Update product
  const { data, error } = await supabase
    .from('products')
    .update(validated.data as any)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/products')
  revalidatePath(`/catalogs/products/${id}`)
  revalidatePath('/api/products/search', 'page')

  return { success: true, data }
}

/**
 * Deletes a product (soft delete by setting active = false)
 * 
 * Requirements: 4.1, 4.2
 * 
 * @param id - Product ID
 * @returns ActionResponse with success status or error
 */
export async function deleteProduct(id: string): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Soft delete by setting active = false
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('products')
    .update({ active: false })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/catalogs/products')
  revalidatePath('/api/products/search', 'page')

  return { success: true }
}

// ============================================================================
// CLIENT ACTIONS
// ============================================================================

/**
 * Creates a new client
 * 
 * Validates DNI uniqueness before creating the client.
 * Requirements: 4.1
 * 
 * @param formData - Form data containing client information
 * @returns ActionResponse with created client or error
 */
export async function createClient(formData: FormData): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_CLIENTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Parse numeric and boolean fields
  const lat = formData.get('lat')
  const lng = formData.get('lng')
  const creditLimit = formData.get('credit_limit')
  const creditUsed = formData.get('credit_used')
  const active = formData.get('active')

  // Validate input
  const validated = clientSchema.safeParse({
    dni: formData.get('dni'),
    name: formData.get('name'),
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    address: formData.get('address') || undefined,
    lat: lat ? Number(lat) : undefined,
    lng: lng ? Number(lng) : undefined,
    credit_limit: creditLimit ? Number(creditLimit) : 0,
    credit_used: creditUsed ? Number(creditUsed) : 0,
    dni_photo_url: formData.get('dni_photo_url') || undefined,
    client_photo_url: formData.get('client_photo_url') || undefined,
    birthday: formData.get('birthday') || undefined,
    active: active === 'true' || active === true
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // Check DNI uniqueness
  const supabase = await createServerClient()
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('dni', validated.data.dni)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'DNI already exists' }
  }

  // Insert client
  const { data, error } = await supabase
    .from('clients')
    .insert(validated.data as any)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/clients')
  revalidatePath('/api/clients/search', 'page')

  return { success: true, data }
}

/**
 * Updates an existing client
 * 
 * Requirements: 4.1
 * 
 * @param id - Client ID
 * @param formData - Form data with updated client information
 * @returns ActionResponse with updated client or error
 */
export async function updateClient(id: string, formData: FormData): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_CLIENTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Parse numeric and boolean fields
  const lat = formData.get('lat')
  const lng = formData.get('lng')
  const creditLimit = formData.get('credit_limit')
  const creditUsed = formData.get('credit_used')
  const active = formData.get('active')

  // Validate input (partial update)
  const validated = clientSchema.partial().safeParse({
    dni: formData.get('dni') || undefined,
    name: formData.get('name') || undefined,
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    address: formData.get('address') || undefined,
    lat: lat ? Number(lat) : undefined,
    lng: lng ? Number(lng) : undefined,
    credit_limit: creditLimit ? Number(creditLimit) : undefined,
    credit_used: creditUsed ? Number(creditUsed) : undefined,
    dni_photo_url: formData.get('dni_photo_url') || undefined,
    client_photo_url: formData.get('client_photo_url') || undefined,
    birthday: formData.get('birthday') || undefined,
    active: active !== null && active !== undefined ? (active === 'true' || active === true) : undefined
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // If DNI is being updated, check uniqueness
  const supabase = await createServerClient()
  if (validated.data.dni) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('dni', validated.data.dni)
      .neq('id', id)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'DNI already exists' }
    }
  }

  // Update client
  const { data, error } = await supabase
    .from('clients')
    .update(validated.data as any)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  revalidatePath('/api/clients/search', 'page')

  return { success: true, data }
}

/**
 * Deletes a client (soft delete by setting active = false)
 * 
 * Requirements: 4.1
 * 
 * @param id - Client ID
 * @returns ActionResponse with success status or error
 */
export async function deleteClient(id: string): Promise<ActionResponse> {
  // Check permission
  const hasPermission = await checkPermission(Permission.MANAGE_CLIENTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Soft delete by setting active = false
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('clients')
    .update({ active: false })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate cache
  revalidatePath('/clients')
  revalidatePath('/api/clients/search', 'page')

  return { success: true }
}
