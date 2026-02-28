/**
 * Authorization Middleware
 * 
 * Provides middleware functions to check user roles and enforce authorization
 * for CRM and other sensitive operations.
 * 
 * Requirements: 13.1, 13.2, 13.3
 */

import { createServerClient } from '@/lib/supabase/server'
import { Role } from './permissions'

/**
 * Error class for authorization failures
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403
  ) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

/**
 * Checks if the current authenticated user has one of the required roles
 * 
 * @param requiredRoles - Array of roles that are allowed to access the resource
 * @returns Promise<{ userId: string, userRoles: string[] }> - User ID and roles if authorized
 * @throws AuthorizationError if user is not authenticated or doesn't have required role
 * 
 * @example
 * ```typescript
 * // In a Server Action or API Route
 * try {
 *   const { userId } = await requireRole([Role.ADMIN, Role.VENDEDOR])
 *   // User is authorized, proceed with operation
 * } catch (error) {
 *   if (error instanceof AuthorizationError) {
 *     return { success: false, error: error.message }
 *   }
 *   throw error
 * }
 * ```
 */
export async function requireRole(
  requiredRoles: Role[]
): Promise<{ userId: string; userRoles: string[] }> {
  const supabase = await createServerClient()
  
  // Get the current authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new AuthorizationError('Usuario no autenticado', 401)
  }
  
  // Fetch user profile with roles
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single()
  
  if (profileError || !profile) {
    throw new AuthorizationError('Perfil de usuario no encontrado', 403)
  }
  
  const userRoles = (profile as any).roles as string[]
  
  if (!userRoles || userRoles.length === 0) {
    throw new AuthorizationError('Usuario sin roles asignados', 403)
  }
  
  // Check if user has at least one of the required roles
  const hasRequiredRole = userRoles.some(role => 
    requiredRoles.includes(role as Role)
  )
  
  if (!hasRequiredRole) {
    throw new AuthorizationError(
      'No tiene permisos para acceder a este recurso',
      403
    )
  }
  
  return {
    userId: user.id,
    userRoles
  }
}

/**
 * Checks if the current authenticated user has the admin role
 * 
 * @returns Promise<{ userId: string, userRoles: string[] }> - User ID and roles if authorized
 * @throws AuthorizationError if user is not an admin
 * 
 * @example
 * ```typescript
 * // In a Server Action for client deactivation
 * try {
 *   const { userId } = await requireAdmin()
 *   await deactivateClient(clientId, reason, notes, userId)
 * } catch (error) {
 *   if (error instanceof AuthorizationError) {
 *     return { success: false, error: error.message }
 *   }
 *   throw error
 * }
 * ```
 */
export async function requireAdmin(): Promise<{ userId: string; userRoles: string[] }> {
  return requireRole([Role.ADMIN])
}

/**
 * Checks if the current authenticated user has CRM access (admin or vendedor)
 * 
 * @returns Promise<{ userId: string, userRoles: string[] }> - User ID and roles if authorized
 * @throws AuthorizationError if user doesn't have CRM access
 * 
 * @example
 * ```typescript
 * // In a Server Action for CRM features
 * try {
 *   const { userId } = await requireCRMAccess()
 *   const profile = await fetchClientProfile(clientId)
 *   return { success: true, data: profile }
 * } catch (error) {
 *   if (error instanceof AuthorizationError) {
 *     return { success: false, error: error.message }
 *   }
 *   throw error
 * }
 * ```
 */
export async function requireCRMAccess(): Promise<{ userId: string; userRoles: string[] }> {
  return requireRole([Role.ADMIN, Role.VENDEDOR])
}
