/**
 * Standardized API Response Helpers
 *
 * Ensures all /api/* routes return consistent JSON shapes:
 *   Success: { data: T }
 *   Error:   { error: string, details?: string }
 *
 * All error responses include Content-Type: application/json.
 */

import { NextResponse } from 'next/server'

/**
 * 400 Bad Request
 */
export function badRequest(message: string, details?: string) {
  return NextResponse.json(
    { error: message, ...(details && { details }) },
    { status: 400 }
  )
}

/**
 * 401 Unauthorized — should rarely be needed (proxy.ts handles this),
 * but useful for server actions or edge cases.
 */
export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}

/**
 * 403 Forbidden — use when user is authenticated but lacks permission
 */
export function forbidden(message = 'Forbidden: Insufficient permissions') {
  return NextResponse.json({ error: message }, { status: 403 })
}

/**
 * 404 Not Found
 */
export function notFound(message = 'Resource not found') {
  return NextResponse.json({ error: message }, { status: 404 })
}

/**
 * 429 Too Many Requests
 */
export function tooManyRequests(retryAfterSec: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSec) },
    }
  )
}

/**
 * 500 Internal Server Error — catches unknown exceptions safely
 */
export function serverError(error?: unknown, context?: string) {
  const message =
    error instanceof Error ? error.message : 'Internal server error'
  // Log server-side only (never leak stack to client)
  if (error) {
    console.error(`[API ${context ?? ''}]`, error)
  }
  return NextResponse.json({ error: message }, { status: 500 })
}

/**
 * Generic success response — wraps data in { data: T }
 */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

/**
 * 201 Created
 */
export function created<T>(data: T) {
  return ok(data, 201)
}
