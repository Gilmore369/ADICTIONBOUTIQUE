/**
 * Unit Tests for Authorization
 * 
 * Tests specific examples and edge cases for authorization:
 * - Role verification for admin and vendedor
 * - 403 error for unauthorized users
 * - Admin-only operations
 * 
 * Requirements: 13.1, 13.2, 13.3
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { requireRole, requireAdmin, requireCRMAccess, AuthorizationError } from './authorization'
import { Role } from './permissions'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))

describe('requireRole - Unit Tests', () => {
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
   * Test role verification for admin
   * Requirements: 13.1
   */
  it('grants access to admin user', async () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000'
    const userRoles = ['admin']
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })
    
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
    
    const result = await requireRole([Role.ADMIN])
    
    expect(result.userId).toBe(userId)
    expect(result.userRoles).toEqual(userRoles)
  })
  
  /**
   * Test role verification for vendedor
   * Requirements: 13.1
   */
  it('grants access to vendedor user', async () => {
    const userId = '223e4567-e89b-12d3-a456-426614174001'
    const userRoles = ['vendedor']
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })
    
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
    
    const result = await requireRole([Role.VENDEDOR])
    
    expect(result.userId).toBe(userId)
    expect(result.userRoles).toEqual(userRoles)
  })
  
  /**
   * Test 403 error for unauthorized user
   * Requirements: 13.2
   */
  it('denies access to user without required role with 403 error', async () => {
    const userId = '323e4567-e89b-12d3-a456-426614174002'
    const userRoles = ['cajero'] // Not admin or vendedor
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })
    
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
    
    await expect(requireRole([Role.ADMIN, Role.VENDEDOR])).rejects.toThrow(AuthorizationError)
    
    try {
      await requireRole([Role.ADMIN, Role.VENDEDOR])
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError)
      expect((error as AuthorizationError).statusCode).toBe(403)
      expect((error as AuthorizationError).message).toContain('No tiene permisos')
    }
  })
  
  /**
   * Test 401 error for unauthenticated user
   * Requirements: 13.1
   */
  it('denies access to unauthenticated user with 401 error', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })
    
    await expect(requireRole([Role.ADMIN])).rejects.toThrow(AuthorizationError)
    
    try {
      await requireRole([Role.ADMIN])
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError)
      expect((error as AuthorizationError).statusCode).toBe(401)
      expect((error as AuthorizationError).message).toContain('no autenticado')
    }
  })
  
  /**
   * Test error when user profile not found
   * Requirements: 13.1
   */
  it('denies access when user profile not found', async () => {
    const userId = '423e4567-e89b-12d3-a456-426614174003'
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Profile not found' },
          }),
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
    
    await expect(requireRole([Role.ADMIN])).rejects.toThrow(AuthorizationError)
    
    try {
      await requireRole([Role.ADMIN])
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError)
      expect((error as AuthorizationError).statusCode).toBe(403)
      expect((error as AuthorizationError).message).toContain('Perfil de usuario no encontrado')
    }
  })
  
  /**
   * Test error when user has no roles assigned
   * Requirements: 13.1
   */
  it('denies access when user has no roles assigned', async () => {
    const userId = '523e4567-e89b-12d3-a456-426614174004'
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { roles: [] }, // Empty roles array
            error: null,
          }),
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
    
    await expect(requireRole([Role.ADMIN])).rejects.toThrow(AuthorizationError)
    
    try {
      await requireRole([Role.ADMIN])
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError)
      expect((error as AuthorizationError).statusCode).toBe(403)
      expect((error as AuthorizationError).message).toContain('sin roles')
    }
  })
  
  /**
   * Test user with multiple roles
   * Requirements: 13.1
   */
  it('grants access to user with multiple roles including required role', async () => {
    const userId = '623e4567-e89b-12d3-a456-426614174005'
    const userRoles = ['vendedor', 'cajero']
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })
    
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
    
    const result = await requireRole([Role.ADMIN, Role.VENDEDOR])
    
    expect(result.userId).toBe(userId)
    expect(result.userRoles).toEqual(userRoles)
  })
})

describe('requireAdmin - Unit Tests', () => {
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
   * Test admin-only operation for admin user
   * Requirements: 13.3
   */
  it('grants access to admin user for admin-only operations', async () => {
    const userId = '723e4567-e89b-12d3-a456-426614174006'
    const userRoles = ['admin']
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })
    
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
    
    const result = await requireAdmin()
    
    expect(result.userId).toBe(userId)
    expect(result.userRoles).toContain('admin')
  })
  
  /**
   * Test admin-only operation denied for vendedor
   * Requirements: 13.3
   */
  it('denies access to vendedor user for admin-only operations', async () => {
    const userId = '823e4567-e89b-12d3-a456-426614174007'
    const userRoles = ['vendedor']
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })
    
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
    
    await expect(requireAdmin()).rejects.toThrow(AuthorizationError)
    
    try {
      await requireAdmin()
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError)
      expect((error as AuthorizationError).statusCode).toBe(403)
    }
  })
  
  /**
   * Test admin-only operation denied for other roles
   * Requirements: 13.3
   */
  it('denies access to non-admin users for admin-only operations', async () => {
    const userId = '923e4567-e89b-12d3-a456-426614174008'
    const userRoles = ['cajero', 'viewer']
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })
    
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
    
    await expect(requireAdmin()).rejects.toThrow(AuthorizationError)
  })
})

describe('requireCRMAccess - Unit Tests', () => {
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
   * Test CRM access for admin
   * Requirements: 13.1
   */
  it('grants CRM access to admin user', async () => {
    const userId = 'a23e4567-e89b-12d3-a456-426614174009'
    const userRoles = ['admin']
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })
    
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
    
    const result = await requireCRMAccess()
    
    expect(result.userId).toBe(userId)
    expect(result.userRoles).toContain('admin')
  })
  
  /**
   * Test CRM access for vendedor
   * Requirements: 13.1
   */
  it('grants CRM access to vendedor user', async () => {
    const userId = 'b23e4567-e89b-12d3-a456-426614174010'
    const userRoles = ['vendedor']
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })
    
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
    
    const result = await requireCRMAccess()
    
    expect(result.userId).toBe(userId)
    expect(result.userRoles).toContain('vendedor')
  })
  
  /**
   * Test CRM access denied for other roles
   * Requirements: 13.2
   */
  it('denies CRM access to users without admin or vendedor role', async () => {
    const userId = 'c23e4567-e89b-12d3-a456-426614174011'
    const userRoles = ['cajero']
    
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: userId },
      },
      error: null,
    })
    
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
    
    await expect(requireCRMAccess()).rejects.toThrow(AuthorizationError)
    
    try {
      await requireCRMAccess()
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError)
      expect((error as AuthorizationError).statusCode).toBe(403)
    }
  })
})
