/**
 * Edge-compatible in-memory rate limiter (sliding window)
 *
 * Limitations:
 * - Per-instance memory (each serverless worker has its own bucket)
 * - Acceptable for a small-team boutique system
 * - For high-traffic, swap with Upstash Redis (@upstash/ratelimit)
 *
 * Usage in proxy.ts:
 *   const { limited, retryAfter } = rateLimit(ip)
 *   if (limited) return tooManyRequests(retryAfter)
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 60s to prevent unbounded growth
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanupStale(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  const cutoff = now - windowMs
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}

/**
 * Check and record a request against the rate limit.
 *
 * @param key       Unique identifier (IP, userId, etc.)
 * @param maxHits   Maximum requests allowed per window (default 60)
 * @param windowMs  Sliding window size in ms (default 60 000 = 1 min)
 * @returns { limited: boolean, retryAfter: number (seconds) }
 */
export function rateLimit(
  key: string,
  maxHits = 60,
  windowMs = 60_000
): { limited: boolean; retryAfter: number } {
  cleanupStale(windowMs)

  const now = Date.now()
  const cutoff = now - windowMs

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Drop timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= maxHits) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000)
    return { limited: true, retryAfter: Math.max(retryAfter, 1) }
  }

  entry.timestamps.push(now)
  return { limited: false, retryAfter: 0 }
}
