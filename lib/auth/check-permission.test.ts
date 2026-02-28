/**
 * Regression tests for RBAC permission checking
 *
 * Captures bug: empty roles[] was returning true (admin access)
 * Now: empty roles[] returns false (deny by default)
 */

// Mock Supabase before importing the module under test
const mockGetUser = jest.fn()
const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockSingle = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: (...args: any[]) => {
        mockSelect(...args)
        return {
          eq: (...eqArgs: any[]) => {
            mockEq(...eqArgs)
            return { single: () => mockSingle() }
          },
        }
      },
    }),
  }),
}))

import { checkPermission, checkAnyPermission, checkAllPermissions, getUserPermissions } from './check-permission'
import { Permission } from './permissions'

describe('checkPermission — RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── CRITICAL REGRESSION: empty roles must NOT grant access ──────────
  it('DENIES access when user has empty roles array', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({ data: { roles: [] } })

    const result = await checkPermission(Permission.CREATE_SALE)
    expect(result).toBe(false)
  })

  it('DENIES access when user profile has null roles', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({ data: { roles: null } })

    const result = await checkPermission(Permission.CREATE_SALE)
    expect(result).toBe(false)
  })

  it('DENIES access when user profile not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({ data: null })

    const result = await checkPermission(Permission.CREATE_SALE)
    expect(result).toBe(false)
  })

  it('DENIES access when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await checkPermission(Permission.CREATE_SALE)
    expect(result).toBe(false)
  })

  // ── Normal cases ────────────────────────────────────────────────────
  it('ALLOWS admin to do anything', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({ data: { roles: ['admin'] } })

    const result = await checkPermission(Permission.MANAGE_USERS)
    expect(result).toBe(true)
  })

  it('ALLOWS vendedor to create sale', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({ data: { roles: ['vendedor'] } })

    const result = await checkPermission(Permission.CREATE_SALE)
    expect(result).toBe(true)
  })

  it('DENIES vendedor from managing users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({ data: { roles: ['vendedor'] } })

    const result = await checkPermission(Permission.MANAGE_USERS)
    expect(result).toBe(false)
  })

  it('ALLOWS cobrador to record payment', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({ data: { roles: ['cobrador'] } })

    const result = await checkPermission(Permission.RECORD_PAYMENT)
    expect(result).toBe(true)
  })

  // ── Exception safety: fail closed ──────────────────────────────────
  it('DENIES access when database throws an exception', async () => {
    mockGetUser.mockRejectedValue(new Error('connection refused'))

    const result = await checkPermission(Permission.CREATE_SALE)
    expect(result).toBe(false)
  })

  it('DENIES access when Supabase client creation fails', async () => {
    const { createServerClient } = require('@/lib/supabase/server')
    ;(createServerClient as jest.Mock).mockRejectedValueOnce(new Error('init failed'))

    const result = await checkPermission(Permission.CREATE_SALE)
    expect(result).toBe(false)
  })
})

describe('checkAnyPermission — optimized (single DB query)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true if user has at least one of the permissions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({ data: { roles: ['vendedor'] } })

    const result = await checkAnyPermission([
      Permission.MANAGE_USERS,  // vendedor does NOT have this
      Permission.CREATE_SALE,    // vendedor DOES have this
    ])
    expect(result).toBe(true)
  })

  it('returns false when empty roles', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({ data: { roles: [] } })

    const result = await checkAnyPermission([Permission.CREATE_SALE])
    expect(result).toBe(false)
  })
})

describe('getUserPermissions — empty roles returns empty array', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty array when roles are empty', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({ data: { roles: [] } })

    const perms = await getUserPermissions()
    expect(perms).toEqual([])
  })

  it('returns all permissions for admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockSingle.mockResolvedValue({ data: { roles: ['admin'] } })

    const perms = await getUserPermissions()
    expect(perms).toContain(Permission.CREATE_SALE)
    expect(perms).toContain(Permission.MANAGE_USERS)
    expect(perms.length).toBe(Object.values(Permission).length)
  })
})
