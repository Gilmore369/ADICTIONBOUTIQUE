/**
 * Loading Skeleton Components - Usage Examples
 * 
 * This file demonstrates how to use the skeleton components
 * in different scenarios throughout the application.
 */

import { Suspense } from 'react'
import {
  TableSkeleton,
  CardSkeleton,
  FormSkeleton,
  ProductCardSkeleton,
  ListSkeleton,
} from './loading-skeleton'

/**
 * Example 1: Products Table with Skeleton
 * Use case: /catalogs/products page
 */
export function ProductsTableExample() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
      {/* <ProductsTable /> */}
    </Suspense>
  )
}

/**
 * Example 2: Product Form with Skeleton
 * Use case: Create/Edit product dialog
 */
export function ProductFormExample() {
  return (
    <Suspense fallback={<FormSkeleton fields={8} hasSubmitButton />}>
      {/* <ProductForm /> */}
    </Suspense>
  )
}

/**
 * Example 3: Credit Plan Card with Skeleton
 * Use case: /debt/plans page
 */
export function CreditPlanCardExample() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Suspense fallback={
        <>
          <CardSkeleton hasHeader hasFooter contentLines={4} />
          <CardSkeleton hasHeader hasFooter contentLines={4} />
          <CardSkeleton hasHeader hasFooter contentLines={4} />
        </>
      }>
        {/* <CreditPlanCards /> */}
      </Suspense>
    </div>
  )
}

/**
 * Example 4: Product Grid with Skeleton
 * Use case: POS product selection
 */
export function ProductGridExample() {
  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
      <Suspense fallback={
        <>
          <ProductCardSkeleton />
          <ProductCardSkeleton />
          <ProductCardSkeleton />
          <ProductCardSkeleton />
        </>
      }>
        {/* <ProductGrid /> */}
      </Suspense>
    </div>
  )
}

/**
 * Example 5: Installments List with Skeleton
 * Use case: /debt/plans/[id] page
 */
export function InstallmentsListExample() {
  return (
    <Suspense fallback={<ListSkeleton items={6} />}>
      {/* <InstallmentsList /> */}
    </Suspense>
  )
}

/**
 * Example 6: Clients Table with Skeleton
 * Use case: /clients page
 */
export function ClientsTableExample() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
      {/* <ClientsTable /> */}
    </Suspense>
  )
}

/**
 * Example 7: Dashboard Cards with Skeleton
 * Use case: /dashboard page
 */
export function DashboardExample() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Suspense fallback={
        <>
          <CardSkeleton hasHeader={false} contentLines={2} />
          <CardSkeleton hasHeader={false} contentLines={2} />
          <CardSkeleton hasHeader={false} contentLines={2} />
          <CardSkeleton hasHeader={false} contentLines={2} />
        </>
      }>
        {/* <DashboardStats /> */}
      </Suspense>
    </div>
  )
}

/**
 * Example 8: Collection Actions Form with Skeleton
 * Use case: /collections/actions page
 */
export function CollectionActionsFormExample() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Suspense fallback={<FormSkeleton fields={5} hasSubmitButton />}>
        {/* <CollectionActionForm /> */}
      </Suspense>
      <Suspense fallback={<ListSkeleton items={4} />}>
        {/* <RecentActions /> */}
      </Suspense>
    </div>
  )
}
