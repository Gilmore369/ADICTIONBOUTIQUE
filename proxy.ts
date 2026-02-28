/**
 * Next.js 16 Proxy — Auth guard for all routes
 *
 * Protects:
 * - /api/* routes require valid Supabase session (except /api/auth/*)
 * - All pages redirect to /login if no session
 * - /login redirects to /dashboard if already authenticated
 *
 * Public routes:
 * - /login
 * - /api/auth/* (signup/callback)
 * - /_next/*, /favicon.ico, static assets
 *
 * AUDIT FIX (2026-02-25):
 * - Uses getUser() instead of getSession() (server-side verified, not just JWT)
 * - Protects /api/* routes with 401 JSON (was unprotected)
 * - Preserves redirectTo param for post-login navigation
 */

import { createMiddlewareClient } from '@/lib/supabase/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimit } from '@/lib/api/rate-limit'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Rate-limit API routes (60 req/min per IP) ──────────────
  if (pathname.startsWith('/api/')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const { limited, retryAfter } = rateLimit(ip, 60, 60_000)
    if (limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
  }

  const { supabase, response } = createMiddlewareClient(request)

  // Refresh session cookie — getUser() is server-verified (more secure than getSession)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Public routes — always allow ────────────────────────────
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    // If user is on /login but already authenticated → redirect to dashboard
    if (pathname.startsWith('/login') && user) {
      const redirectUrl = new URL('/dashboard', request.url)
      return NextResponse.redirect(redirectUrl)
    }
    return response
  }

  // ── Protected API routes — return 401 JSON ─────────────────
  if (pathname.startsWith('/api/')) {
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: No active session' },
        { status: 401 }
      )
    }
    return response
  }

  // ── Protected pages — redirect to login ────────────────────
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
