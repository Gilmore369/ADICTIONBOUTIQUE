# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Adiction Boutique — Next.js + Supabase

Full-stack boutique management system. POS, CRM, Inventory, Catalog, Credits, Collections, Maps. Supports two physical stores (Mujeres / Hombres) with per-store catalog filtering.

## Commands

```bash
# Dev server (webpack mode, port 3000)
npm run dev

# Build
npm run build

# Lint
npm run lint

# Unit tests (Jest)
npm test
npm run test:watch
npm run test:coverage

# E2E tests (Playwright — server must be running on :3000)
npm run test:e2e                          # all
npx playwright test tests/e2e/auth.spec.ts               # single file
npx playwright test --project=security    # security tests only (no auth)
npx playwright test --project=ui-authenticated  # UI tests (need TEST_EMAIL/TEST_PASSWORD)
npx playwright test --headed              # visible browser
npx playwright test --ui                  # interactive UI mode
```

## Environment (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # used by server-side service client
GOOGLE_MAPS_API_KEY=...
TEST_EMAIL=...                          # Playwright authenticated tests
TEST_PASSWORD=...
```

## Architecture

### Route Layout
- `app/(auth)/` — All protected pages (wrapped in auth layout with sidebar)
- `app/(public)/` — Login page
- `app/api/` — API Routes for data operations
- `middleware.ts` — Redirects unauthenticated requests to `/login`

### Key Directories
```
actions/         Server Actions (called from client via 'use server')
app/api/         REST API routes — every route must check Supabase auth
components/      UI components, colocated with feature (clients/, pos/, catalogs/)
contexts/        React Context providers (StoreContext for store filter)
lib/services/    Server-side business logic (client-service.ts, rating-service.ts)
lib/supabase/    Supabase clients: client.ts (browser), server.ts (RSC/API), service.ts (admin)
lib/types/crm.ts Central TypeScript types for domain entities
supabase/migrations/  SQL migration files (run manually in Supabase SQL Editor)
tests/e2e/       Playwright tests
```

### Supabase Client Usage
- **Browser components** (`'use client'`): `createBrowserClient()` from `lib/supabase/client`
- **Server components / API routes**: `createServerClient()` from `lib/supabase/server`
- **Admin operations** (bypass RLS): `createServiceClient()` from `lib/supabase/service`

### Authentication Flow
1. Supabase Auth (email/password)
2. After login, user profile is fetched from `users` table (has `roles: string[]` and `stores: string[]`)
3. Roles: `admin`, `vendedor`, `cobrador`
4. Stores: `MUJERES`, `HOMBRES` — controls which lines/products a user sees

### Store Filtering
- `StoreContext` (`contexts/store-context.tsx`) holds `selectedStore` ('ALL' | 'MUJERES' | 'HOMBRES') and `storeId` (UUID)
- Products are filtered via `line_stores` table (many-to-many between lines and stores)
- The Accesorios line is intentionally shared between both stores

### API Security Pattern
Every API route must:
```ts
const supabase = await createServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Server Actions
All files in `actions/` use `'use server'` and return `{ success: boolean; data?: T; error?: string }`.

## Key Domain Tables (Supabase)

| Table | Purpose |
|---|---|
| `users` | Auth profiles with `roles[]` and `stores[]` |
| `clients` | CRM clients — has `blacklisted`, `rating` (A–E), `credit_limit`, `credit_used` |
| `stores` | Physical stores (MUJERES, HOMBRES) |
| `lines` | Product lines (Mujeres, Hombres, Niños, Accesorios, Perfumes) |
| `line_stores` | M2M: which lines belong to which store |
| `products` | Individual SKUs — has `base_code`, `base_name`, `line_id`, `size`, `color` |
| `product_images` | Images per `base_code`, optionally tagged with `color` |
| `stock` | Quantity per product per warehouse |
| `sales` / `sale_items` | Sales header + line items |
| `credit_plans` / `installments` | Credit/installment tracking |
| `visits` | Cobrador visit records linked to installment payments |

## Important Patterns

### Visual Catalog — product grouping
Products with the same `base_code` are grouped into a `ModelCard`. If `base_code` is null, it's derived from stripping the last `-SEGMENT` from the barcode. Images in `product_images` can be tagged with `color` to show per-color gallery filtering.

### Rating System (lib/services/rating-service.ts)
Scores A–E based on: payment punctuality (40%), purchase frequency (30%), purchase amount (20%), tenure (10%). Auto-blacklist triggers when installments are overdue > 10 days.

### PDF Generation
`/api/sales/generate-pdf` uses jsPDF + jspdf-autotable. Logo is stored at `public/images/logo.png` (uploaded via `/api/settings/upload-logo`). The `SaleReceipt` component uses `@media print` CSS for 80mm thermal ticket format.

### TypeScript Build
`typescript.ignoreBuildErrors: true` in `next.config.ts` — TS errors won't block builds. Fix errors but don't block on them.

## Playwright Tests

| Project | Match | Auth |
|---|---|---|
| `security` | `api-security.spec.ts`, `auth.spec.ts`, `pages-redirect.spec.ts` | None |
| `ui-authenticated` | `ui-*.spec.ts` | Requires `TEST_EMAIL` / `TEST_PASSWORD` in `.env.local` |

Auth state is saved to `tests/e2e/.auth/user.json` by `auth.setup.ts` and reused across all `ui-authenticated` tests.

## Database Migrations

SQL files in `supabase/migrations/` must be run manually in the Supabase SQL Editor — there is no CLI migration runner configured. Files are named `YYYYMMDDHHMMSS_description.sql`.

Key pending/applied migrations:
- `20260501000002_fix_atomic_code_generation.sql` — `generate_next_product_code` RPC using `pg_advisory_xact_lock` (race-condition-free)
- `20260501000003_add_supplier_ruc.sql` — adds `ruc TEXT` column to `suppliers`

## Catalog Patterns

### Line → Category strict filtering
Categories have a `line_id` FK. A category must belong to the selected line. This is enforced:
- **Frontend** (`ProductForm`, `ProductCreateModal`, `BulkProductEntryV2`): category dropdown disabled until line is chosen; only categories where `category_id.line_id == selected line_id` are shown
- **Server** (`createProduct`, `updateProduct`, `createBulkProducts`): explicit check that the category's `line_id` matches the submitted `line_id` before insert/update

### Soft-delete pattern (all catalog entities)
All catalog tables (`suppliers`, `brands`, `categories`, `lines`, `sizes`, `products`) use `active: boolean`. Soft-delete sets `active = false`. Hard constraints (FK checks) are only enforced for entities that would leave orphan relationships; soft-delete of a supplier is always allowed even if it has products (the products keep the FK, the supplier just disappears from dropdowns).

### Active/Inactive toggle in catalog managers
All catalog managers support a `showInactive` toggle (`ActiveInactiveToggle` + `InactiveBanner` components in `components/catalogs/`). Inactive items show a "Restaurar" button instead of Edit/Delete. `restoreX(id)` server actions exist for all entities.

### Size scoping
Sizes are scoped to a `category_id`. The same name "S" in Billeteras is a different row than "S" in Casacas. All size lookups/deletes must filter by `category_id`.

### Product code format
`/api/catalogs/next-code?category_id=X[&brand_id=Y]` returns an atomic sequential code:
- With brand: `NIK-BIL-001` (brand prefix + category prefix + zero-padded number)
- Without brand: `BIL-001`

The SQL function `generate_next_product_code(p_category_id, p_prefix)` uses `pg_advisory_xact_lock` to prevent race conditions.

### SearchableSelect component
`components/ui/searchable-select.tsx` — custom combobox for dropdowns with 20+ items. Supports `hint` (secondary text, also searchable). Used for suppliers in bulk entry.

### ProductCreateModal (unified product creation)
`components/products/product-create-modal.tsx` — the primary "New Product" UI. Handles:
- Base data (name, auto-computed `base_code`, supplier, brand, line, category, warehouse)
- Variants table (barcode, size, color, prices, initial stock) with inline size creation
- Calls `createBulkProducts` from `actions/products`
- Quick-create (+) buttons for supplier, brand, category, size inline

The older `ProductForm` in mode="create" is no longer used for creating products (only for editing via dialog).
