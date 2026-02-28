# Operations Runbook

> Adiction Boutique Suite — Supabase/Next.js deployment

## Pre-requisites

```bash
node -v    # >= 18
npm -v     # >= 9
```

## Quick Start

```bash
cd supa/
npm install
npm run dev          # http://localhost:3000
```

## Build & Deploy

```bash
npm run build        # Production build (must pass)
npm run start        # Start production server locally

# Vercel (recommended)
vercel --prod        # Deploy to production
```

## Verification Commands

### 1. TypeScript Check

```bash
npx tsc --noEmit
# Note: ignoreBuildErrors=true in next.config.ts
# Pre-existing type errors from outdated types/database.ts
# Build still passes; types need regeneration with `supabase gen types`
```

### 2. Lint

```bash
npm run lint
# Pre-existing warnings (mostly @typescript-eslint/no-explicit-any)
# All new code is lint-clean
```

### 3. Tests

```bash
npm test                                          # Full suite
npx jest --testPathPatterns="lib/audit" --no-coverage   # Audit regression tests only
npx jest --testPathPatterns="lib/auth" --no-coverage    # RBAC tests only
```

### 4. Build

```bash
npm run build
# Must show "ƒ Proxy (Middleware)" at the bottom
# Must NOT show "Both middleware and proxy detected" error
```

## Post-Deploy Validation Checklist

### Auth / Proxy

```bash
# Should return 401 JSON (use incognito / no cookies)
curl -s https://YOUR_DOMAIN/api/clients/search?q=test | jq .
# Expected: { "error": "Unauthorized: No active session" }

# Should redirect to /login
curl -s -o /dev/null -w "%{http_code}" https://YOUR_DOMAIN/dashboard
# Expected: 307 (redirect)
```

### POS

1. Login as `vendedor`
2. Select store "Mujeres"
3. Search a product → must show stock only for "Mujeres"
4. Scan a barcode → must include `warehouse=Mujeres` in query
5. Create a CONTADO sale → verify stock decremented in "Mujeres" only
6. Verify "Hombres" stock unchanged

### Cash Register (Caja)

1. Open shift with S/100.00 opening
2. Create one CONTADO sale for S/50.00
3. Create one CREDITO sale for S/200.00
4. Add one expense for S/10.00
5. Close shift:
   - Expected = 100 + 50 - 10 = S/140.00
   - CREDITO sale must NOT be included
   - Difference = closing_amount - 140.00
6. Try opening a second shift for same store → must fail with error

### Collections / Payments

```bash
# Payment preview (requires auth cookie)
curl -b cookies.txt "https://YOUR_DOMAIN/api/collections/payment-preview?client_id=XXX&amount=500"
# Expected: { "data": { "installments": [...], "remaining_amount": 0 } }
```

1. Navigate to /collections/payments
2. Select a client with debt
3. Enter payment amount → preview should show allocation
4. Submit payment → installments should update

### Permissions

1. Login as `vendedor` → can access POS, cannot access Settings
2. Login as `cajero` → can access Cash, cannot manage users
3. Login as `cobrador` → can access Collections
4. Login as `admin` → full access
5. Empty roles user → denied everything (no permission escalation)

### Rate Limiting

```bash
# Send 61 rapid requests (should get 429 on the 61st)
for i in $(seq 1 61); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://YOUR_DOMAIN/api/clients/search?q=test)
  echo "Request $i: $STATUS"
done
# Request 61 should return 429
```

## Database Migrations

```bash
# Apply pending migrations
npx supabase db push

# Generate updated types (requires Supabase access token)
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Build error: "Both middleware and proxy detected" | `middleware.ts` exists alongside `proxy.ts` | Delete `middleware.ts`; Next.js 16 uses `proxy.ts` only |
| Cash close shows S/0.00 expected | Wrong column names in query | Verify `actions/cash.ts` uses `total` and `sale_type` (not `total_amount`/`payment_type`) |
| Stock from other store appears in POS | Cross-store fallback in stock query | Verify `actions/sales.ts` uses `.ilike('warehouse_id', store_id)` with no fallback |
| Permission escalation (empty roles) | `checkPermission` returned true for `[]` | Verify `lib/auth/check-permission.ts` returns `false` for empty roles |
| `types/database.ts` parse error | Outdated auto-generated types | Run `supabase gen types` with valid access token |

## Log Locations

| Log | Location |
|-----|----------|
| Server console | Vercel Functions logs / terminal (dev) |
| Audit trail | `audit_log` table in Supabase |
| Client errors | `/api/audit/log-error` → `audit_log` table |
| Rate limit violations | Server console (429 responses) |
