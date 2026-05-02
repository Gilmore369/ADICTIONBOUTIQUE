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
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { checkPermission } from '@/lib/auth/check-permission'
import { Permission } from '@/lib/auth/permissions'
import { logAudit } from '@/lib/audit'

async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch { return null }
}
import {
  lineSchema,
  categorySchema,
  brandSchema,
  sizeSchema,
  supplierSchema,
  productSchema,
  clientSchema,
  clientUpdateSchema
} from '@/lib/validations/catalogs'

/**
 * Cuenta cuántos registros activos de `table` tienen `column = id` y devuelve
 * el TOTAL real más una muestra de hasta 5 nombres.
 *
 * Antes hacía solo `.limit(5)` y reportaba `length` como total — eso engañaba
 * al usuario diciendo "5 producto(s)" cuando podía haber 100.
 *
 * @param table   Nombre de la tabla a chequear (ej: 'products')
 * @param column  Columna FK a buscar (ej: 'category_id')
 * @param id      Valor del FK
 * @param sizeMatch  Si true, en lugar de comparar `column = id`, busca el campo
 *                   `size` por nombre (caso especial de tallas que son TEXT).
 *                   En ese caso `column` debe ser el name de la talla.
 */
async function countActiveDependents(
  supabase: any,
  table: string,
  column: string,
  id: string,
  sizeMatch = false
): Promise<{ total: number; sample: string[]; error?: string }> {
  // 1. Obtener count exacto
  const countQuery = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('active', true)

  if (sizeMatch) countQuery.eq('size', column)
  else countQuery.eq(column, id)

  const { count, error: countError } = await countQuery
  if (countError) return { total: 0, sample: [], error: countError.message }

  if (!count || count === 0) return { total: 0, sample: [] }

  // 2. Obtener muestra de nombres (5)
  const sampleQuery = supabase
    .from(table)
    .select('name')
    .eq('active', true)
    .limit(5)

  if (sizeMatch) sampleQuery.eq('size', column)
  else sampleQuery.eq(column, id)

  const { data: sample, error: sampleError } = await sampleQuery
  if (sampleError) return { total: count, sample: [], error: sampleError.message }

  return { total: count, sample: (sample || []).map((r: any) => r.name) }
}

/**
 * Construye un mensaje de error claro para "no se puede eliminar X porque hay Y dependientes"
 */
function buildDependencyError(
  total: number,
  sample: string[],
  what: string,           // ej: 'producto(s)'
  using: string,          // ej: 'esta talla'
): string {
  const sampleStr = sample.join(', ')
  const moreCount = total - sample.length
  const moreText = moreCount > 0 ? ` y ${moreCount} más` : ''
  return `No se puede eliminar. Hay ${total} ${what} usando ${using}: ${sampleStr}${moreText}.`
}

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
    description: formData.get('description') || undefined,
    active: formData.get('active') === 'on'
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
 * Checks for dependencies before deletion
 * 
 * @param id - Line ID
 * @returns ActionResponse with success status or error
 */
export async function deleteLine(id: string): Promise<ActionResponse> {
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  const supabase = await createServerClient()

  // Conteo exacto de productos que usan esta línea
  const depProducts = await countActiveDependents(supabase, 'products', 'line_id', id)
  if (depProducts.error) return { success: false, error: depProducts.error }
  if (depProducts.total > 0) {
    return { success: false, error: buildDependencyError(depProducts.total, depProducts.sample, 'producto(s)', 'esta línea') }
  }

  // Conteo exacto de categorías que usan esta línea
  const depCats = await countActiveDependents(supabase, 'categories', 'line_id', id)
  if (depCats.error) return { success: false, error: depCats.error }
  if (depCats.total > 0) {
    return { success: false, error: buildDependencyError(depCats.total, depCats.sample, 'categoría(s)', 'esta línea') }
  }

  // Soft delete con verificación de filas afectadas
  const { data: updated, error } = await supabase
    .from('lines')
    .update({ active: false })
    .eq('id', id)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'No se pudo eliminar la línea. Verifica permisos o que la línea aún exista.' }
  }

  revalidatePath('/catalogs/lines')

  const uid = await getCurrentUserId()
  await logAudit({ userId: uid, action: 'DELETE', entityType: 'catalog_line', entityId: id, detail: 'Línea desactivada' })

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
    description: formData.get('description') || undefined,
    active: formData.get('active') === 'on'
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
 * Checks for dependencies before deletion
 * 
 * @param id - Category ID
 * @returns ActionResponse with success status or error
 */
export async function deleteCategory(id: string): Promise<ActionResponse> {
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  const supabase = await createServerClient()

  // Conteo exacto de productos que usan esta categoría
  const depProducts = await countActiveDependents(supabase, 'products', 'category_id', id)
  if (depProducts.error) return { success: false, error: depProducts.error }
  if (depProducts.total > 0) {
    return { success: false, error: buildDependencyError(depProducts.total, depProducts.sample, 'producto(s)', 'esta categoría') }
  }

  // Conteo exacto de tallas que usan esta categoría
  const depSizes = await countActiveDependents(supabase, 'sizes', 'category_id', id)
  if (depSizes.error) return { success: false, error: depSizes.error }
  if (depSizes.total > 0) {
    return { success: false, error: buildDependencyError(depSizes.total, depSizes.sample, 'talla(s)', 'esta categoría') }
  }

  // Soft delete con verificación de filas afectadas
  const { data: updated, error } = await supabase
    .from('categories')
    .update({ active: false })
    .eq('id', id)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'No se pudo eliminar la categoría. Verifica permisos o que la categoría aún exista.' }
  }

  revalidatePath('/catalogs/categories')

  const uid = await getCurrentUserId()
  await logAudit({ userId: uid, action: 'DELETE', entityType: 'catalog_category', entityId: id, detail: 'Categoría desactivada' })

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
    description: formData.get('description') || undefined,
    active: formData.get('active') === 'on'
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
 * Checks for dependencies before deletion
 * 
 * @param id - Brand ID
 * @returns ActionResponse with success status or error
 */
export async function deleteBrand(id: string): Promise<ActionResponse> {
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  const supabase = await createServerClient()

  // Conteo exacto de productos que usan esta marca
  const depProducts = await countActiveDependents(supabase, 'products', 'brand_id', id)
  if (depProducts.error) return { success: false, error: depProducts.error }
  if (depProducts.total > 0) {
    return { success: false, error: buildDependencyError(depProducts.total, depProducts.sample, 'producto(s)', 'esta marca') }
  }

  // Soft delete con verificación de filas afectadas
  const { data: updated, error } = await supabase
    .from('brands')
    .update({ active: false })
    .eq('id', id)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'No se pudo eliminar la marca. Verifica permisos o que la marca aún exista.' }
  }

  revalidatePath('/catalogs/brands')

  const uid = await getCurrentUserId()
  await logAudit({ userId: uid, action: 'DELETE', entityType: 'catalog_brand', entityId: id, detail: 'Marca desactivada' })

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

  const supabase = await createServerClient()

  if (data instanceof FormData) {
    // Support multiple names (from dynamic multi-row form)
    const names = data.getAll('name').map(n => String(n).trim()).filter(Boolean)
    const category_id = String(data.get('category_id') || '').trim()

    if (!category_id) {
      return { success: false, error: 'Categoría es requerida' }
    }
    if (names.length === 0) {
      return { success: false, error: 'Ingresa al menos una talla' }
    }

    // Batch insert all sizes at once
    const rows = names.map(name => ({ name, category_id }))
    const { data: result, error } = await supabase
      .from('sizes')
      .insert(rows)
      .select()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/catalogs/sizes')
    return { success: true, data: result }
  }

  // Object mode (programmatic)
  const validated = sizeSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  const { data: result, error } = await supabase
    .from('sizes')
    .insert(validated.data as any)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

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
    active: formData.get('active') === 'on'
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
 * Checks for dependencies before deletion
 * 
 * @param id - Size ID
 * @returns ActionResponse with success status or error
 */
export async function deleteSize(id: string): Promise<ActionResponse> {
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  const supabase = await createServerClient()

  // products.size es TEXT (no FK). Necesitamos nombre Y category_id para
  // que la validación esté SCOPED a la categoría correcta.
  // Ej: la talla "S" de Billeteras es independiente de la talla "S" de Casacas
  // (son rows distintos en sizes, con distinto category_id, pero ambas se
  // guardan como string 'S' en products.size). Si no filtramos por categoría,
  // bloqueamos la eliminación de tallas no usadas en su categoría real.
  const { data: sizeData, error: sizeError } = await supabase
    .from('sizes')
    .select('name, category_id, categories(name)')
    .eq('id', id)
    .single()

  if (sizeError) return { success: false, error: sizeError.message }

  // Conteo exacto de productos en LA MISMA CATEGORÍA que usan esta talla
  const { count, error: countError } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)
    .eq('size', sizeData.name)
    .eq('category_id', sizeData.category_id)

  if (countError) return { success: false, error: countError.message }

  if (count && count > 0) {
    // Obtener muestra de nombres para mostrar al usuario
    const { data: sample } = await supabase
      .from('products')
      .select('name')
      .eq('active', true)
      .eq('size', sizeData.name)
      .eq('category_id', sizeData.category_id)
      .limit(5)

    const categoryName = (sizeData as any).categories?.name || 'esta categoría'
    const sampleNames = (sample || []).map((p: any) => p.name)
    const moreCount = count - sampleNames.length
    const moreText = moreCount > 0 ? ` y ${moreCount} más` : ''
    return {
      success: false,
      error: `No se puede eliminar. Hay ${count} producto(s) de "${categoryName}" usando la talla "${sizeData.name}": ${sampleNames.join(', ')}${moreText}.`
    }
  }

  // Soft delete con verificación de filas afectadas
  const { data: updated, error } = await supabase
    .from('sizes')
    .update({ active: false })
    .eq('id', id)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'No se pudo eliminar la talla. Verifica permisos o que la talla aún exista.' }
  }

  revalidatePath('/catalogs/sizes')

  const uid = await getCurrentUserId()
  await logAudit({ userId: uid, action: 'DELETE', entityType: 'catalog_size', entityId: id, detail: 'Talla desactivada' })

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
    ruc: formData.get('ruc') || undefined,
    contact_name: formData.get('contact_name') || undefined,
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    address: formData.get('address') || undefined,
    notes: formData.get('notes') || undefined
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // Insert supplier — incluye notes y ruc (columnas presentes tras migraciones)
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('suppliers')
    .insert(validated.data)
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
    ruc: formData.get('ruc') || undefined,
    contact_name: formData.get('contact_name') || undefined,
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    address: formData.get('address') || undefined,
    notes: formData.get('notes') || undefined,
    active: formData.get('active') === 'on'
  })

  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors }
  }

  // Update supplier — incluye notes y ruc (columnas presentes tras migraciones)
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('suppliers')
    .update(validated.data)
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
 * Checks for dependencies before deletion
 * 
 * @param id - Supplier ID
 * @returns ActionResponse with success status or error
 */
export async function deleteSupplier(id: string): Promise<ActionResponse> {
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  const supabase = await createServerClient()

  // Conteo exacto de productos que usan este proveedor
  const depProducts = await countActiveDependents(supabase, 'products', 'supplier_id', id)
  if (depProducts.error) return { success: false, error: depProducts.error }
  if (depProducts.total > 0) {
    return { success: false, error: buildDependencyError(depProducts.total, depProducts.sample, 'producto(s)', 'este proveedor') }
  }

  // Soft delete con verificación de filas afectadas
  const { data: updated, error } = await supabase
    .from('suppliers')
    .update({ active: false })
    .eq('id', id)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'No se pudo eliminar el proveedor. Verifica permisos o que el proveedor aún exista.' }
  }

  revalidatePath('/catalogs/suppliers')

  const uid = await getCurrentUserId()
  await logAudit({ userId: uid, action: 'DELETE', entityType: 'catalog_supplier', entityId: id, detail: 'Proveedor desactivado' })

  return { success: true }
}

/**
 * Updates the brands associated with a supplier.
 * Replaces the current set of brands with the provided list.
 */
export async function updateSupplierBrands(supplierId: string, brandIds: string[]): Promise<ActionResponse> {
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  const supabase = await createServerClient()

  // Delete existing links for this supplier
  await supabase.from('supplier_brands').delete().eq('supplier_id', supplierId)

  // Insert new links (if any)
  if (brandIds.length > 0) {
    const records = brandIds.map(brandId => ({ supplier_id: supplierId, brand_id: brandId }))
    const { error } = await supabase.from('supplier_brands').insert(records)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/catalogs/suppliers')
  revalidatePath('/catalogs/brands')
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
    min_stock: minStock ? Number(minStock) : 1,
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

  // Create initial stock entries (quantity 0) for both warehouses
  try {
    const service = createServiceClient()
    await service.from('stock').upsert([
      { product_id: data.id, warehouse_id: 'Tienda Mujeres', quantity: 0 },
      { product_id: data.id, warehouse_id: 'Tienda Hombres', quantity: 0 },
    ], { onConflict: 'product_id,warehouse_id', ignoreDuplicates: true })
  } catch (stockErr) {
    console.warn('[createProduct] Could not create initial stock entries:', stockErr)
  }

  // Revalidate cache
  revalidatePath('/catalogs/products')
  revalidatePath('/api/products/search', 'page')
  revalidatePath('/inventory/stock')

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

  const uid = await getCurrentUserId()
  await logAudit({
    userId: uid,
    action: 'UPDATE',
    entityType: 'product',
    entityId: id,
    entityName: (data as any)?.name ?? id,
    detail: `Campos actualizados: ${Object.keys(validated.data).join(', ')}`,
    newValues: validated.data as any,
  })

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
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  // Soft delete con verificación de filas afectadas para detectar bloqueo silencioso de RLS
  const supabase = await createServerClient()
  const { data: updated, error } = await supabase
    .from('products')
    .update({ active: false })
    .eq('id', id)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!updated || updated.length === 0) {
    return {
      success: false,
      error: 'No se pudo eliminar el producto. Verifica permisos o que el producto aún exista.'
    }
  }

  revalidatePath('/catalogs/products')
  revalidatePath('/api/products/search', 'page')

  const uid = await getCurrentUserId()
  await logAudit({
    userId: uid,
    action: 'DELETE',
    entityType: 'product',
    entityId: id,
    detail: 'Producto desactivado',
  })

  return { success: true }
}

// ============================================================================
// RESTORE ACTIONS — Reactivar items soft-deleted
// ============================================================================

/**
 * Helper genérico para reactivar un registro soft-deleted
 */
async function restoreEntity(
  table: string,
  id: string,
  entityType: string,
  revalidatePaths: string[]
): Promise<ActionResponse> {
  const hasPermission = await checkPermission(Permission.MANAGE_PRODUCTS)
  if (!hasPermission) {
    return { success: false, error: 'Forbidden: Insufficient permissions' }
  }

  const supabase = await createServerClient()
  const { data: updated, error } = await supabase
    .from(table)
    .update({ active: true })
    .eq('id', id)
    .select('id')

  if (error) return { success: false, error: error.message }
  if (!updated || updated.length === 0) {
    return { success: false, error: `No se pudo restaurar. Verifica permisos o que el registro aún exista.` }
  }

  for (const path of revalidatePaths) revalidatePath(path)

  const uid = await getCurrentUserId()
  await logAudit({ userId: uid, action: 'RESTORE', entityType, entityId: id, detail: `${entityType} reactivado` })

  return { success: true }
}

// Server actions deben ser funciones async declaradas (no arrow consts).
export async function restoreProduct(id: string)  { return restoreEntity('products',   id, 'product',          ['/catalogs/products', '/api/products/search']) }
export async function restoreSize(id: string)     { return restoreEntity('sizes',      id, 'catalog_size',     ['/catalogs/sizes']) }
export async function restoreLine(id: string)     { return restoreEntity('lines',      id, 'catalog_line',     ['/catalogs/lines']) }
export async function restoreCategory(id: string) { return restoreEntity('categories', id, 'catalog_category', ['/catalogs/categories']) }
export async function restoreBrand(id: string)    { return restoreEntity('brands',     id, 'catalog_brand',    ['/catalogs/brands']) }
export async function restoreSupplier(id: string) { return restoreEntity('suppliers',  id, 'catalog_supplier', ['/catalogs/suppliers']) }

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
    referred_by: formData.get('referred_by') || undefined,
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

  // Validate that referred_by is provided for new clients
  if (!validated.data.referred_by) {
    return { success: false, error: 'Un cliente debe ser referido por otro cliente existente' }
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

  // Verify that the referring client exists and get their rating
  const { data: referrer } = await supabase
    .from('clients')
    .select('id, name, rating')
    .eq('id', validated.data.referred_by)
    .eq('active', true)
    .maybeSingle()

  if (!referrer) {
    return { success: false, error: 'El cliente que refiere no existe o está inactivo' }
  }

  // Determine initial rating based on referrer's rating
  // If referrer is A or B → new client starts at D, otherwise starts at E
  const referrerRating = (referrer as any).rating as string | null
  const initialRating = (referrerRating === 'A' || referrerRating === 'B') ? 'D' : 'E'
  const creditLimitByRating: Record<string, number> = { A: 2500, B: 1500, C: 875, D: 625, E: 300 }
  const initialCreditLimit = validated.data.credit_limit > 0
    ? validated.data.credit_limit  // Admin manually set a credit limit
    : creditLimitByRating[initialRating]

  // Insert client with computed initial rating
  const { data, error } = await supabase
    .from('clients')
    .insert({
      ...validated.data,
      rating: initialRating,
      credit_limit: initialCreditLimit,
    } as any)
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

  const ratingRaw = formData.get('rating')

  // Validate input (partial update)
  const validated = clientUpdateSchema.partial().safeParse({
    dni: formData.get('dni') || undefined,
    name: formData.get('name') || undefined,
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    address: formData.get('address') || undefined,
    lat: lat ? Number(lat) : undefined,
    lng: lng ? Number(lng) : undefined,
    credit_limit: creditLimit ? Number(creditLimit) : undefined,
    credit_used: creditUsed ? Number(creditUsed) : undefined,
    rating: ratingRaw || undefined,
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

  // If rating changes and credit_limit is not explicitly provided,
  // set credit_limit to GREATEST(rating_default, current credit_used)
  // to avoid violating the credit constraint on existing clients
  const creditLimitByRating: Record<string, number> = { A: 2500, B: 1500, C: 875, D: 625, E: 300 }
  if (validated.data.rating && !validated.data.credit_limit) {
    const { data: currentClient } = await supabase
      .from('clients')
      .select('credit_used')
      .eq('id', id)
      .single()
    const creditUsed = (currentClient as any)?.credit_used ?? 0
    validated.data.credit_limit = Math.max(
      creditLimitByRating[validated.data.rating] ?? 300,
      creditUsed
    )
  }

  // Use service client for writes to bypass RLS
  const service = createServiceClient()

  // Update client
  const { data, error } = await service
    .from('clients')
    .update(validated.data as any)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // If rating was manually changed, sync client_ratings table
  // (profile view reads from client_ratings, not clients.rating)
  if (validated.data.rating) {
    const { data: existingRating } = await service
      .from('client_ratings')
      .select('score, payment_punctuality, purchase_frequency, total_purchases, client_tenure_days')
      .eq('client_id', id)
      .maybeSingle()

    if (existingRating) {
      // Keep existing metric scores, just update the rating label
      await service
        .from('client_ratings')
        .update({ rating: validated.data.rating, last_calculated: new Date().toISOString() })
        .eq('client_id', id)
    } else {
      // No existing record — insert with neutral scores
      await service
        .from('client_ratings')
        .insert({
          client_id: id,
          rating: validated.data.rating,
          score: 50,
          payment_punctuality: 50,
          purchase_frequency: 0,
          total_purchases: 0,
          client_tenure_days: 0,
          last_calculated: new Date().toISOString(),
        })
    }
  }

  // Revalidate cache
  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  revalidatePath('/api/clients/search', 'page')

  const uid = await getCurrentUserId()
  await logAudit({
    userId: uid,
    action: 'UPDATE',
    entityType: 'client',
    entityId: id,
    entityName: (data as any)?.name ?? id,
    detail: `Campos actualizados: ${Object.keys(validated.data).join(', ')}`,
    newValues: validated.data as any,
  })

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

  const uid = await getCurrentUserId()
  await logAudit({
    userId: uid,
    action: 'DELETE',
    entityType: 'client',
    entityId: id,
    detail: 'Cliente desactivado',
  })

  return { success: true }
}
