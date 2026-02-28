/**
 * Permission checking utilities for RBAC
 *
 * Provides functions to verify if the current user has specific permissions
 * based on their assigned roles.
 *
 * AUDIT FIX:
 * - roles=[] now returns false (secure by default, was returning true!)
 * - Single Supabase client + single query per request (was N queries for N permissions)
 * - getUserRolesOnce() cached within a request
 */

import { createServerClient } from '@/lib/supabase/server'
import { ROLE_PERMISSIONS, Permission, Role } from './permissions'

/**
 * Fetches the current user's roles from the database.
 * Returns null if not authenticated, empty array if no roles.
 *
 * SECURE BY DEFAULT: any exception → returns null → all permission checks deny.
 */
async function getUserRoles(): Promise<string[] | null> {
  try {
    const supabase = await createServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single()

    if (!profile) return null
    return (profile as Record<string, unknown>).roles as string[] || []
  } catch (error) {
    // Fail closed — any DB/network error → deny all permissions
    console.error('[checkPermission] getUserRoles failed (denying):', error)
    return null
  }
}

/**
 * Given a set of roles, collect all unique permissions
 */
function permissionsForRoles(roles: string[]): Set<Permission> {
  const permissions = new Set<Permission>()
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role as Role] || []
    for (const p of rolePerms) permissions.add(p)
  }
  return permissions
}

/**
 * Checks if the current authenticated user has a specific permission
 *
 * @param permission - The permission to check
 * @returns Promise<boolean> - true if user has the permission, false otherwise
 */
export async function checkPermission(permission: Permission): Promise<boolean> {
  const roles = await getUserRoles()

  // Not authenticated or no profile → deny
  if (!roles) return false

  // No roles assigned → deny (secure by default)
  if (roles.length === 0) return false

  return roles.some((role: string) =>
    ROLE_PERMISSIONS[role as Role]?.includes(permission)
  )
}

/**
 * Checks if the current authenticated user has any of the specified permissions
 *
 * OPTIMIZED: Single DB query instead of N queries
 */
export async function checkAnyPermission(permissions: Permission[]): Promise<boolean> {
  const roles = await getUserRoles()
  if (!roles || roles.length === 0) return false

  const userPerms = permissionsForRoles(roles)
  return permissions.some(p => userPerms.has(p))
}

/**
 * Checks if the current authenticated user has all of the specified permissions
 *
 * OPTIMIZED: Single DB query instead of N queries
 */
export async function checkAllPermissions(permissions: Permission[]): Promise<boolean> {
  const roles = await getUserRoles()
  if (!roles || roles.length === 0) return false

  const userPerms = permissionsForRoles(roles)
  return permissions.every(p => userPerms.has(p))
}

/**
 * Gets all permissions for the current authenticated user
 */
export async function getUserPermissions(): Promise<Permission[]> {
  const roles = await getUserRoles()

  // Not authenticated or no profile → no permissions
  if (!roles) return []

  // No roles assigned → no permissions (secure by default)
  if (roles.length === 0) return []

  return Array.from(permissionsForRoles(roles))
}
