/**
 * Loading Skeleton Components
 * 
 * Reusable skeleton components for tables, cards, and forms.
 * 
 * Design Tokens Used:
 * - Spacing: 4px, 8px, 12px, 16px, 24px (from design-tokens.ts)
 * - Border Radius: 8px standard (from design-tokens.ts)
 * - Card padding: 16px (from design-tokens.ts)
 * 
 * Requirements: 9.9, 14.4
 */

import { cn } from "@/lib/utils"

/**
 * Base Skeleton component
 * Provides the animated pulse effect
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-gray-200", className)}
      {...props}
    />
  )
}

/**
 * TableSkeleton
 * 
 * Skeleton for table components with configurable rows and columns.
 * Uses spacing tokens: 16px padding, 8px gaps
 */
interface TableSkeletonProps {
  rows?: number
  columns?: number
  className?: string
}

export function TableSkeleton({ 
  rows = 5, 
  columns = 4,
  className 
}: TableSkeletonProps) {
  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* Table Header */}
      <div className="flex gap-2 border-b pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton 
            key={`header-${i}`} 
            className="h-4 flex-1" 
          />
        ))}
      </div>
      
      {/* Table Rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex gap-2">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton 
                key={`cell-${rowIndex}-${colIndex}`} 
                className="h-4 flex-1" 
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * CardSkeleton
 * 
 * Skeleton for card components.
 * Uses design tokens:
 * - Border radius: 8px (standard)
 * - Padding: 16px (card padding)
 * - Spacing: 12px, 16px gaps
 */
interface CardSkeletonProps {
  hasHeader?: boolean
  hasFooter?: boolean
  contentLines?: number
  className?: string
}

export function CardSkeleton({ 
  hasHeader = true,
  hasFooter = false,
  contentLines = 3,
  className 
}: CardSkeletonProps) {
  return (
    <div 
      className={cn(
        "rounded-lg border bg-card p-4 shadow-sm",
        className
      )}
    >
      {/* Card Header */}
      {hasHeader && (
        <div className="mb-4 space-y-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      )}
      
      {/* Card Content */}
      <div className="space-y-3">
        {Array.from({ length: contentLines }).map((_, i) => (
          <Skeleton 
            key={`content-${i}`} 
            className="h-4 w-full" 
            style={{ width: i === contentLines - 1 ? '60%' : '100%' }}
          />
        ))}
      </div>
      
      {/* Card Footer */}
      {hasFooter && (
        <div className="mt-4 flex gap-2 border-t pt-4">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      )}
    </div>
  )
}

/**
 * FormSkeleton
 * 
 * Skeleton for form components with configurable fields.
 * Uses spacing tokens: 16px, 24px gaps
 */
interface FormSkeletonProps {
  fields?: number
  hasSubmitButton?: boolean
  className?: string
}

export function FormSkeleton({ 
  fields = 4,
  hasSubmitButton = true,
  className 
}: FormSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Form Fields */}
      {Array.from({ length: fields }).map((_, i) => (
        <div key={`field-${i}`} className="space-y-2">
          {/* Label */}
          <Skeleton className="h-4 w-24" />
          {/* Input */}
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      
      {/* Submit Button */}
      {hasSubmitButton && (
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      )}
    </div>
  )
}

/**
 * ProductCardSkeleton
 * 
 * Specialized skeleton for product cards in catalog module.
 * Uses card padding: 16px, spacing: 12px
 */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "rounded-lg border bg-card p-4 shadow-sm",
        className
      )}
    >
      {/* Product Image */}
      <Skeleton className="mb-3 h-32 w-full" />
      
      {/* Product Name */}
      <Skeleton className="mb-2 h-5 w-3/4" />
      
      {/* Product Details */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      
      {/* Price */}
      <Skeleton className="mt-3 h-6 w-1/3" />
    </div>
  )
}

/**
 * ListSkeleton
 * 
 * Skeleton for list items (e.g., client list, installments list).
 * Uses spacing: 12px gaps
 */
interface ListSkeletonProps {
  items?: number
  className?: string
}

export function ListSkeleton({ 
  items = 5,
  className 
}: ListSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div 
          key={`list-item-${i}`} 
          className="flex items-center gap-3 rounded-lg border p-3"
        >
          {/* Avatar/Icon */}
          <Skeleton className="h-10 w-10 rounded-full" />
          
          {/* Content */}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          
          {/* Action */}
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton }
