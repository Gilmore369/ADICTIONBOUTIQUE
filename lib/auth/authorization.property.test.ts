/**
 * Property-Based Tests for Authorization
 * 
 * Tests universal properties that must hold for all valid inputs:
 * - Property 29: Authorization Role Verification
 * - Property 30: Admin-Only Deactivation
 * 
 * Uses fast-check library for property-based testing
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import * as fc from 'fast-check'
import { requireRole, requireAdmin, requireCRMAccess, AuthorizationError } from './authorization'
import { Role } from './permissions'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))

describe('requireRole - Property-Based Tests', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    }
    
    const { createServerClient } = require('@/lib/supabase/server')
    createServerClient.mockResolvedValue(mockSupabase)
  })
  
  /**
   * Property 29: Authorization Role Verification
   * **Validates: Requirements 13.1, 13.2**
   * 
   * For any user attempting to access CRM functions, the system must verify
   * the user has role 'admin' or 'vendedor'; users without these roles must
   * receive a 403 error.
   */
  it('Property 29: grants access only to users with required roles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          userRoles: fc.array(
            fc.constantFrom('admin', 'vendedor', 'cajero', 'viewer', 'other'),
            { minLength: 1, maxLength: 3 }
          ),
          requiredRoles: fc.constantFrom(
            [Role.ADMIN, Role.VENDEDOR],
            [Role.ADMIN],
            [Role.VENDEDOR]
          ),
        }),
        async ({ userId, userRoles, requiredRoles }) => {
          // Mock authenticated user
          mockSupabase.auth.getUser.mockResolvedValue({
            data: {
              user: { id: userId },
            },
            error: null,
          })
          
          // Mock user profile with roles
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'users') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: { roles: userRoles },
                  error: null,
                }),
              }
            }
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          // Check if user has at least one required role
          const hasRequiredRole = userRoles.some(role => 
            requiredRoles.includes(role as Role)
          )
          
          if (hasRequiredRole) {
            // Property 1: User with required role must be granted access
            const result = await requireRole(requiredRoles)
            expect(result.userId).toBe(userId)
            expect(result.userRoles).toEqual(userRoles)
          } else {
            // Property 2: User without required role must be denied with 403 error
            await expect(requireRole(requiredRoles)).rejects.toThrow(AuthorizationError)
            
            try {
              await requireRole(requiredRoles)
            } catch (error) {
              expect(error).toBeInstanceOf(AuthorizationError)
              expect((error as AuthorizationError).statusCode).toBe(403)
              expect((error as AuthorizationError).message).toContain('No tiene permisos')
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * Property 30: Admin-Only Deactivation
   * **Validates: Requirements 13.3**
   * 
   * For any user attempting to deactivate a client, the system must verify
   * the user has role 'admin'; users without this role must be denied.
   */
  it('Property 30: only admin users can access admin-only operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          userRoles: fc.array(
            fc.constantFrom('admin', 'vendedor', 'cajero', 'viewer'),
            { minLength: 1, maxLength: 3 }
          ),
        }),
        async ({ userId, userRoles }) => {
          // Mock authenticated user
          mockSupabase.auth.getUser.mockResolvedValue({
            data: {
              user: { id: userId },
            },
            error: null,
          })
          
          // Mock user profile with roles
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'users') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: { roles: userRoles },
                  error: null,
                }),
              }
            }
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const isAdmin = userRoles.includes('admin')
          
          if (isAdmin) {
            // Property 1: Admin users must be granted access
            const result = await requireAdmin()
            expect(result.userId).toBe(userId)
            expect(result.userRoles).toContain('admin')
          } else {
            // Property 2: Non-admin users must be denied with 403 error
            await expect(requireAdmin()).rejects.toThrow(AuthorizationError)
            
            try {
              await requireAdmin()
            } catch (error) {
              expect(error).toBeInstanceOf(AuthorizationError)
              expect((error as AuthorizationError).statusCode).toBe(403)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * Additional Property Test: CRM access for admin and vendedor
   * 
   * For any user attempting to access CRM features, access must be granted
   * if and only if the user has 'admin' or 'vendedor' role.
   */
  it('Property: CRM access granted only to admin and vendedor roles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          userRoles: fc.array(
            fc.constantFrom('admin', 'vendedor', 'cajero', 'viewer', 'other'),
            { minLength: 1, maxLength: 3 }
          ),
        }),
        async ({ userId, userRoles }) => {
          // Mock authenticated user
          mockSupabase.auth.getUser.mockResolvedValue({
            data: {
              user: { id: userId },
            },
            error: null,
          })
          
          // Mock user profile with roles
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'users') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: { roles: userRoles },
                  error: null,
                }),
              }
            }
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          const hasCRMAccess = userRoles.includes('admin') || userRoles.includes('vendedor')
          
          if (hasCRMAccess) {
            // Property: Users with admin or vendedor role must be granted access
            const result = await requireCRMAccess()
            expect(result.userId).toBe(userId)
            expect(result.userRoles).toEqual(userRoles)
          } else {
            // Property: Users without admin or vendedor role must be denied
            await expect(requireCRMAccess()).rejects.toThrow(AuthorizationError)
            
            try {
              await requireCRMAccess()
            } catch (error) {
              expect(error).toBeInstanceOf(AuthorizationError)
              expect((error as AuthorizationError).statusCode).toBe(403)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * Additional Property Test: Unauthenticated users are denied
   * 
   * For any unauthenticated request, access must always be denied with 401 error.
   */
  it('Property: unauthenticated users always receive 401 error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          [Role.ADMIN],
          [Role.VENDEDOR],
          [Role.ADMIN, Role.VENDEDOR]
        ),
        async (requiredRoles) => {
          // Mock unauthenticated user
          mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: { message: 'Not authenticated' },
          })
          
          // Property: Unauthenticated users must be denied with 401 error
          await expect(requireRole(requiredRoles)).rejects.toThrow(AuthorizationError)
          
          try {
            await requireRole(requiredRoles)
          } catch (error) {
            expect(error).toBeInstanceOf(AuthorizationError)
            expect((error as AuthorizationError).statusCode).toBe(401)
            expect((error as AuthorizationError).message).toContain('no autenticado')
          }
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * Additional Property Test: Users without roles are denied
   * 
   * For any authenticated user with no roles assigned, access must be denied.
   */
  it('Property: users without roles are denied with 403 error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          requiredRoles: fc.constantFrom(
            [Role.ADMIN],
            [Role.VENDEDOR],
            [Role.ADMIN, Role.VENDEDOR]
          ),
        }),
        async ({ userId, requiredRoles }) => {
          // Mock authenticated user
          mockSupabase.auth.getUser.mockResolvedValue({
            data: {
              user: { id: userId },
            },
            error: null,
          })
          
          // Mock user profile with empty roles
          mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'users') {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: { roles: [] }, // No roles assigned
                  error: null,
                }),
              }
            }
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }
          })
          
          // Property: Users without roles must be denied with 403 error
          await expect(requireRole(requiredRoles)).rejects.toThrow(AuthorizationError)
          
          try {
            await requireRole(requiredRoles)
          } catch (error) {
            expect(error).toBeInstanceOf(AuthorizationError)
            expect((error as AuthorizationError).statusCode).toBe(403)
            expect((error as AuthorizationError).message).toContain('sin roles')
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})
