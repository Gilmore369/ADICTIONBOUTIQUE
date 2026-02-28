# Shared Components

This directory contains reusable components used across multiple modules.

## Loading Skeleton Components

### Overview

Loading skeleton components provide visual feedback while data is being fetched, improving perceived performance and user experience.

**Requirements:** 9.9, 14.4

### Design Tokens Used

All skeleton components strictly follow the design system tokens:

- **Spacing Scale:** 4px, 8px, 12px, 16px, 24px, 32px (8px base)
- **Border Radius:** 8px (standard)
- **Card Padding:** 16px
- **Typography:** 14-16px (body)

### Available Components

#### 1. `TableSkeleton`

Skeleton for table components with configurable rows and columns.

**Props:**
- `rows?: number` - Number of skeleton rows (default: 5)
- `columns?: number` - Number of skeleton columns (default: 4)
- `className?: string` - Additional CSS classes

**Usage:**
```tsx
<Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
  <ProductsTable />
</Suspense>
```

#### 2. `CardSkeleton`

Skeleton for card components with optional header and footer.

**Props:**
- `hasHeader?: boolean` - Show header skeleton (default: true)
- `hasFooter?: boolean` - Show footer skeleton (default: false)
- `contentLines?: number` - Number of content lines (default: 3)
- `className?: string` - Additional CSS classes

**Usage:**
```tsx
<Suspense fallback={<CardSkeleton hasHeader hasFooter contentLines={4} />}>
  <CreditPlanCard />
</Suspense>
```

#### 3. `FormSkeleton`

Skeleton for form components with configurable fields.

**Props:**
- `fields?: number` - Number of form fields (default: 4)
- `hasSubmitButton?: boolean` - Show submit button skeleton (default: true)
- `className?: string` - Additional CSS classes

**Usage:**
```tsx
<Suspense fallback={<FormSkeleton fields={8} hasSubmitButton />}>
  <ProductForm />
</Suspense>
```

#### 4. `ProductCardSkeleton`

Specialized skeleton for product cards in catalog module.

**Props:**
- `className?: string` - Additional CSS classes

**Usage:**
```tsx
<div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
  <Suspense fallback={
    <>
      <ProductCardSkeleton />
      <ProductCardSkeleton />
      <ProductCardSkeleton />
    </>
  }>
    <ProductGrid />
  </Suspense>
</div>
```

#### 5. `ListSkeleton`

Skeleton for list items (e.g., client list, installments list).

**Props:**
- `items?: number` - Number of list items (default: 5)
- `className?: string` - Additional CSS classes

**Usage:**
```tsx
<Suspense fallback={<ListSkeleton items={6} />}>
  <InstallmentsList />
</Suspense>
```

#### 6. `Skeleton` (Base Component)

Base skeleton component with animated pulse effect. Use this to create custom skeleton layouts.

**Props:**
- `className?: string` - CSS classes for size and shape

**Usage:**
```tsx
<Skeleton className="h-4 w-full" />
<Skeleton className="h-10 w-10 rounded-full" />
```

### Best Practices

1. **Always use with Suspense:** Wrap async components with `<Suspense>` and provide skeleton as fallback
2. **Match the layout:** Skeleton should approximate the actual component's layout
3. **Use appropriate variants:** Choose the skeleton that best matches your use case
4. **Consistent spacing:** All skeletons use design tokens for consistent spacing
5. **Performance:** Skeletons are lightweight and render instantly

### Examples

See `loading-skeleton.example.tsx` for complete usage examples across different modules:
- Products table and forms
- Credit plan cards
- Product grids for POS
- Installments lists
- Dashboard cards
- Collection actions forms

### Module Usage

- **Catálogos:** `TableSkeleton`, `FormSkeleton`, `ProductCardSkeleton`
- **POS:** `ProductCardSkeleton`, `ListSkeleton`
- **Deuda:** `CardSkeleton`, `ListSkeleton`, `TableSkeleton`
- **Cobranzas:** `FormSkeleton`, `ListSkeleton`, `TableSkeleton`
- **Dashboard:** `CardSkeleton`

### Performance Impact

Skeleton components are designed for optimal performance:
- Minimal DOM elements
- CSS-only animations (no JavaScript)
- Reusable and composable
- No external dependencies beyond Tailwind CSS
