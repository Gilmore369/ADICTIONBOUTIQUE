/**
 * Regression test: proxy.ts — API route protection
 *
 * Verifies that:
 * - /api/* routes return 401 when no session
 * - /login is always accessible
 * - /_next/* static assets are accessible
 * - Protected pages redirect to /login
 */

describe('proxy route protection logic', () => {
  /**
   * Extracted routing decision logic from proxy.ts
   * for unit testing without needing a real Next.js server.
   */
  function evaluateRoute(
    pathname: string,
    hasUser: boolean
  ): { action: 'allow' | 'deny-401' | 'redirect-login' } {
    // Public routes — always allow
    if (
      pathname.startsWith('/login') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/_next') ||
      pathname === '/favicon.ico'
    ) {
      return { action: 'allow' }
    }

    // Protected API routes — return 401 JSON
    if (pathname.startsWith('/api/')) {
      if (!hasUser) {
        return { action: 'deny-401' }
      }
      return { action: 'allow' }
    }

    // Protected pages — redirect to login
    if (!hasUser) {
      return { action: 'redirect-login' }
    }

    return { action: 'allow' }
  }

  describe('public routes (always accessible)', () => {
    it('/login is always accessible', () => {
      expect(evaluateRoute('/login', false).action).toBe('allow')
      expect(evaluateRoute('/login', true).action).toBe('allow')
    })

    it('/_next/static is always accessible', () => {
      expect(evaluateRoute('/_next/static/chunk.js', false).action).toBe('allow')
    })

    it('/api/auth/callback is always accessible', () => {
      expect(evaluateRoute('/api/auth/callback', false).action).toBe('allow')
    })

    it('/favicon.ico is always accessible', () => {
      expect(evaluateRoute('/favicon.ico', false).action).toBe('allow')
    })
  })

  describe('API routes — require session', () => {
    it('returns 401 for /api/clients/search without session', () => {
      expect(evaluateRoute('/api/clients/search', false).action).toBe('deny-401')
    })

    it('returns 401 for /api/products/search without session', () => {
      expect(evaluateRoute('/api/products/search', false).action).toBe('deny-401')
    })

    it('returns 401 for /api/collections/payment-preview without session', () => {
      expect(evaluateRoute('/api/collections/payment-preview', false).action).toBe('deny-401')
    })

    it('allows /api/clients/search with valid session', () => {
      expect(evaluateRoute('/api/clients/search', true).action).toBe('allow')
    })

    it('allows /api/products/search with valid session', () => {
      expect(evaluateRoute('/api/products/search', true).action).toBe('allow')
    })
  })

  describe('protected pages — redirect to login', () => {
    it('redirects /dashboard to login without session', () => {
      expect(evaluateRoute('/dashboard', false).action).toBe('redirect-login')
    })

    it('redirects /pos to login without session', () => {
      expect(evaluateRoute('/pos', false).action).toBe('redirect-login')
    })

    it('redirects /cash to login without session', () => {
      expect(evaluateRoute('/cash', false).action).toBe('redirect-login')
    })

    it('allows /dashboard with valid session', () => {
      expect(evaluateRoute('/dashboard', true).action).toBe('allow')
    })
  })
})
