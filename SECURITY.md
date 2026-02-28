# Security Architecture

> Last updated: 2026-02-25 | Audit cycle: v1.0

## Authentication Flow

All HTTP traffic passes through **`proxy.ts`** (Next.js 16 proxy, replaces middleware.ts).

```
Browser ──► proxy.ts ──► Route Handler / Page
              │
              ├─ Public?   → pass-through
              ├─ API?      → no user → 401 JSON
              └─ Page?     → no user → redirect /login?redirectTo=...
```

### Key Decisions

| Decision | Value | Rationale |
|----------|-------|-----------|
| Auth check method | `getUser()` | Server-verified against Supabase Auth (not just JWT decode like `getSession()`) |
| API error format | `{ error: string }` + status 401 | Consistent JSON; never HTML |
| Rate limiting | 60 req/min per IP on `/api/*` | In-memory sliding window; edge-compatible |
| Session cookie | Managed by `@supabase/ssr` | Auto-refresh on every proxy pass |

### Public Routes (no auth required)

| Route | Purpose |
|-------|---------|
| `/login` | Login page |
| `/api/auth/*` | Supabase Auth callbacks |
| `/_next/*` | Static assets |
| `/favicon.ico` | Favicon |

### Protected Routes

- **`/api/*`** (except `/api/auth/*`) — requires valid Supabase user; returns `401 { error }` otherwise.
- **All pages** (except `/login`) — redirects to `/login?redirectTo=<path>`.

## Authorization (RBAC)

Defined in `lib/auth/permissions.ts` with roles: `admin`, `vendedor`, `cajero`, `cobrador`.

Checked via `checkPermission(Permission.XXX)` in server actions.

### Secure-by-Default Guarantee

```typescript
// lib/auth/check-permission.ts
// 1. roles=[] → DENY (was returning true — fixed 2026-02-25)
// 2. null/undefined user → DENY
// 3. Any exception (DB down, network error) → DENY (try/catch → return null)
```

**No permission check ever "fails open".**

## Rate Limiting

Implemented in `lib/api/rate-limit.ts`:

- **Algorithm**: Sliding window with in-memory Map
- **Limit**: 60 requests per minute per IP
- **Applied in**: `proxy.ts` (before auth check, only for `/api/*`)
- **Response**: `429 Too Many Requests` + `Retry-After` header

### Limitations

- Per-instance memory (each serverless worker has its own bucket)
- Acceptable for small-team boutique system
- For high-traffic: swap with `@upstash/ratelimit` (Redis-backed)

## Audit Logging

Critical operations are logged to the `audit_log` table via `lib/utils/audit.ts`:

| Event | Function | Details Logged |
|-------|----------|----------------|
| Sale created | `logSaleCreated()` | sale_number, store_id, sale_type, total |
| Cash shift opened | `logCashShiftOpened()` | store_id, opening_amount |
| Cash shift closed | `logCashShiftClosed()` | closing_amount, expected_amount, difference |
| Payment recorded | `logPaymentRecorded()` | client_id, amount, installments_paid |
| Client deactivated | `logClientDeactivation()` | reason, notes |
| Credit limit changed | `logCreditLimitChange()` | old_limit, new_limit |

All audit calls are fire-and-forget (`.catch(() => {})`) to never block the user operation.

## Threats Mitigated

| Threat | Mitigation | Ref |
|--------|-----------|-----|
| Unauthenticated API access | proxy.ts returns 401 for all `/api/*` | C1 |
| Privilege escalation (empty roles) | `checkPermission` returns false for `roles=[]` | C5 |
| Cross-store stock leak | Stock query strictly filtered by `warehouse_id` | C4 |
| Duplicate cash shifts | `openCashShift` checks for existing OPEN shift | C6 |
| Cash calculation errors | Correct column names (`total`, `sale_type`), CONTADO-only | C3 |
| Brute-force API abuse | Rate limiter: 60/min per IP | NEW |
| Silent permission failures | try/catch in getUserRoles → deny on any exception | NEW |

## RLS Status

> **RLS is currently disabled** on all Supabase tables.
> Auth is enforced at the application layer (proxy + server actions).
> Migration to RLS with `public.has_role()` SECURITY DEFINER functions is planned.

## Standardized API Response Format

All `/api/*` routes follow this contract:

```typescript
// Success
{ data: T }                           // 200 OK
{ data: T }                           // 201 Created

// Errors
{ error: string }                     // 400, 401, 403, 404, 429, 500
{ error: string, details?: string }   // When additional context is available
```

Helpers available in `lib/api/response.ts`:
`badRequest()`, `unauthorized()`, `forbidden()`, `notFound()`, `tooManyRequests()`, `serverError()`, `ok()`, `created()`
