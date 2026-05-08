# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Adiction Boutique — Next.js + Supabase

Full-stack boutique management system. POS, CRM, Inventory, Catalog, Credits, Collections, Returns, Maps. Two physical stores (Mujeres / Hombres) with per-store catalog filtering.

## Commands

```bash
# Dev server — MUST use webpack, not Turbopack
npm run dev          # → port 3000

npm run build
npm run lint

# Unit tests (Jest)
npm test
npm run test:watch
npm run test:coverage

# E2E tests (Playwright — dev server must be running on :3000)
npm run test:e2e
npx playwright test tests/e2e/auth.spec.ts          # single file
npx playwright test --project=security              # no auth required
npx playwright test --project=ui-authenticated      # needs TEST_EMAIL/TEST_PASSWORD
npx playwright test --headed
```

## Environment (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # server-side admin client
GOOGLE_MAPS_API_KEY=...
TEST_EMAIL=...                          # Playwright authenticated tests
TEST_PASSWORD=...
```

## Production VPS

- **Host**: `18.224.29.109` (AWS EC2 — IP changes on restart without Elastic IP)
- **App path**: `/var/www/ADICTIONBOUTIQUE`
- **SSH key**: `C:\Users\franc\Downloads\tiendakey.pem`
- **PM2 process**: `adiction-boutique` (cluster mode, port 3000) — restart WITHOUT sudo
- **Web**: Apache2 reverse proxy → Next.js port 3000
- **Branch**: `master`

```bash
# Deploy flow
ssh -i tiendakey.pem ubuntu@18.224.29.109
cd /var/www/ADICTIONBOUTIQUE
git pull origin master
sudo npm run build          # needs sudo for .next/ permission fix
pm2 restart adiction-boutique --update-env
```

If build fails with EACCES: `sudo chown -R ubuntu:ubuntu .next/` then retry.

## Architecture

### Route Layout
- `app/(auth)/` — Protected pages (auth layout + sidebar)
- `app/(public)/` — Login page
- `app/api/` — REST API routes (every route must check `supabase.auth.getUser()`)
- `middleware.ts` — Redirects unauthenticated requests to `/login`

### Key Directories
```
actions/              Server Actions ('use server') — return { success, data?, error? }
app/api/              REST API routes with Supabase auth check
components/           UI components colocated by feature
  catalogs/           Catalog CRUD managers + shared catalog-table, catalog-form-dialog
  dashboard/          DashboardClient.tsx — main dashboard component
  products/           ProductCreateModal (unified creation), ProductForm (edit only)
  returns/            Returns workflow (create, detail dialog, management view)
contexts/             StoreContext — selectedStore ('ALL'|'MUJERES'|'HOMBRES') + storeId
lib/services/         Server-side business logic (rating-service, client-service)
lib/supabase/         client.ts (browser), server.ts (RSC/API), service.ts (admin/bypass RLS)
lib/auth/             check-permission.ts, permissions.ts (RBAC with lowercase roles)
supabase/migrations/  SQL files — run manually in Supabase SQL Editor
tests/e2e/            Playwright specs
```

### Supabase Client Usage
- **Browser components** (`'use client'`): `createBrowserClient()` from `lib/supabase/client`
- **Server components / API routes**: `createServerClient()` from `lib/supabase/server`
- **Admin / bypass RLS**: `createServiceClient()` from `lib/supabase/service`

### API Security Pattern
Every API route must:
```ts
const supabase = await createServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Authentication & Roles
1. Supabase Auth (email/password)
2. User profile from `users` table: `roles: string[]` (lowercase), `stores: string[]`
3. Roles: `admin`, `vendedor`, `cobrador`
4. Stores: `MUJERES`, `HOMBRES`
5. RLS uses `public.has_role(role)` → normalized to lowercase

### Store Filtering
- `StoreContext` holds `selectedStore` and `storeId` (UUID)
- Products filtered via `line_stores` (M2M between lines and stores)
- Accesorios line is intentionally shared between both stores

## Key Domain Tables

| Table | Purpose |
|---|---|
| `users` | Auth profiles with `roles[]` and `stores[]` |
| `clients` | CRM — `blacklisted`, `rating` (A–E), `credit_limit`, `credit_used` |
| `stores` | Physical stores (MUJERES, HOMBRES) |
| `lines` | Product lines; `line_stores` M2M links them to stores |
| `products` | SKUs — `base_code`, `base_name`, `line_id`, `size`, `color`, `barcode` |
| `product_images` | Indexed by `base_code`, optionally tagged with `color` |
| `stock` | Quantity per product per warehouse |
| `sales` / `sale_items` | Sales header + line items |
| `credit_plans` / `installments` | Credit tracking; installments have `VOIDED` status |
| `returns` / `returned_items` | Returns workflow |
| `collection_actions` | Cobrador visit actions |
| `visits` | Cobrador visit records linked to installment payments |
| `suppliers` / `brands` | `supplier_brands` is the M2M junction table |

## Important Patterns

### Soft-delete (all catalog entities)
All catalog tables use `active: boolean`. Soft-delete sets `active = false` — **never blocked by dependent records**. Only hard deletes should check FK dependencies. `restoreX(id)` server actions exist for all entities. All catalog managers have an `ActiveInactiveToggle` + `InactiveBanner` showing inactive items with a "Restaurar" button.

### Line → Category strict hierarchy
`categories.line_id` FK — enforced at three layers:
- **Frontend**: category dropdown disabled until line selected; filtered to matching `line_id`
- **Server actions** (`createProduct`, `updateProduct`, `createBulkProducts`): validate `category.line_id === product.line_id` before insert/update
- **SizesManager**: category dropdown filters by selected line and resets on line change

### Size scoping
Sizes are scoped to `category_id`. "S" in Billeteras ≠ "S" in Casacas. All size queries must filter by `category_id`.

### Product code format
`/api/catalogs/next-code?category_id=X[&brand_id=Y]` → atomic sequential code:
- With brand: `NIK-BIL-001`
- Without brand: `BIL-001`

Uses `generate_next_product_code(p_category_id, p_prefix)` SQL function with `pg_advisory_xact_lock`.

### Brand creation dedup (ProductCreateModal)
When the inline `+` brand button is used, `handleCreateBrand` first checks if a brand with that name already exists (case-insensitive) in the current `brands` state. If found, calls `linkBrandToSupplier(existingId, supplierId)` instead of creating a duplicate. If not found, calls `createBrand({ name, supplier_ids: [supplierId] })`.

### Visual Catalog — lazy loading
`components/catalogs/visual-catalog.tsx` loads in two phases:
- **Phase 1**: `.limit(800)` — shown immediately; sets `loading = false`
- **Phase 2**: `.range(800, 1999)` — loads in background; `loadingMore` spinner shown
- `ITEMS_PER_PAGE = 60` for client-side pagination of already-loaded models
- `groupProducts()` is a pure function that accumulates products into a `Record<string, ModelCard>` map — called twice, second call merges into first result
- Products with same `base_code` are grouped into a `ModelCard`. If `base_code` is null, derived by stripping last `-SEGMENT` from barcode.

### ProductCreateModal (unified product creation)
`components/products/product-create-modal.tsx` — primary "New Product" UI:
- Base data (name, auto-computed `base_code`, supplier, brand, line, category, warehouse)
- Variants table (barcode, size, color, prices, initial stock) with inline size creation
- Quick-create (+) buttons for supplier, brand, category, size
- Calls `createBulkProducts` from `actions/products`
- `ProductForm` in mode="create" is no longer used (only for editing)

### SearchableSelect component
`components/ui/searchable-select.tsx` — combobox for 20+ item dropdowns. Supports `hint` (secondary text, also searchable). Used for suppliers in bulk entry.

### Returns workflow
Three-step state machine: `PENDIENTE → APROBADA → COMPLETADA` (or `RECHAZADA`)
- **Approve**: cancels credit plan + restores credit limit (CREDITO), or registers cash egress (CONTADO)
- **Complete**: restores stock to warehouse
- Both the detail dialog footer AND the table row have action buttons for each transition
- Server actions: `approveReturnAction`, `rejectReturnAction`, `completeReturnAction` in `actions/returns.ts`

### Dashboard (DashboardClient v3)
`components/dashboard/DashboardClient.tsx`:
- 4 main KPI cards with gradient backgrounds (colored by accent: emerald/sky/teal/rose)
- Horizontal StatStrip for 4 secondary metrics (clients, debt, stock, collections)
- Area chart: Ventas / Contado / Crédito (real data, 7D/30D toggle)
- Ventas Recientes + Contado vs Crédito pie (real data)
- Clientes por Distrito + Embudo de Clientes (real data)
- **Removed**: Top Productos (was mock), Heatmap (was mock), Rotación (was estimated), Resumen Ejecutivo (was redundant)

### Rating System
`lib/services/rating-service.ts` — A–E scores:
- Payment punctuality 40%, purchase frequency 30%, purchase amount 20%, tenure 10%
- Thresholds: A=90+, B=75+, C=60+, D=40+, E=0+
- Credit limits: E=300, D=625, C=875, B=1500, A=2500
- Auto-blacklist when installments overdue > 10 days

### PDF Generation
`/api/sales/generate-pdf` uses jsPDF + jspdf-autotable. Logo at `public/images/logo.png`. `SaleReceipt` component uses `@media print` for 80mm thermal format.

### TypeScript Build
`typescript.ignoreBuildErrors: true` in `next.config.ts`. Fix TS errors but don't block builds.

## Zod v4 Rules
- `z.string().uuid()` does NOT exist → use `z.string().min(1)`
- `z.string().datetime()` broken → use `z.string().min(1)` + refine
- `z.string().url()` with optional fields → use `z.string().optional()`

## Playwright Tests

| Project | Match | Auth |
|---|---|---|
| `security` | `api-security.spec.ts`, `auth.spec.ts`, `pages-redirect.spec.ts` | None |
| `ui-authenticated` | `ui-*.spec.ts` | `TEST_EMAIL` / `TEST_PASSWORD` in `.env.local` |

Auth state saved to `tests/e2e/.auth/user.json` by `auth.setup.ts`, reused across all `ui-authenticated` tests. `baseURL = http://127.0.0.1:3000` (not `localhost`, avoids IPv6 issues on Windows).

## Database Migrations

Run manually in Supabase Dashboard → SQL Editor. No CLI runner configured. Named `YYYYMMDDHHMMSS_description.sql`.

**Pending (not yet applied):**
- `20260501000002_fix_atomic_code_generation.sql` — `generate_next_product_code` with `pg_advisory_xact_lock`
- `20260501000003_add_supplier_ruc.sql` — adds `ruc TEXT` to `suppliers`

**Applied key migrations:**
- `20260404000001` — normalized roles to lowercase + updated RLS
- `20260412000001` — fixed `MENSAJE_REDES` constraint in `collection_actions`
- `20260504000003` — `increment_stock` RPC for returns
- `20260505000001` — dashboard metrics with Lima timezone
