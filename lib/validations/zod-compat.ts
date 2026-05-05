/**
 * Zod v4 compatibility helpers.
 *
 * In Zod v4 (installed version: ^4.3.6) several v3 string methods either no
 * longer exist on `z.string()` or behave differently:
 *   - `.uuid()`     → not on string anymore
 *   - `.email()`    → moved to `z.email()` top-level
 *   - `.url()`      → moved to `z.url()` top-level
 *   - `.datetime()` → not available on string the same way
 *
 * Calls like `z.string().uuid('...')` therefore throw at runtime ("function
 * not exported") and silently break every validation that depends on the
 * schema. We had real production schemas using these methods that nobody
 * caught because failures fell into generic 500s.
 *
 * This module re-exposes the v3-style helpers as plain regex/refine wrappers
 * so existing code can be migrated mechanically without rewriting business
 * logic.
 *
 * Use these everywhere in `lib/validations/*` instead of the deprecated
 * string methods.
 */

import { z } from 'zod'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Pragmatic email regex — RFC 5322 is overkill for product use. Matches
// "local@host.tld" with no whitespace, requires at least one dot in the
// domain. Same shape Zod v3 used internally.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const uuid = (msg = 'Invalid UUID') =>
  z.string().regex(UUID_REGEX, msg)

export const email = (msg = 'Invalid email') =>
  z.string().regex(EMAIL_REGEX, msg)

/**
 * URL validator — uses `new URL(...)` because regexes for URLs are a swamp.
 * Accepts http(s), ftp, and supabase storage URLs.
 */
export const url = (msg = 'Invalid URL') =>
  z.string().refine(
    (v) => {
      try {
        new URL(v)
        return true
      } catch {
        return false
      }
    },
    { message: msg }
  )

/**
 * ISO 8601 datetime — anything `Date.parse` accepts is good enough for our
 * use cases (we round-trip through `new Date()` everywhere downstream).
 */
export const isoDateTime = (msg = 'Invalid ISO datetime') =>
  z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: msg })
