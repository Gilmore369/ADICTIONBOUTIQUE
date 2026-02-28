# Changelog

## [2026-02-25] Security Audit + Hardening Release

### Critical Fixes

- **C1 — API route protection**: Created `proxy.ts` auth guard. All `/api/*` routes now return `401 { error }` when unauthenticated. Previously, API routes were completely unprotected. Uses `getUser()` (server-verified) instead of `getSession()` (JWT-only).

- **C2 — Middleware/proxy conflict**: Deleted `middleware.ts` (Next.js 16 only supports `proxy.ts`). All auth logic consolidated in `proxy.ts`.

- **C3 — Cash close calculation**: Fixed `closeCashShift` in `actions/cash.ts` — was querying non-existent columns `total_amount` and `payment_type`. Corrected to `total` and `sale_type`. Added `voided=false` filter. Only CONTADO sales counted (CREDITO excluded from cash register).

- **C4 — Stock isolation**: Removed cross-store stock fallback in `actions/sales.ts`. Replaced N+1 individual stock queries with single batch query filtered by `warehouse_id`. No store can sell another store's inventory.

- **C5 — Permission escalation**: Fixed `checkPermission` in `lib/auth/check-permission.ts` — empty `roles=[]` was returning `true` (granting admin access). Now returns `false` (secure by default). Added try/catch so any exception also denies access.

- **C6 — Duplicate cash shifts**: `openCashShift` now checks for existing OPEN shift before creating a new one. Prevents double-counting in cash reconciliation.

### Build Fixes

- **B1 — Corrupted V3 file**: Deleted `components/inventory/bulk-product-entry-v3.tsx` (truncated at 113 lines, not imported anywhere; app uses V2).

- **B2 — Next.js 16 async params**: Fixed `app/api/reports/[reportId]/route.ts` — params must be `Promise<>` in Next.js 16.

- **B3 — tsconfig test exclusion**: Added `__tests__` to `tsconfig.json` exclude (tests checked by Jest separately).

### New Features

- **F1 — Payment preview endpoint**: Created `/api/collections/payment-preview` — dry-run payment allocation (oldest-due-first) without writing to DB.

### Hardening

- **H1 — Rate limiting**: Added in-memory sliding window rate limiter (60 req/min per IP) applied in `proxy.ts` for all `/api/*` routes. Returns `429 + Retry-After` header.

- **H2 — Audit logging**: Added `logSaleCreated()`, `logCashShiftOpened()`, `logCashShiftClosed()` to `lib/utils/audit.ts`. Wired into `actions/sales.ts` and `actions/cash.ts` as fire-and-forget calls.

- **H3 — Exception-safe permissions**: `getUserRoles()` now wrapped in try/catch — any DB/network error returns `null` (deny all). Never "fails open".

- **H4 — API response helpers**: Created `lib/api/response.ts` with standardized helpers: `badRequest()`, `unauthorized()`, `forbidden()`, `notFound()`, `tooManyRequests()`, `serverError()`, `ok()`, `created()`.

### Documentation

- **SECURITY.md**: Auth architecture, RBAC, rate limiting, threats mitigated, API response contract.
- **RUNBOOK.md**: Build/deploy commands, post-deploy validation checklist, troubleshooting guide.
- **CHANGELOG.md**: This file.

### Tests Added (4 suites, 39 tests)

| Suite | Tests | Protects Against |
|-------|-------|-----------------|
| `lib/auth/check-permission.test.ts` | 14 | Privilege escalation, RBAC correctness, exception safety |
| `lib/audit/cash-arqueo.test.ts` | 8 | Wrong columns, CREDITO in cash, expense subtraction |
| `lib/audit/stock-isolation.test.ts` | 9 | Cross-store stock leak, batch query correctness |
| `lib/audit/middleware-auth.test.ts` | 8 | API without 401, public routes, page redirects |
